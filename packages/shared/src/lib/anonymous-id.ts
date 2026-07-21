import * as SecureStore from 'expo-secure-store';

// expo-secure-store keys must be alphanumeric plus ".", "-", "_" only — no ":".
const ANONYMOUS_ID_KEY = 'poup.anonymous-id';

// Math.random-based RFC4122 v4 — fine here since this only needs to be
// unique-ish per device for analytics dedup, not cryptographically secure.
function generateUuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let cachedId: string | null = null;
let pendingId: Promise<string> | null = null;

/** Returns a UUID persisted in expo-secure-store, generating one on first call. */
export function getAnonymousId(): Promise<string> {
  if (cachedId) return Promise.resolve(cachedId);
  if (pendingId) return pendingId;

  pendingId = (async () => {
    const stored = await SecureStore.getItemAsync(ANONYMOUS_ID_KEY);
    if (stored) {
      cachedId = stored;
      return stored;
    }
    const fresh = generateUuidV4();
    await SecureStore.setItemAsync(ANONYMOUS_ID_KEY, fresh);
    cachedId = fresh;
    return fresh;
  })();

  return pendingId;
}
