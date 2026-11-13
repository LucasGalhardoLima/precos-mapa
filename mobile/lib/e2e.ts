// True only in builds made with the `e2e` EAS profile (eas.json). Production and
// preview builds never set it. Everything an E2E run writes to the real backend
// carries this mark so scripts/e2e-cleanup.sh can find it — and nothing else.
export const E2E = process.env.EXPO_PUBLIC_E2E === '1';

// Spread into supabase.auth.signInAnonymously(...): outside E2E it spreads to
// nothing, so the call is identical to what the app always made. In E2E the
// flag lands in auth.users.raw_user_meta_data.
export const anonymousSignInArgs: [{ options: { data: { e2e: true } } }] | [] = E2E ? [{ options: { data: { e2e: true } } }] : [];

// analytics_events.metadata. Only a mark for the cleanup script: the engagement
// views/RPCs do not filter on it yet, so e2e events count in aggregates until cleaned.
export function withE2EMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
  return E2E ? { ...metadata, e2e: true } : (metadata ?? {});
}
