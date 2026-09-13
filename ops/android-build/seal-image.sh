#!/bin/bash
# Runs as a separate root unit AFTER cloud-final.service has finished.
set -euo pipefail
umask 077
exec > /var/log/gymnasia-image-seal.log 2>&1
finish() {
  local status=$?
  if (( status != 0 )); then
    echo "GYMNASIA_IMAGE_FAILED fase=cierre-de-imagen codigo=$status" > /dev/ttyS0
    tail -n 40 /var/log/gymnasia-image-seal.log > /dev/ttyS0
    /usr/bin/systemctl --no-block poweroff || true
  fi
}
trap finish EXIT
test "$(id -u)" = 0
test "$(/usr/bin/systemctl show -p Result --value cloud-final.service)" = success
/usr/bin/cloud-init status --long
/usr/bin/cloud-init clean --logs --machine-id
echo GYMNASIA_IMAGE_READY > /dev/ttyS0
/usr/bin/systemctl --no-block poweroff
