#!/usr/bin/env python3
"""Root-owned pre-job hook: fail before checkout on a different run or SHA."""
import json
import os
import pathlib
import sys

sys.path.insert(0, "/opt/gymnasia")
from provision_contract import admit, require

path = pathlib.Path("/etc/gymnasia-job.json")
require(not path.is_symlink() and path.stat().st_uid == 0 and path.stat().st_mode & 0o022 == 0)
admit(json.loads(path.read_text()), os.environ)
