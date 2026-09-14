#!/usr/bin/env python3
"""Exercise the hostile-guest transport boundary without QEMU or credentials."""
import hashlib
import importlib.util
import io
import pathlib
import struct
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("channel", pathlib.Path(__file__).with_name("smoke-channel.py"))
channel = importlib.util.module_from_spec(spec)
spec.loader.exec_module(channel)


class TransportTests(unittest.TestCase):
    def test_partial_writes_do_not_drop_bytes(self):
        class PartialWriter(io.BytesIO):
            def write(self, data):
                return super().write(data[:3])

        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / "input"
            data = bytes(range(256)) * 4
            path.write_bytes(data)
            stream = PartialWriter()
            channel.send(stream, path)
            self.assertEqual(stream.getvalue(), struct.pack(">Q", len(data)) + data)

    def test_chunked_binary_roundtrip(self):
        with tempfile.TemporaryDirectory() as directory:
            source, target = [pathlib.Path(directory) / name for name in ["source", "target"]]
            data = bytes(range(256)) * 1025
            source.write_bytes(data)
            stream = io.BytesIO()
            channel.send(stream, source)
            stream.seek(0)
            result = channel.receive(stream, target, len(data))
            self.assertEqual(target.read_bytes(), data)
            self.assertEqual(result, {"size": len(data), "sha256": hashlib.sha256(data).hexdigest()})

    def test_oversized_frame_creates_no_file(self):
        with tempfile.TemporaryDirectory() as directory:
            target = pathlib.Path(directory) / "output"
            with self.assertRaises(ValueError):
                channel.receive(io.BytesIO(struct.pack(">Q", 2**64 - 1)), target, 1024)
            self.assertFalse(target.exists())

    def test_truncated_frame_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(EOFError):
                channel.receive(io.BytesIO(struct.pack(">Q", 8) + b"short"), pathlib.Path(directory) / "output", 1024)

    def test_existing_target_and_symlink_never_followed(self):
        with tempfile.TemporaryDirectory() as directory:
            original = pathlib.Path(directory) / "original"
            original.write_bytes(b"preserve")
            link = pathlib.Path(directory) / "link"
            link.symlink_to(original)
            for target in [original, link]:
                with self.assertRaises(FileExistsError):
                    channel.receive(io.BytesIO(struct.pack(">Q", 0)), target, 1024)
            self.assertEqual(original.read_bytes(), b"preserve")


if __name__ == "__main__":
    unittest.main()
