#!/bin/bash
# Extend an audited credential-free base; never run against a job's overlay.
set -euo pipefail
umask 077
exec > /var/log/gymnasia-image-install.log 2>&1
trap 'status=$?; if (( status != 0 )); then echo GYMNASIA_IMAGE_FAILED > /dev/ttyS0; tail -n 40 /var/log/gymnasia-image-install.log > /dev/ttyS0; /usr/bin/systemctl --no-block poweroff; fi' EXIT
test "$(id -u)" = 0
test "$(systemd-detect-virt)" = kvm
test ! -e /home/runner/actions/.runner
test ! -e /home/runner/smoke
test ! -e /var/run/docker.sock && test ! -e /dev/kvm && test ! -e /dev/nvidia0
set -a
# shellcheck source=/dev/null
source /etc/gymnasia-toolchain.env
set +a
echo GYMNASIA_IMAGE_PROGRESS componentes-sdk-adicionales > /dev/ttyS0
sdkmanager 'build-tools;35.0.0'
test ! -d /opt/android/platform-tools
curl --fail --location --proto '=https' --tlsv1.2 --connect-timeout 30 --max-time 300 \
  "$(jq -r '.androidPlatformTools.url' /opt/gymnasia/downloads.json)" -o /var/tmp/platform-tools.zip
echo "$(jq -r '.androidPlatformTools.sha256' /opt/gymnasia/downloads.json)  /var/tmp/platform-tools.zip" | sha256sum -c -
unzip -q /var/tmp/platform-tools.zip -d /opt/android
rm /var/tmp/platform-tools.zip
grep -q '^Pkg.Revision=37.0.1$' /opt/android/platform-tools/source.properties
grep -q '^Pkg.Revision=35.0.0$' /opt/android/build-tools/35.0.0/source.properties
sed -i 's|:/usr/local/bin|:/opt/android/platform-tools:/usr/local/bin|' /etc/gymnasia-toolchain.env
chown -R root:root /opt/gymnasia /opt/android /usr/local/lib/gymnasia
chmod -R go-w /opt/gymnasia /opt/android /usr/local/lib/gymnasia
chmod -R a+rX /opt/gymnasia /opt/android
rm -rf /root/.android /root/.cache
echo GYMNASIA_IMAGE_PROGRESS cierre-de-imagen > /dev/ttyS0
systemd-run --no-block --unit=gymnasia-image-seal --property=After=cloud-final.service \
  /bin/bash /opt/gymnasia/seal-image.sh
