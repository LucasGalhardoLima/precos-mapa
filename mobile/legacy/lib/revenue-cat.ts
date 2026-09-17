import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';

const RC_APPLE_KEY = process.env.EXPO_PUBLIC_RC_APPLE_KEY ?? '';
const RC_GOOGLE_KEY = process.env.EXPO_PUBLIC_RC_GOOGLE_KEY ?? '';

let initialized = false;

export async function initRevenueCat(): Promise<void> {
  if (initialized) return;

  const apiKey = Platform.OS === 'ios' ? RC_APPLE_KEY : RC_GOOGLE_KEY;
  if (!apiKey) return;

  Purchases.configure({ apiKey });
  initialized = true;
}

export async function loginRevenueCat(supabaseUserId: string): Promise<void> {
  if (!initialized) await initRevenueCat();
  await Purchases.logIn(supabaseUserId);
}

export async function logoutRevenueCat(): Promise<void> {
  if (!initialized) return;
  await Purchases.logOut();
}
