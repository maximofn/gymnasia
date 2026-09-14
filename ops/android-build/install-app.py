#!/usr/bin/env python3
"""Import the explicitly approved App key; verify scope before enabling anything."""
import json
import os
import pathlib
import resource
import shutil
import sys
import uuid

from github_app import GitHub
from provision_contract import positive, require
from provision_state import save


def main():
    require(os.getuid() == 0 and len(sys.argv) == 4, "sudo python3 install-app.py APP_ID INSTALLATION_ID KEY_FILE")
    os.umask(0o077)
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    require(not pathlib.Path("/run/wallabot-maintenance.block").exists())
    directory = pathlib.Path("/etc/gymnasia-android")
    require(directory.is_dir() and directory.stat().st_uid == 0 and directory.stat().st_mode & 0o077 == 0)
    destination = directory / "app.private-key.pem"
    config_path = directory / "app.json"
    require(not destination.exists() and not config_path.exists(), "Credential rotation requires a separate reviewed operation")
    source = pathlib.Path(sys.argv[3])
    require(not source.is_symlink() and source.is_file() and source.stat().st_mode & 0o077 == 0)
    require(source.stat().st_uid in [0, int(os.environ.get("SUDO_UID", "0"))])
    require(0 < source.stat().st_size <= 16384)
    config = {"appId": positive(int(sys.argv[1])), "installationId": positive(int(sys.argv[2])),
              "repositoryId": 1155688189}
    temporary = directory / ("pending-key-" + uuid.uuid4().hex)
    try:
        with temporary.open("xb") as output, source.open("rb") as input_file:
            shutil.copyfileobj(input_file, output)
            output.flush()
            os.fsync(output.fileno())
        GitHub(config, temporary).authenticate()
        # Exclusive linking cannot overwrite an existing installed identity.
        os.link(temporary, destination)
        save(config_path, config)
        source.unlink()
        print("APP_SCOPE_VERIFIED_AND_INSTALLED; timer remains inactive")
    finally:
        temporary.unlink(missing_ok=True)


if __name__ == "__main__":
    try:
        main()
    except BaseException as error:
        print("APP_INSTALL_FAILED", type(error).__name__)
        raise SystemExit(1)
