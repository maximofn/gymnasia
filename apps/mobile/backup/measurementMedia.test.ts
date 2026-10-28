import { beforeEach, describe, expect, it, vi } from "vitest";

const cryptoMock = vi.hoisted(() => ({
  digest: vi.fn(),
}));
const mediaState = vi.hoisted(() => ({ exists: true, bytes: 12345, files: 2, fail: false, platform: "android" }));

vi.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digest: cryptoMock.digest,
}));

vi.mock("expo-file-system", () => {
  class MockFile {}
  return {
    Directory: class MockDirectory {
      get exists() { return mediaState.exists; }
      get size() { if (mediaState.fail) throw new Error("PRIVATE_PHOTO_PATH"); return mediaState.bytes; }
      list() { return Array.from({ length: mediaState.files }, () => new MockFile()); }
    },
    File: MockFile,
    Paths: { document: "file:///documents", availableDiskSpace: 1024 * 1024 * 1024 },
  };
});

vi.mock("expo-image-manipulator", () => ({
  ImageManipulator: { manipulate: vi.fn() },
  SaveFormat: { JPEG: "jpeg" },
}));

vi.mock("react-native", () => ({
  Image: { getSize: vi.fn() },
  Platform: { get OS() { return mediaState.platform; } },
}));

import { measurementPhotoSha256, measureMeasurementMediaUsage } from "./measurementMedia";

describe("measurement photo storage metadata", () => {
  beforeEach(() => { Object.assign(mediaState, { exists: true, bytes: 12345, files: 2, fail: false, platform: "android" }); });
  it("measures file metadata independently from AsyncStorage without reading or creating photos", async () => {
    await expect(measureMeasurementMediaUsage()).resolves.toEqual({ bytes: 12345, fileCount: 2, availableDiskBytes: 2 ** 30 });
  });
  it("distinguishes a missing directory from unavailable metadata", async () => {
    mediaState.exists = false;
    await expect(measureMeasurementMediaUsage()).resolves.toEqual({ bytes: 0, fileCount: 0, availableDiskBytes: 2 ** 30 });
    mediaState.exists = true;
    mediaState.fail = true;
    const result = await measureMeasurementMediaUsage();
    expect(result).toEqual({ bytes: null, fileCount: null, availableDiskBytes: 2 ** 30 });
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
  });
  it("does not pretend to measure the native photo directory from web", async () => {
    mediaState.platform = "web";
    await expect(measureMeasurementMediaUsage()).resolves.toEqual({ bytes: null, fileCount: null, availableDiskBytes: null });
  });
});

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
