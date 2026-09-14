#!/bin/bash
# Root-owned in the guest, outside the runner directory. No job code runs first.
set -euo pipefail
test "${GITHUB_REPOSITORY:-}" = maximofn/gymnasia
test "${GITHUB_REF:-}" = refs/heads/main
test "${GITHUB_WORKFLOW_REF:-}" = maximofn/gymnasia/.github/workflows/build-apk.yml@refs/heads/main
test "${GITHUB_JOB:-}" = compile-android
case "${GITHUB_EVENT_NAME:-}" in push|workflow_dispatch) ;; *) exit 1 ;; esac
test "$(id -u)" != 0
for group in sudo docker kvm libvirt; do
  if id -nG | tr ' ' '\n' | grep -qx "$group"; then exit 1; fi
done
test ! -e /var/run/docker.sock && test ! -e /dev/nvidia0 && test ! -e /dev/kvm
/usr/bin/python3 /usr/local/lib/gymnasia/job-admission.py
