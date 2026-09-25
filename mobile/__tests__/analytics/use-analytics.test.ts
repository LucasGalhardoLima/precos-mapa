// mobile/__tests__/analytics/use-analytics.test.ts
//
// Tests the region fallback-guard: use-location's hardcoded "Matao, SP"
// fallback (shown when GPS permission is denied/unresolved) must never be
// persisted to analytics_events as if it were a real, consented location.
// See data-model.md's "Important implementation constraint" note.
// use-analytics.ts imports the '@poup/shared' barrel at module scope, which
// eagerly creates a real Supabase client on import (fails without live env
// vars). Only resolveTrackedRegion (a pure function) is under test here, so
// these mocks exist solely to let the module load — see use-analytics.test's
// sibling concerns in the region fallback-guard note above.
jest.mock('@poup/shared', () => ({
  useAuthStore: () => null,
  useLocation: () => ({ locationLabel: '', hasResolvedLocation: false }),
}));
jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../../lib/inherited-session', () => ({ clearInheritedLoginOnce: jest.fn() }));

import { resolveTrackedRegion, resolveEventIdentity } from '../../hooks/use-analytics';

describe('resolveTrackedRegion — region fallback-guard', () => {
  it('returns null when use-location has not resolved a real location, even if the fallback label is passed in', () => {
    // "Matao, SP" is the hardcoded fallback in use-location.ts — must not leak through.
    expect(resolveTrackedRegion(false, 'Matao, SP')).toBeNull();
  });

  it('returns the real region once use-location has genuinely resolved a location', () => {
    expect(resolveTrackedRegion(true, 'Araraquara, SP')).toBe('Araraquara, SP');
  });

  it('returns the region for a manually-chosen city even without device permission', () => {
    // hasResolvedLocation is true for a manual selection regardless of GPS —
    // see use-location.ts's hasResolvedLocation derivation.
    expect(resolveTrackedRegion(true, 'Ribeirão Preto, SP')).toBe('Ribeirão Preto, SP');
  });
});

// The RLS policies key off the JWT the request carries: a client with a
// session runs as `authenticated` and analytics_events_insert only accepts
// user_id = auth.uid(). An "anonymous" row from such a client was refused, and
// nothing read the insert's error, so no event from the device ever landed.
describe('resolveEventIdentity — identity follows the client session', () => {
  it('uses the session user when the client has one, and no anonymous id', () => {
    expect(resolveEventIdentity('user-1', 'anon-1')).toEqual({ user_id: 'user-1', anonymous_id: null });
  });

  it('uses the anonymous id when the client has no session', () => {
    expect(resolveEventIdentity(undefined, 'anon-1')).toEqual({ user_id: null, anonymous_id: 'anon-1' });
    expect(resolveEventIdentity(null, 'anon-1')).toEqual({ user_id: null, anonymous_id: 'anon-1' });
  });

  it('drops the event when there is neither, instead of inserting an unowned row', () => {
    expect(resolveEventIdentity(undefined, null)).toBeNull();
  });

  it('a session alone is enough — the anonymous id may not have loaded', () => {
    expect(resolveEventIdentity('user-1', null)).toEqual({ user_id: 'user-1', anonymous_id: null });
  });
});
