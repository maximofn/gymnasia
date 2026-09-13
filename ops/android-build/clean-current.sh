#!/bin/bash
set -euo pipefail
# Fixed filenames, no recursive traversal of paths controlled by a guest.
rm -f -- /var/lib/gymnasia-android/current/disk.qcow2 /var/lib/gymnasia-android/current/seed.img
