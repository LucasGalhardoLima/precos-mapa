import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

// use-push-notifications.ts imports the shared supabase client at module
// scope, which eagerly creates a real client on import (fails without live
// env vars) — same issue and same fix as use-analytics.test.ts's note.
jest.mock('@poup/shared/lib/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('@poup/shared/store/auth-store', () => ({ useAuthStore: () => null }));

import { registerForPushToken } from '@poup/shared/hooks/use-push-notifications';

// jest.setup.ts's global mock defaults both calls to 'granted', which would
// hide the one thing this suite exists to check — that a non-granted status
// only re-prompts when told to. Override locally, same pattern as
// use-location-auto-request.test.ts.
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[mock-token]' }),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { MAX: 5 },
  setNotificationChannelAsync: jest.fn(),
}));

const mockedNotifications = Notifications as jest.Mocked<typeof Notifications>;
const status = (s: string) => ({ status: s }) as Notifications.NotificationPermissionsStatus;

beforeEach(() => jest.clearAllMocks());

describe('registerForPushToken', () => {
  it('never prompts when already granted, regardless of the prompt flag', async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue(status('granted'));

    const token = await registerForPushToken(false);

    expect(mockedNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(token).toBe('ExponentPushToken[mock-token]');
  });

  it('prompts when not yet granted and prompt=true (the "acompanhar" tap)', async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue(status('undetermined'));
    mockedNotifications.requestPermissionsAsync.mockResolvedValue(status('granted'));

    const token = await registerForPushToken(true);

    expect(mockedNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(token).toBe('ExponentPushToken[mock-token]');
  });

  it('never shows the system dialog when prompt=false — this is what keeps the dialog off screen mount', async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue(status('undetermined'));

    const token = await registerForPushToken(false);

    expect(mockedNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(token).toBeNull();
  });

  it('returns null on a simulator/non-device without ever checking permissions', async () => {
    const original = Device.isDevice;
    (Device as { isDevice: boolean }).isDevice = false;
    try {
      const token = await registerForPushToken(true);
      expect(mockedNotifications.getPermissionsAsync).not.toHaveBeenCalled();
      expect(token).toBeNull();
    } finally {
      (Device as { isDevice: boolean }).isDevice = original;
    }
  });
});
