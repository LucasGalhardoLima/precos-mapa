// E2E builds mark every row they create (auth user + analytics events) so the
// cleanup script can find them; non-E2E builds must behave exactly as before.
jest.mock('@/lib/supabase', () => ({ supabase: { auth: { signInAnonymously: jest.fn() } } }));

function load(e2e: '1' | undefined) {
  if (e2e) process.env.EXPO_PUBLIC_E2E = e2e;
  else delete process.env.EXPO_PUBLIC_E2E;
  let mods: { e2e: typeof import('@/lib/e2e'); deps: typeof import('@/lib/onboarding-sync-deps'); supabase: { auth: { signInAnonymously: jest.Mock } } } | undefined;
  jest.isolateModules(() => {
    mods = {
      e2e: require('@/lib/e2e'),
      deps: require('@/lib/onboarding-sync-deps'),
      supabase: require('@/lib/supabase').supabase,
    };
  });
  return mods!;
}

afterEach(() => {
  delete process.env.EXPO_PUBLIC_E2E;
});

describe('E2E off (production/preview)', () => {
  it('signs in anonymously with no arguments, as before', async () => {
    const m = load(undefined);
    m.supabase.auth.signInAnonymously.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null });
    expect(m.e2e.E2E).toBe(false);
    await m.deps.supabaseSyncDeps.signInAnonymously();
    expect(m.supabase.auth.signInAnonymously).toHaveBeenCalledWith();
  });

  it('leaves event metadata untouched', () => {
    const { e2e } = load(undefined);
    expect(e2e.withE2EMetadata({ query: 'arroz' })).toEqual({ query: 'arroz' });
    expect(e2e.withE2EMetadata(undefined)).toEqual({});
  });
});

describe('E2E on (eas profile e2e)', () => {
  it('marks the anonymous user in raw_user_meta_data', async () => {
    const m = load('1');
    m.supabase.auth.signInAnonymously.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null });
    expect(m.e2e.E2E).toBe(true);
    await expect(m.deps.supabaseSyncDeps.signInAnonymously()).resolves.toBe('u1');
    expect(m.supabase.auth.signInAnonymously).toHaveBeenCalledWith({ options: { data: { e2e: true } } });
  });

  it('adds e2e: true to event metadata, keeping the caller keys', () => {
    const { e2e } = load('1');
    expect(e2e.withE2EMetadata({ query: 'arroz' })).toEqual({ query: 'arroz', e2e: true });
    expect(e2e.withE2EMetadata(undefined)).toEqual({ e2e: true });
  });
});
