#!/bin/bash
# Execute the reviewed package in tmux. Never fetch or execute a checkout here.
set -euo pipefail
test "$(id -u)" = 0
test ! -e /run/wallabot-maintenance.block
cd "$(dirname "$0")"
exec 9>/run/lock/gymnasia-android-image.lock
flock --nonblock 9
for unit in gymnasia-android-controller gymnasia-android-vm gymnasia-android-smoke gymnasia-android-image; do
  test "$(systemctl show --value -p ActiveState "$unit.service")" = inactive
done
test ! -e /var/lib/gymnasia-android/control/active.json
test -z "$(find /var/lib/gymnasia-android/current -mindepth 1 -maxdepth 1 -print -quit)"
sha256sum -c /var/lib/gymnasia-android/base.sha256
python3 provision-test.py
python3 registration-test.py
python3 smoke-channel-test.py
install -d -o root -g root -m 0700 /etc/gymnasia-android /var/lib/gymnasia-android/control
for file in provision-controller.py provision_contract.py provision_state.py github_app.py job_runner.py \
  job-admission.py admit-job.sh run-smoke.py smoke-channel.py smoke-guest.py runner_registration.py; do
  install -o root -g root -m 0755 "$file" "/usr/local/lib/gymnasia-android/$file"
done
install -o root -g root -m 0644 gymnasia-android-controller.service gymnasia-android-controller.timer /etc/systemd/system/
systemd-analyze verify /etc/systemd/system/gymnasia-android-controller.service /etc/systemd/system/gymnasia-android-controller.timer
systemctl daemon-reload
echo 'Controlador instalado y apagado. Faltan la GitHub App y la activación explícita del timer.'
