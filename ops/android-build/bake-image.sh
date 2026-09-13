#!/bin/bash
# Manual root operation after install-host.sh; no credentials and no runner registration.
set -euo pipefail
umask 077
test "$(id -u)" = 0
test ! -e /run/wallabot-maintenance.block
test -d /usr/local/lib/gymnasia-android
test "$(systemctl is-active gymnasia-android-vm.service || true)" = inactive
test ! -e /var/lib/gymnasia-android/base.qcow2
source_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
state=/var/lib/gymnasia-android
test ! -e "$state/current/disk.qcow2"
test ! -e "$state/current/seed.img"
test -e /sys/fs/cgroup/cgroup.controllers
grep -q '^CONFIG_CGROUP_BPF=y$' "/boot/config-$(uname -r)"
exec 9>/run/lock/gymnasia-android-image.lock
flock --nonblock 9
evidence="$(mktemp -d /var/tmp/gymnasia-image-evidence.XXXXXX)"
work="$(mktemp -d /var/tmp/gymnasia-image.XXXXXX)"
invocation=
cleanup() {
  local status=$?
  trap - EXIT
  systemctl stop gymnasia-android-image.service 2>/dev/null || true
  if [[ -n "$invocation" ]]; then
    journalctl --no-pager "_SYSTEMD_INVOCATION_ID=$invocation" -o cat > "$evidence/console.txt" || true
    systemctl show gymnasia-android-image.service -p Result -p ExecMainStatus > "$evidence/result.txt" || true
  fi
  systemctl reset-failed gymnasia-android-image.service 2>/dev/null || true
  rm -f /run/systemd/system/gymnasia-android-image.service
  /usr/local/lib/gymnasia-android/clean-current.sh
  rm -rf -- "$work"
  systemctl daemon-reload
  echo "Diagnóstico privado de esta preparación: $evidence"
  if (( status != 0 )); then
    echo 'La imagen no quedó validada; VM detenida y disco temporal eliminado.' >&2
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
ss -H -lntu | sort > "$evidence/listeners-before.txt"
systemctl --failed --no-legend --plain > "$evidence/failed-before.txt"
echo 'Descargando y verificando la imagen Ubuntu fijada…'
python3 - "$source_dir/downloads.json" "$work" <<'PY'
import json, pathlib, sys, urllib.request, hashlib
item=json.load(open(sys.argv[1]))['ubuntu']
target=pathlib.Path(sys.argv[2])/'ubuntu.qcow2'
with urllib.request.urlopen(item['url'],timeout=60) as response, target.open('wb') as out:
    while chunk:=response.read(1024*1024): out.write(chunk)
assert hashlib.file_digest(target.open('rb'),'sha256').hexdigest()==item['sha256']
PY
install -o root -g gymnasia-vm -m 0640 "$work/ubuntu.qcow2" "$state/ubuntu.qcow2"
qemu-img create -f qcow2 -F qcow2 -b "$state/ubuntu.qcow2" "$state/current/disk.qcow2" 120G
python3 - "$source_dir" "$work" <<'PY'
import base64,json,pathlib,sys
source=pathlib.Path(sys.argv[1]); work=pathlib.Path(sys.argv[2])
files=[]
for name in ['guest-install.sh','seal-image.sh','admit-job.sh','gymnasia-runner.service','downloads.json','toolchain.json']:
    files.append({'path':f'/opt/gymnasia/{name}','permissions':'0700' if name.endswith('.sh') else '0644',
                  'encoding':'b64','content':base64.b64encode((source/name).read_bytes()).decode()})
config={'users':[], 'ssh_pwauth':False, 'disable_root':True, 'write_files':files,
        'runcmd':[['bash','/opt/gymnasia/guest-install.sh']]}
(work/'user-data').write_text('#cloud-config\n'+json.dumps(config))
(work/'meta-data').write_text('instance-id: gymnasia-image-v1\nlocal-hostname: android-builder\n')
(work/'network-config').write_text(json.dumps({'version':2,'ethernets':{'build':{
    'match':{'name':'en*'},'dhcp4':True,'dhcp6':False,
    'dhcp4-overrides':{'use-dns':False},'nameservers':{'addresses':['1.1.1.1','1.0.0.1']}}}}))
PY
cloud-localds --network-config="$work/network-config" "$state/current/seed.img" "$work/user-data" "$work/meta-data"
chown gymnasia-vm:gymnasia-vm "$state/current/disk.qcow2" "$state/current/seed.img"
# Baking uses the SAME resource/network sandbox, but keeps the credential-free
# disk long enough to seal it. The production unit always deletes its overlay.
sed '/^ExecStopPost=/d' /etc/systemd/system/gymnasia-android-vm.service > /run/systemd/system/gymnasia-android-image.service
systemctl daemon-reload
systemctl start gymnasia-android-image.service
invocation="$(systemctl show -p InvocationID --value gymnasia-android-image.service)"
test -n "$invocation"
echo 'VM arrancada: preparando Ubuntu, Java y Android. Puede tardar varios minutos.'
last_progress=
while systemctl is-active --quiet gymnasia-android-image.service; do
  journalctl --no-pager "_SYSTEMD_INVOCATION_ID=$invocation" -o cat > "$work/console.txt"
  progress="$(grep '^GYMNASIA_IMAGE_' "$work/console.txt" | tail -n 1 || true)"
  if [[ -n "$progress" && "$progress" != "$last_progress" ]]; then
    echo "$progress"
    last_progress="$progress"
  fi
  if grep -q '^GYMNASIA_IMAGE_FAILED' "$work/console.txt"; then exit 1; fi
  sleep 5
done
test "$(systemctl show -p Result --value gymnasia-android-image.service)" = success
journalctl --no-pager "_SYSTEMD_INVOCATION_ID=$invocation" -o cat > "$work/console.txt"
if grep -q '^GYMNASIA_IMAGE_FAILED' "$work/console.txt"; then exit 1; fi
grep -q '^GYMNASIA_IMAGE_READY' "$work/console.txt"
test "$(cat /proc/sys/net/ipv4/ip_forward)" = 0
test "$(cat /proc/sys/net/ipv6/conf/all/forwarding)" = 0
ss -H -lntu | sort > "$evidence/listeners-after.txt"
systemctl --failed --no-legend --plain > "$evidence/failed-after.txt"
diff -u "$evidence/listeners-before.txt" "$evidence/listeners-after.txt"
diff -u "$evidence/failed-before.txt" "$evidence/failed-after.txt"
qemu-img check "$state/current/disk.qcow2"
echo 'Comprobaciones superadas; sellando la imagen sin credenciales…'
qemu-img convert -O qcow2 "$state/current/disk.qcow2" "$work/base.qcow2"
qemu-img check "$work/base.qcow2"
mv "$work/base.qcow2" "$state/base.qcow2"
chown root:gymnasia-vm "$state/base.qcow2"
chmod 0440 "$state/base.qcow2"
sha256sum "$state/base.qcow2" > "$state/base.sha256"
echo 'Imagen preparada sin credenciales. Runner sin registrar; falta prueba firmada y auditoría antes de activar.'
