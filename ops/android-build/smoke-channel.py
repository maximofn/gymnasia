#!/usr/bin/env python3
"""Bounded byte transport for a manual smoke VM; no listening sockets or mounts."""
import hashlib
import json
import os
import pathlib
import socket
import struct
import subprocess
import threading

LIMIT = 256 * 1024 * 1024
STATE = pathlib.Path("/var/lib/gymnasia-android/current")


def exact(stream, count):
    chunks = bytearray()
    while len(chunks) < count:
        chunk = stream.read(min(count - len(chunks), 65536))
        if not chunk:
            raise EOFError("Canal truncado")
        chunks.extend(chunk)
    return bytes(chunks)


def receive(stream, destination, limit):
    size = struct.unpack(">Q", exact(stream, 8))[0]
    if size > limit:
        raise ValueError("Límite del canal excedido")
    digest = hashlib.sha256()
    with open(destination, "xb") as output:
        remaining = size
        while remaining:
            chunk = exact(stream, min(remaining, 65536))
            output.write(chunk)
            digest.update(chunk)
            remaining -= len(chunk)
        output.flush()
        os.fsync(output.fileno())
    return {"size": size, "sha256": digest.hexdigest()}


def send(stream, path):
    size = path.stat().st_size
    if size > LIMIT:
        raise ValueError("Entrada demasiado grande")
    stream.write(struct.pack(">Q", size))
    with path.open("rb") as source:
        while chunk := source.read(65536):
            stream.write(chunk)
    stream.flush()


def main():
    assert os.getuid() != 0
    os.umask(0o077)
    os.chdir(STATE)
    left, right = socket.socketpair()
    # The descriptor is already connected. Neither socket binds an address,
    # calls listen(), exposes a filesystem path, nor enables a guest command API.
    command = ["/usr/bin/qemu-system-x86_64", "-machine", "q35,accel=kvm",
               "-cpu", "host,-svm,-vmx", "-smp", "4", "-m", "16384",
               "-nodefaults", "-no-user-config", "-display", "none", "-vga", "none",
               "-monitor", "none", "-serial", "stdio", "-no-reboot",
               "-sandbox", "on,obsolete=deny,elevateprivileges=deny,spawn=deny,resourcecontrol=deny",
               "-drive", "file=disk.qcow2,format=qcow2,if=virtio,cache=none",
               "-drive", "file=seed.img,format=raw,if=virtio,readonly=on",
               "-netdev", "user,id=buildnet,ipv6=off",
               "-device", "virtio-net-pci,netdev=buildnet",
               "-chardev", f"socket,id=transfer,fd={right.fileno()}",
               "-device", "virtio-serial-pci",
               "-device", "virtserialport,chardev=transfer,name=gymnasia.transfer"]
    process = subprocess.Popen(command, pass_fds=[right.fileno()])
    right.close()
    left.settimeout(110 * 60)
    outgoing = left.makefile("wb", buffering=0)
    incoming = left.makefile("rb", buffering=0)
    errors = []

    def deliver():
        try:
            # Request is small; the second frame carries only an APK for the
            # independent verifier (empty for a build/probe).
            send(outgoing, STATE / "request.json")
            send(outgoing, STATE / "input.bin")
            (STATE / "request.json").unlink()
        except Exception:
            errors.append("input-transfer")
            process.terminate()

    thread = threading.Thread(target=deliver, daemon=True)
    thread.start()
    try:
        result = receive(incoming, STATE / "report.json", 64 * 1024)
        artifact = receive(incoming, STATE / "output.bin", LIMIT)
        # The receiver never interprets an APK, archive, path, or command from
        # the guest. Output stays quarantined until a fresh VM verifies it.
        (STATE / "transfer.json").write_text(json.dumps({"report": result, "artifact": artifact}))
        outgoing.write(b"OK")
        outgoing.flush()
        thread.join(timeout=5)
        assert not errors and not thread.is_alive()
        assert process.wait(timeout=90) == 0
        print("GYMNASIA_SMOKE_TRANSFER_OK", flush=True)
    finally:
        if process.poll() is None:
            process.terminate()
            process.wait(timeout=30)
        left.close()


if __name__ == "__main__":
    main()
