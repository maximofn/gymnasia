#!/usr/bin/env python3
"""Install reviewed files and run a no-credential audit. Keep the timer off."""
import json
import os
import pathlib
import subprocess

from provision_contract import require


def run(*args, check=True):
    return subprocess.run(args, check=check, text=True, stdout=subprocess.PIPE,
                          stderr=subprocess.STDOUT).stdout.strip()


def snapshot():
    return {"listeners": sorted(run("ss", "-H", "-lntu").splitlines()),
            "failed": run("systemctl", "--failed", "--no-legend", "--plain"),
            "ipv4": pathlib.Path("/proc/sys/net/ipv4/ip_forward").read_text().strip(),
            "ipv6": pathlib.Path("/proc/sys/net/ipv6/conf/all/forwarding").read_text().strip()}


def main():
    require(os.getuid() == 0 and not pathlib.Path("/run/wallabot-maintenance.block").exists())
    os.umask(0o077)
    source = pathlib.Path(__file__).resolve().parent
    os.chdir(source)
    require((source / "SHA256SUMS").exists())
    run("sha256sum", "-c", "SHA256SUMS")
    before = snapshot()
    require(not before["failed"] and before["ipv4"] == before["ipv6"] == "0")
    print(run("bash", "install-controller.sh"), flush=True)
    name = "gymnasia-android-controller-audit.service"
    unit = pathlib.Path("/run/systemd/system") / name
    require(not unit.exists())
    definition = (source / "gymnasia-android-controller.service").read_text()
    definition = "\n".join(line for line in definition.splitlines()
                           if not line.startswith(("ConditionPathExists=", "LoadCredential=", "ExecStart=")))
    definition += "\nExecStart=/usr/bin/python3 /usr/local/lib/gymnasia-android/audit-controller.py\n"
    # Same restrictions and resource bounds; only the credential-free entry
    # point and absent App credential differ from the installed service.
    unit.write_text(definition)
    result = None
    probe_passed = False
    try:
        run("systemctl", "daemon-reload")
        # journalctl emits no cursor at -n 0 on the installed systemd.
        cursor_line = run("journalctl", "--no-pager", "-n", "1", "--show-cursor").splitlines()[-1]
        require(cursor_line.startswith("-- cursor: "))
        cursor = cursor_line.removeprefix("-- cursor: ")
        print("CONTROLLER_NATIVE_AUDIT_STARTING", flush=True)
        started = subprocess.run(["systemctl", "start", name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        result = run("systemctl", "show", "--value", "-p", "Result", name)
        # A oneshot's InvocationID is cleared when it becomes inactive. Read
        # only new records so an earlier successful audit cannot satisfy this one.
        logs = run("journalctl", "--no-pager", "-u", name, "--after-cursor", cursor, "-o", "cat")
        probe_passed = started.returncode == 0 and result == "success" and "CONTROLLER_NATIVE_AUDIT_PASSED" in logs
        require(probe_passed)
    finally:
        run("systemctl", "stop", name, check=False)
        run("systemctl", "reset-failed", name, check=False)
        unit.unlink(missing_ok=True)
        run("systemctl", "daemon-reload")
        after = snapshot()
        audit = {"result": result, "probePassed": probe_passed, "hostUnchanged": before == after,
                 "currentEmpty": not list(pathlib.Path("/var/lib/gymnasia-android/current").iterdir())}
        pathlib.Path("/var/lib/gymnasia-android/control/native-audit.json").write_text(json.dumps(audit, indent=2))
        require(before == after and audit["currentEmpty"])
    print("CONTROLLER_PREPARED_AND_AUDITED; timer inactive; no App or runner registered", flush=True)


if __name__ == "__main__":
    try:
        main()
    except BaseException as error:
        print("CONTROLLER_PREPARATION_FAILED", type(error).__name__, flush=True)
        raise SystemExit(1)
