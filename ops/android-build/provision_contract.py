"""Fixed admission contract shared by the trusted controller and clean guest."""
import datetime
import re

REPOSITORY = "maximofn/gymnasia"
WORKFLOW = ".github/workflows/build-apk.yml"
LABELS = {"self-hosted", "linux", "x64", "wallabot", "android-build"}


def require(condition, message="Invalid provisioning contract"):
    if not condition:
        raise ValueError(message)


def positive(value):
    require(type(value) is int and 0 < value < 2**63)
    return value


def identity(value):
    require(set(value) == {"runId", "runAttempt", "jobId", "workflowSha", "nonce"})
    for key in ["runId", "runAttempt", "jobId"]:
        positive(value[key])
    require(isinstance(value["workflowSha"], str) and re.fullmatch(r"[a-f0-9]{40}", value["workflowSha"]))
    require(isinstance(value["nonce"], str) and re.fullmatch(r"[a-f0-9]{32}", value["nonce"]))
    return value


def runner_name(value):
    identity(value)
    return f"gymnasia-job-{value['jobId']}-{value['nonce']}"


def job_label(value):
    identity(value)
    return f"gymnasia-{value['runId']}-{value['runAttempt']}"


def request_identity(request, now=None):
    require(set(request) == {"schemaVersion", "mode", "nonce", "runId", "runAttempt", "jobId",
                             "workflowSha", "registrationToken", "expiresAt"})
    require(request["schemaVersion"] == 1 and request["mode"] == "run-job")
    result = identity({key: request[key] for key in ["runId", "runAttempt", "jobId", "workflowSha", "nonce"]})
    token = request["registrationToken"]
    require(isinstance(token, str) and re.fullmatch(r"[A-Za-z0-9_.-]{20,4096}", token))
    expires = datetime.datetime.fromisoformat(request["expiresAt"].replace("Z", "+00:00"))
    require(expires.tzinfo is not None)
    remaining = (expires - (now or datetime.datetime.now(datetime.timezone.utc))).total_seconds()
    require(120 <= remaining <= 3900)
    return result


def admit(expected, environment):
    identity(expected)
    required = {"GITHUB_REPOSITORY": REPOSITORY, "GITHUB_REF": "refs/heads/main",
                "GITHUB_WORKFLOW_REF": f"{REPOSITORY}/{WORKFLOW}@refs/heads/main",
                "GITHUB_JOB": "compile-android", "GITHUB_RUN_ID": str(expected["runId"]),
                "GITHUB_RUN_ATTEMPT": str(expected["runAttempt"]), "GITHUB_SHA": expected["workflowSha"]}
    require(all(environment.get(key) == value for key, value in required.items()), "Job identity rejected")
    require(environment.get("GITHUB_EVENT_NAME") in ["push", "workflow_dispatch"], "Event rejected")


def candidate(run, jobs, repository_id, pending):
    """Return a queued, approved job only after all three hosted prerequisites."""
    positive(repository_id)
    require(run["repository"]["id"] == repository_id and run["repository"]["full_name"] == REPOSITORY)
    require(run["head_repository"]["id"] == repository_id and run["head_repository"]["full_name"] == REPOSITORY)
    require(run["head_branch"] == "main" and run["event"] in ["push", "workflow_dispatch"])
    require(run["path"] == WORKFLOW and not run.get("pull_requests"))
    require(run["status"] in ["queued", "in_progress", "waiting", "pending", "requested"])
    require(pending == [], "Production approval is still pending")
    by_name = {}
    for job in jobs:
        require(job["name"] not in by_name, "Ambiguous job name")
        by_name[job["name"]] = job
    for name in ["select-transaction", "validate-production", "prepare-production"]:
        job = by_name[name]
        require(job["status"] == "completed" and job["conclusion"] == "success")
        require(job["run_id"] == run["id"] and job["head_sha"] == run["head_sha"])
    job = by_name["compile-android"]
    require(job["status"] == "queued" and not job.get("runner_id") and not job.get("runner_name"))
    require(job["run_id"] == run["id"] and job["head_sha"] == run["head_sha"])
    require(job["head_branch"] == "main")
    result = identity({"runId": run["id"], "runAttempt": run["run_attempt"], "jobId": job["id"],
                       "workflowSha": run["head_sha"], "nonce": "0" * 32})
    require({x.lower() for x in job["labels"]} == LABELS | {job_label(result)})
    return result
