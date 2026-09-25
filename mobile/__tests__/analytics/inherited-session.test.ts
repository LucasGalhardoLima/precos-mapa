// mobile/__tests__/analytics/inherited-session.test.ts
//
// The old app left a real login in the Keychain, which survives deleting the app.
// This build has no login, so the first launch signs that session out (once) and
// leaves anonymous sessions ("Acompanhar") alone.
const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
const mockGetSession = jest.fn();
const mockSignOut = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (k: string) => mockGetItem(k),
    setItem: (k: string, v: string) => mockSetItem(k, v),
  },
}));
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: () => mockGetSession(), signOut: (o: unknown) => mockSignOut(o) } },
}));

// The module memoizes its run, so each case loads a fresh copy.
function load(): typeof import('../../lib/inherited-session') {
  let mod: typeof import('../../lib/inherited-session') | undefined;
  jest.isolateModules(() => {
    mod = require('../../lib/inherited-session');
  });
  return mod!;
}

const sessionOf = (isAnonymous: boolean) => ({ data: { session: { user: { id: 'u1', is_anonymous: isAnonymous } } } });

beforeEach(() => {
  jest.clearAllMocks();
  mockGetItem.mockResolvedValue(null);
  mockSetItem.mockResolvedValue(undefined);
  mockSignOut.mockResolvedValue({ error: null });
});

describe('isInheritedLogin', () => {
  const { isInheritedLogin } = load();

  it('is true for a real login', () => {
    expect(isInheritedLogin({ user: { is_anonymous: false } })).toBe(true);
    expect(isInheritedLogin({ user: {} })).toBe(true);
  });

  it('is false for an anonymous session and for no session', () => {
    expect(isInheritedLogin({ user: { is_anonymous: true } })).toBe(false);
    expect(isInheritedLogin(null)).toBe(false);
    expect(isInheritedLogin(undefined)).toBe(false);
  });
});

describe('clearInheritedLoginOnce', () => {
  it('signs out a real login on this device only, then sets the flag', async () => {
    mockGetSession.mockResolvedValue(sessionOf(false));

    await load().clearInheritedLoginOnce();

    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(mockSetItem).toHaveBeenCalledWith('poup:inherited-session-checked', '1');
  });

  it('leaves an anonymous session alone', async () => {
    mockGetSession.mockResolvedValue(sessionOf(true));

    await load().clearInheritedLoginOnce();

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockSetItem).toHaveBeenCalledWith('poup:inherited-session-checked', '1');
  });

  it('does nothing when there is no session, but still sets the flag', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    await load().clearInheritedLoginOnce();

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockSetItem).toHaveBeenCalledTimes(1);
  });

  it('does not even read the session once the flag is set', async () => {
    mockGetItem.mockResolvedValue('1');

    await load().clearInheritedLoginOnce();

    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('keeps the flag unset when signOut fails (it returns the error, e.g. offline), so the next launch retries', async () => {
    mockGetSession.mockResolvedValue(sessionOf(false));
    mockSignOut.mockResolvedValue({ error: new Error('network') });

    await load().clearInheritedLoginOnce();

    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('never throws, and leaves the flag unset, when reading the session throws', async () => {
    mockGetSession.mockRejectedValue(new Error('keychain'));

    await expect(load().clearInheritedLoginOnce()).resolves.toBeUndefined();
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('runs once per launch: the layout and every track share one run', async () => {
    mockGetSession.mockResolvedValue(sessionOf(false));
    const { clearInheritedLoginOnce } = load();

    await Promise.all([clearInheritedLoginOnce(), clearInheritedLoginOnce(), clearInheritedLoginOnce()]);

    expect(mockGetSession).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
