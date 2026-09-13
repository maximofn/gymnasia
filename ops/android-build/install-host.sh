#!/bin/bash
# Reviewed installation only; never starts a VM or registers a runner.
set -euo pipefail
test "$(id -u)" = 0 || { echo 'Ejecuta este instalador con sudo en wallabot.'; exit 1; }
test "$(uname -m)" = x86_64
# shellcheck disable=SC1091
. /etc/os-release
test "$ID" = ubuntu && test "$VERSION_ID" = 24.04
test -c /dev/kvm
test ! -e /usr/local/lib/gymnasia-android
test "$(cat /proc/sys/net/ipv4/ip_forward)" = 0
test "$(cat /proc/sys/net/ipv6/conf/all/forwarding)" = 0
source_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
baseline="$(mktemp -d /var/tmp/gymnasia-host-install.XXXXXX)"
ss -H -lntu | sort > "$baseline/listeners.before"
systemctl --failed --no-legend > "$baseline/failed.before"
test ! -s "$baseline/failed.before"
apt-get install --no-install-recommends --yes \
  qemu-system-x86=1:8.2.2+ds-0ubuntu1.18 \
  qemu-utils=1:8.2.2+ds-0ubuntu1.18 cloud-image-utils=0.33-1
useradd --system --home-dir /var/lib/gymnasia-android --no-create-home --shell /usr/sbin/nologin gymnasia-vm
install -d -m 0755 /usr/local/lib/gymnasia-android
install -m 0755 "$source_dir/start-vm.sh" /usr/local/lib/gymnasia-android/start-vm.sh
install -m 0755 "$source_dir/clean-current.sh" /usr/local/lib/gymnasia-android/clean-current.sh
install -m 0644 "$source_dir/gymnasia-android-vm.service" /etc/systemd/system/
install -d -o root -g gymnasia-vm -m 0750 /var/lib/gymnasia-android
install -d -o gymnasia-vm -g gymnasia-vm -m 0700 /var/lib/gymnasia-android/current
systemd-analyze verify /etc/systemd/system/gymnasia-android-vm.service
systemctl daemon-reload
ss -H -lntu | sort > "$baseline/listeners.after"
diff -u "$baseline/listeners.before" "$baseline/listeners.after"
test "$(cat /proc/sys/net/ipv4/ip_forward)" = 0
test "$(cat /proc/sys/net/ipv6/conf/all/forwarding)" = 0
test -z "$(systemctl --failed --no-legend)"
test "$(systemctl is-active gymnasia-android-vm.service || true)" = inactive
echo 'QEMU preparado; VM y runner permanecen apagados. Falta crear y verificar la imagen.'
