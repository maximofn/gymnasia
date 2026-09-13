#!/bin/bash
set -euo pipefail
cd /var/lib/gymnasia-android/current
test -f disk.qcow2 && test -f seed.img
exec /usr/bin/qemu-system-x86_64 \
  -machine q35,accel=kvm -cpu host -smp 4 -m 16384 \
  -nodefaults -no-user-config -display none -vga none -monitor none \
  -serial stdio -no-reboot \
  -sandbox on,obsolete=deny,elevateprivileges=deny,spawn=deny,resourcecontrol=deny \
  -drive file=disk.qcow2,format=qcow2,if=virtio,cache=none \
  -drive file=seed.img,format=raw,if=virtio,readonly=on \
  -netdev user,id=buildnet,ipv6=off \
  -device virtio-net-pci,netdev=buildnet
