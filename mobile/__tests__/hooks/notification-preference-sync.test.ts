// The Ajustes switch only reached AsyncStorage; notify-tracked-price reads
// notification_preferences.push_alerts, so the switch must be mirrored there.
const mockGetSession = jest.fn();
const mockEq = jest.fn().mockResolvedValue({ error: null });
const mockUpdate = jest.fn(() => ({ eq: mockEq }));
const mockMaybeSingle = jest.fn();
const mockSelect = jest.fn(() => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }));
const mockFrom = jest.fn(() => ({ update: mockUpdate, select: mockSelect }));
jest.mock('@/lib/supabase', () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...(a as [])), auth: { getSession: () => mockGetSession() } },
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@poup/shared/lib/supabase', () => ({ supabase: { from: jest.fn(), auth: { getSession: jest.fn() } } }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { readNotificationsEnabled, syncPushPreference } from '@/hooks/use-notification-setting';

beforeEach(() => jest.clearAllMocks());

describe('syncPushPreference', () => {
  it('writes push_alerts for the current anonymous session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'anon-1' } } } });

    await syncPushPreference(false);

    expect(mockFrom).toHaveBeenCalledWith('notification_preferences');
    expect(mockUpdate).toHaveBeenCalledWith({ push_alerts: false });
    expect(mockEq).toHaveBeenCalledWith('user_id', 'anon-1');
  });

  it('throws when the write fails, so callers do not silently drift', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'anon-1' } } } });
    mockEq.mockResolvedValueOnce({ error: { message: 'rls' } });

    await expect(syncPushPreference(true)).rejects.toEqual({ message: 'rls' });
  });

  it('does nothing before any session exists (nothing to mute server-side yet)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    await syncPushPreference(true);

    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('readNotificationsEnabled', () => {
  beforeEach(() => mockGetSession.mockResolvedValue({ data: { session: null } }));

  it('trusts the server copy when there is a session (reinstall wipes AsyncStorage, not the session)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'anon-1' } } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { push_alerts: false }, error: null });

    await expect(readNotificationsEnabled()).resolves.toBe(false);
    expect(mockFrom).toHaveBeenCalledWith('notification_preferences');
  });

  it('defaults to on when nothing was stored', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockResolvedValueOnce(null);
    await expect(readNotificationsEnabled()).resolves.toBe(true);
  });

  it('is off only when the switch was explicitly turned off', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockResolvedValueOnce('false');
    await expect(readNotificationsEnabled()).resolves.toBe(false);
  });
});
