import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'poup:preferred-chain';

// "'Você está aqui'. Mercado mais próximo pelo GPS, com um toque para
// trocar" (doc decisão 5) — GPS-nearest is the default; this is only the
// manual override, keyed by chain label (not a frozen store_id) since
// Amarelinha has 5 physical locations and the nearest one can change as the
// user moves — resolution always re-picks the nearest row of the preferred
// chain at read time (see lib/resposta.ts's findHereStoreId).
export async function getPreferredChain(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function setPreferredChain(chainLabel: string): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, chainLabel);
  } catch {
    // best-effort — "aqui" just falls back to GPS-nearest next read
  }
}
