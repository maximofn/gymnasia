"""Bounded HTTPS client. No credential in argv, logs, redirects or disk caches."""
import base64
import datetime
import json
import pathlib
import re
import subprocess
import time
import urllib.error
import urllib.request

from provision_contract import REPOSITORY, positive, require

PERMISSIONS = {"administration": "write", "actions": "read", "metadata": "read"}
PREFIX = "/repos/" + REPOSITORY


class APIError(RuntimeError):
    def __init__(self, status=0):
        self.status = status
        super().__init__(f"GitHub request failed ({status})")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise APIError(302)


def b64(value):
    return base64.urlsafe_b64encode(value).rstrip(b"=")


def private_key(path):
    path = pathlib.Path(path)
    require(not path.is_symlink() and path.is_file())
    require(path.stat().st_uid == 0 and path.stat().st_mode & 0o077 == 0)
    return path


def jwt(app_id, key, now=None):
    positive(app_id)
    timestamp = int(time.time() if now is None else now)
    message = b".".join([b64(b'{"alg":"RS256","typ":"JWT"}'),
                          b64(json.dumps({"iat": timestamp - 60, "exp": timestamp + 540,
                                          "iss": str(app_id)}, separators=(",", ":")).encode())])
    signed = subprocess.run(["/usr/bin/openssl", "dgst", "-sha256", "-sign", str(private_key(key))],
                            input=message, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=10)
    require(signed.returncode == 0, "Cannot sign GitHub App request")
    return (message + b"." + b64(signed.stdout)).decode()


def request(method, path, token, data=None):
    require(path.startswith("/") and ".." not in path and re.fullmatch(r"/[A-Za-z0-9_./?=&-]+", path))
    require(method in ["GET", "POST", "DELETE"])
    headers = {"Accept": "application/vnd.github+json", "Authorization": "Bearer " + token,
               "X-GitHub-Api-Version": "2026-03-10", "User-Agent": "gymnasia-android-controller",
               "Content-Type": "application/json"}
    req = urllib.request.Request("https://api.github.com" + path, method=method, headers=headers,
                                 data=None if data is None else json.dumps(data).encode())
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    try:
        with opener.open(req, timeout=30) as response:
            raw = response.read(2 * 1024 * 1024 + 1)
            require(len(raw) <= 2 * 1024 * 1024, "GitHub response exceeds bound")
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        raise APIError(error.code) from None
    except (urllib.error.URLError, TimeoutError, OSError):
        raise APIError() from None


class GitHub:
    def __init__(self, config, key, transport=request, sign=jwt):
        require(set(config) == {"appId", "installationId", "repositoryId"})
        for value in config.values():
            positive(value)
        self.config, self.key, self.transport, self.sign = config, key, transport, sign
        self.token, self.expires = "", 0

    def authenticate(self):
        if time.time() < self.expires - 180:
            return
        bearer = self.sign(self.config["appId"], self.key)
        installed = self.transport("GET", PREFIX + "/installation", bearer)
        require(installed["id"] == self.config["installationId"] and installed["app_id"] == self.config["appId"])
        require(installed["account"]["login"] == "maximofn" and installed.get("suspended_at") is None)
        require(installed["repository_selection"] == "selected" and installed["permissions"] == PERMISSIONS,
                "Install the dedicated App only on Gymnasia with the reviewed permissions")
        response = self.transport("POST", f"/app/installations/{self.config['installationId']}/access_tokens", bearer,
                                  {"repository_ids": [self.config["repositoryId"]], "permissions": PERMISSIONS})
        require(response["permissions"] == PERMISSIONS)
        token = response["token"]
        require(isinstance(token, str) and 20 <= len(token) <= 16384 and "\n" not in token)
        repos = self.transport("GET", "/installation/repositories?per_page=100", token)
        require(repos["total_count"] == 1 and len(repos["repositories"]) == 1)
        require(repos["repositories"][0]["full_name"] == REPOSITORY
                and repos["repositories"][0]["id"] == self.config["repositoryId"])
        expiry = datetime.datetime.fromisoformat(response["expires_at"].replace("Z", "+00:00"))
        require(expiry.tzinfo is not None and 180 < expiry.timestamp() - time.time() <= 3900)
        self.token, self.expires = token, expiry.timestamp()

    def __call__(self, method, path, data=None):
        require(path.startswith(PREFIX + "/"))
        self.authenticate()
        # Mutation responses are never retried. A lost response must be
        # reconciled from the durable identity reserved before the request.
        return self.transport(method, path, self.token, data)


def collection(api, path, key):
    items = []
    for page in range(1, 21):
        response = api("GET", path + ("&" if "?" in path else "?") + f"per_page=100&page={page}")
        require(isinstance(response[key], list) and len(response[key]) <= 100)
        items.extend(response[key])
        if len(items) >= response["total_count"]:
            require(len(items) == response["total_count"], "Collection changed during pagination")
            return items
    raise ValueError("GitHub collection exceeds bound")


def find_runner(api, name):
    found = [runner for runner in collection(api, PREFIX + "/actions/runners", "runners") if runner["name"] == name]
    require(len(found) <= 1, "Ambiguous runner identity")
    return found[0] if found else None
