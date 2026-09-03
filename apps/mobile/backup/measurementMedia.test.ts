import { beforeEach, describe, expect, it, vi } from "vitest";

const cryptoMock = vi.hoisted(() => ({
  digest: vi.fn(),
}));

vi.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digest: cryptoMock.digest,
}));

vi.mock("expo-file-system", () => ({
  Directory: class MockDirectory {},
  File: class MockFile {},
  Paths: { document: "file:///documents" },
}));

vi.mock("expo-image-manipulator", () => ({
  ImageManipulator: { manipulate: vi.fn() },
  SaveFormat: { JPEG: "jpeg" },
}));

vi.mock("react-native", () => ({
  Image: { getSize: vi.fn() },
  Platform: { OS: "android" },
}));

import { measurementPhotoSha256 } from "./measurementMedia";

describe("measurementPhotoSha256", () => {
  beforeEach(() => {
    cryptoMock.digest.mockReset();
  });

  it("entrega un Uint8Array contiguo al puente nativo de expo-crypto", async () => {
    const backingBytes = new Uint8Array([9, 1, 2, 3, 8]);
    const photoBytes = backingBytes.subarray(1, 4);

    cryptoMock.digest.mockImplementation(async (_algorithm, input: unknown) => {
      expect(input).toBeInstanceOf(Uint8Array);
      expect(input).not.toBe(photoBytes);
      expect(Array.from(input as Uint8Array)).toEqual([1, 2, 3]);
      return new Uint8Array([0xab, 0xcd]).buffer;
    });

    await expect(measurementPhotoSha256(photoBytes)).resolves.toBe("abcd");
    expect(cryptoMock.digest).toHaveBeenCalledWith("SHA-256", expect.any(Uint8Array));
  });
});
