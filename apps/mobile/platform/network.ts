type PlatformFetchTarget = Pick<typeof globalThis, "fetch">;

export function createPlatformFetch(
  target: PlatformFetchTarget = globalThis,
): typeof fetch {
  return (input, init) => target.fetch(input, init);
}
