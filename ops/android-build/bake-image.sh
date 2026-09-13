#!/bin/bash
# Manual root operation after install-host.sh; no credentials and no runner registration.
set -euo pipefail
umask 077
test "$(id -u)" = 0
test -d /usr/local/lib/gymnasia-android
test "$(systemctl is-active gymnasia-android-vm.service || true)" = inactive
test ! -e /var/lib/gymnasia-android/base.qcow2
source_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
state=/var/lib/gymnasia-android
test ! -e "$state/current/disk.qcow2"
test ! -e "$state/current/seed.img"
test -e /sys/fs/cgroup/cgroup.controllers
grep -q '^CONFIG_CGROUP_BPF=y$' "/boot/config-$(uname -r)"
work="$(mktemp -d /var/tmp/gymnasia-image.XXXXXX)"
cleanup() {
  systemctl stop gymnasia-android-image.service 2>/dev/null || true
  rm -f /run/systemd/system/gymnasia-android-image.service
  /usr/local/lib/gymnasia-android/clean-current.sh
  rm -rf -- "$work"
  systemctl daemon-reload
}
trap cleanup EXIT
python3 - "$source_dir/downloads.json" "$work" <<'PY'
import json, pathlib, sys, urllib.request, hashlib
item=json.load(open(sys.argv[1]))['ubuntu']
target=pathlib.Path(sys.argv[2])/'ubuntu.qcow2'
with urllib.request.urlopen(item['url']) as response, target.open('wb') as out:
    while chunk:=response.read(1024*1024): out.write(chunk)
assert hashlib.file_digest(target.open('rb'),'sha256').hexdigest()==item['sha256']
PY
install -o root -g gymnasia-vm -m 0640 "$work/ubuntu.qcow2" "$state/ubuntu.qcow2"
qemu-img create -f qcow2 -F qcow2 -b "$state/ubuntu.qcow2" "$state/current/disk.qcow2" 120G
python3 - "$source_dir" "$work" <<'PY'
import base64,json,pathlib,sys
source=pathlib.Path(sys.argv[1]); work=pathlib.Path(sys.argv[2])
files=[]
for name in ['guest-install.sh','admit-job.sh','gymnasia-runner.service','downloads.json','toolchain.json']:
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
while systemctl is-active --quiet gymnasia-android-image.service; do sleep 5; done
test "$(systemctl show -p Result --value gymnasia-android-image.service)" = success
journalctl --no-pager "_SYSTEMD_INVOCATION_ID=$invocation" -o cat > "$work/console.txt"
grep -q '^GYMNASIA_IMAGE_READY' "$work/console.txt"
qemu-img check "$state/current/disk.qcow2"
qemu-img convert -O qcow2 "$state/current/disk.qcow2" "$state/base.qcow2"
chown root:gymnasia-vm "$state/base.qcow2"
chmod 0440 "$state/base.qcow2"
sha256sum "$state/base.qcow2" > "$state/base.sha256"
echo 'Imagen preparada sin credenciales. Runner sin registrar; falta prueba firmada y auditoría antes de activar.'
