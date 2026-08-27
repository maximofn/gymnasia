export type ProviderCredential = {
  provider: string;
  api_key: string;
};

export type SecureCredentialStore = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

export function maskApiKey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "Sin API key";
  if (trimmed.length < 10) return `${trimmed.slice(0, 2)}***`;
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

export function stripProviderApiKeys<
  TStore extends { keys: Array<TCredential> },
  TCredential extends ProviderCredential,
>(store: TStore): TStore {
  return {
    ...store,
    keys: store.keys.map((item) => ({ ...item, api_key: "" })),
  };
}

export async function readProviderApiKeys<Provider extends string>(
  storage: SecureCredentialStore,
  providers: readonly Provider[],
  keyForProvider: (provider: Provider) => string,
): Promise<Record<Provider, string>> {
  const entries = await Promise.all(
    providers.map(async (provider) => {
      const value = await storage.getItemAsync(keyForProvider(provider));
      return [provider, (value ?? "").trim()] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<Provider, string>;
}

export async function writeProviderApiKeys<Credential extends ProviderCredential>(
  storage: SecureCredentialStore,
  credentials: readonly Credential[],
  keyForProvider: (provider: Credential["provider"]) => string,
): Promise<void> {
  await Promise.all(
    credentials.map(async (credential) => {
      const storageKey = keyForProvider(credential.provider);
      const value = credential.api_key.trim();
      if (!value) {
        await storage.deleteItemAsync(storageKey);
        return;
      }
      await storage.setItemAsync(storageKey, value);
    }),
  );
}
