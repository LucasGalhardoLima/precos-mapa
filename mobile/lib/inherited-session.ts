import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

// Set once the check ran to completion on this install. AsyncStorage on purpose,
// not SecureStore: it is wiped when the app is deleted, and the Keychain login it
// guards against is not — so a reinstall re-runs the check.
const CHECKED_KEY = 'poup:inherited-session-checked';

/** A real login (email/Apple/Google), as opposed to the anonymous one "Acompanhar" makes. */
export function isInheritedLogin(session: { user: { is_anonymous?: boolean } } | null | undefined): boolean {
  return !!session && !session.user.is_anonymous;
}

let pending: Promise<void> | null = null;

/**
 * The previous app kept a real login in the Keychain (SecureStore), which
 * survives deleting the app. This app has no login, and a request carrying that
 * session ran as `authenticated` and tied every event to a real user_id. On the
 * first launch of a build that has this, sign it out once. Anonymous sessions
 * (from "Acompanhar") are left alone.
 *
 * scope 'local' ends this device's session only, never the user's sessions
 * elsewhere. signOut() returns its error instead of throwing (e.g. offline), so
 * the flag is written only after a clean run and a failure is retried next launch.
 *
 * Memoized: the root layout kicks it off at launch and `track` awaits it, so no
 * event can read the inherited session before it is gone.
 */
export function clearInheritedLoginOnce(): Promise<void> {
  if (!pending) pending = run();
  return pending;
}

async function run(): Promise<void> {
  try {
    if (await AsyncStorage.getItem(CHECKED_KEY)) return;
    const { data } = await supabase.auth.getSession();
    if (isInheritedLogin(data.session)) {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) return;
    }
    await AsyncStorage.setItem(CHECKED_KEY, '1');
  } catch {
    // Not fatal: the flag was not written, so the next launch retries.
  }
}
