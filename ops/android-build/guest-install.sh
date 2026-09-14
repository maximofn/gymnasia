#!/bin/bash
# Runs only while baking a credential-free image. Never registers a runner.
set -euo pipefail
umask 077
exec > /var/log/gymnasia-image-install.log 2>&1
phase=inicio
finish() {
  local status=$?
  if (( status != 0 )); then
    echo "GYMNASIA_IMAGE_FAILED fase=$phase codigo=$status" > /dev/ttyS0
    # This installer never receives credentials. Keep its last diagnostics on
    # the private host console before destroying the unsuccessful image.
    tail -n 60 /var/log/gymnasia-image-install.log > /dev/ttyS0
    /usr/bin/systemctl --no-block poweroff || true
  fi
}
trap finish EXIT
progress() {
  phase="$1"
  echo "GYMNASIA_IMAGE_PROGRESS $phase" > /dev/ttyS0
}
test "$(id -u)" = 0
test "$(systemd-detect-virt)" = kvm
progress paquetes-ubuntu
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install --no-install-recommends --yes ca-certificates curl git unzip zip xz-utils file \
  python3 jq libicu74 libssl3t64 libkrb5-3 zlib1g libstdc++6
systemctl disable --now ssh.service ssh.socket 2>/dev/null || true
# The cloud image deliberately has a locked root account. Ubuntu's sudo prerm
# otherwise refuses removal; this disposable guest will never allow login.
SUDO_FORCE_REMOVE=yes apt-get purge --yes sudo openssh-server
useradd --create-home --shell /bin/bash runner
passwd -l root
passwd -l runner
install -d -m 0755 /opt/gymnasia/node /opt/gymnasia/java /opt/android/cmdline-tools /usr/local/lib/gymnasia
cd /var/tmp
download() {
  local name="$1"
  curl --fail --location --proto '=https' --tlsv1.2 \
    --connect-timeout 30 --max-time 1800 --retry 3 \
    "$(jq -r --arg key "$name" '.[$key].url' /opt/gymnasia/downloads.json)" -o "$name.download"
  echo "$(jq -r --arg key "$name" '.[$key].sha256' /opt/gymnasia/downloads.json)  $name.download" | sha256sum -c -
}
progress node-y-java
download node
tar --no-same-owner -xJf node.download --strip-components=1 -C /opt/gymnasia/node
download java
tar --no-same-owner -xzf java.download --strip-components=1 -C /opt/gymnasia/java
progress herramientas-android
download android
unzip -q android.download -d /var/tmp/android-unpack
mv /var/tmp/android-unpack/cmdline-tools /opt/android/cmdline-tools/19.0
export JAVA_HOME=/opt/gymnasia/java ANDROID_HOME=/opt/android ANDROID_SDK_ROOT=/opt/android
export PATH=/opt/gymnasia/node/bin:/opt/gymnasia/java/bin:/opt/android/cmdline-tools/19.0/bin:/opt/android/build-tools/36.0.0:/usr/local/bin:/usr/bin:/bin
# EAS CLI selects exactly the local plugin version matching its build-job package.
progress eas-cli
npm install --global npm@10.9.3 eas-cli@24.3.0 eas-cli-local-build-plugin@24.3.0
progress sdk-y-ndk
set +o pipefail
yes | sdkmanager --licenses >/dev/null
license_status="${PIPESTATUS[1]}"
set -o pipefail
test "$license_status" = 0
sdkmanager 'platforms;android-36' 'build-tools;36.0.0' 'build-tools;35.0.0' 'ndk;27.1.12297006' 'cmake;3.22.1'
# sdkmanager's platform-tools name is a moving target. Install a numbered,
# checksummed archive instead; Expo modules also require build-tools 35.
download androidPlatformTools
unzip -q androidPlatformTools.download -d /opt/android
progress runner-sin-registrar
download runner
install -d -o runner -g runner -m 0700 /home/runner/actions
tar -xzf runner.download -C /home/runner/actions
chown -R runner:runner /home/runner/actions
install -m 0755 /opt/gymnasia/admit-job.sh /usr/local/lib/gymnasia/admit-job.sh
install -m 0644 /opt/gymnasia/gymnasia-runner.service /etc/systemd/system/
cat > /etc/gymnasia-toolchain.env <<'ENV'
PATH=/opt/gymnasia/node/bin:/opt/gymnasia/java/bin:/opt/android/cmdline-tools/19.0/bin:/opt/android/build-tools/36.0.0:/opt/android/platform-tools:/usr/local/bin:/usr/bin:/bin
JAVA_HOME=/opt/gymnasia/java
ANDROID_HOME=/opt/android
ANDROID_SDK_ROOT=/opt/android
ENV
chmod 0644 /etc/gymnasia-toolchain.env
# Only runtime caches belong to the runner. The toolchain and admission hook
# stay root-owned; dependency resolution may not silently replace SDK versions.
chown -R root:root /opt/gymnasia /opt/android /usr/local/lib/gymnasia
chmod -R go-w /opt/gymnasia /opt/android /usr/local/lib/gymnasia
chmod -R a+rX /opt/gymnasia /opt/android
test ! -e /home/runner/actions/.runner
test ! -e /var/run/docker.sock && test ! -e /dev/nvidia0
test "$(id -nG runner)" = runner
# Probe the host alias from SLIRP: it must not bypass the cgroup egress policy.
progress comprobaciones-de-aislamiento
python3 - <<'PY'
import socket, urllib.request
with urllib.request.urlopen('https://github.com',timeout=20) as response: assert response.status==200
for address,port in [('10.0.2.2',22),('10.0.2.2',80),('10.0.2.2',443),('10.0.2.2',2375)]:
    try: connection=socket.create_connection((address,port),timeout=2)
    except OSError: continue
    connection.close()
    raise RuntimeError('La VM alcanzó un servicio del host')
PY
node --version
npm --version
java -version
eas --version
rm -rf /var/tmp/*.download /var/tmp/android-unpack /root/.npm /root/.cache
# Do not delete cloud-init's own state while its final stage is still running.
# Queue a separate unit and let this script return so the ordering can resolve.
progress cierre-de-imagen
systemd-run --no-block --unit=gymnasia-image-seal \
  --property=After=cloud-final.service \
  /bin/bash /opt/gymnasia/seal-image.sh
