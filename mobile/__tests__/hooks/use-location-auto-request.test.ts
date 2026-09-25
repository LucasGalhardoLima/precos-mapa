import * as Location from 'expo-location';
import { readForegroundPermission } from '@poup/shared/hooks/use-location';

// jest.setup.ts's global expo-location mock has no getForegroundPermissionsAsync;
// this suite needs it, so it replaces the mock.
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

const mocked = Location as jest.Mocked<typeof Location>;
const response = (status: string) => ({ status }) as Location.LocationPermissionResponse;

beforeEach(() => jest.clearAllMocks());

describe('readForegroundPermission', () => {
  it('prompts when asked to, and never reads the passive status instead', async () => {
    mocked.requestForegroundPermissionsAsync.mockResolvedValue(response('granted'));

    const result = await readForegroundPermission(true);

    expect(mocked.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mocked.getForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(result).toEqual({ granted: true, definitive: true });
  });

  // expo/expo#28284: on iOS the request promise can stay pending after the user
  // taps Allow. The real status is the way out — undetermined means the dialog
  // is still up, anything else means the user answered.
  describe('when the request promise never settles', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('resolves from the real status once the user has answered', async () => {
      mocked.requestForegroundPermissionsAsync.mockReturnValue(new Promise(() => {}));
      mocked.getForegroundPermissionsAsync
        .mockResolvedValueOnce(response('undetermined'))
        .mockResolvedValue(response('granted'));

      const pending = readForegroundPermission(true);
      await jest.advanceTimersByTimeAsync(2000);

      expect(await pending).toEqual({ granted: true, definitive: true });
    });

    it('keeps waiting while the dialog is still up', async () => {
      mocked.requestForegroundPermissionsAsync.mockReturnValue(new Promise(() => {}));
      mocked.getForegroundPermissionsAsync.mockResolvedValue(response('undetermined'));

      let settled = false;
      readForegroundPermission(true).then(() => {
        settled = true;
      });
      await jest.advanceTimersByTimeAsync(5000);

      expect(settled).toBe(false);
    });

    it('stops polling once the request settles by itself', async () => {
      mocked.requestForegroundPermissionsAsync.mockResolvedValue(response('granted'));

      await readForegroundPermission(true);

      expect(jest.getTimerCount()).toBe(0);
    });
  });

  it('a prompted refusal is definitive', async () => {
    mocked.requestForegroundPermissionsAsync.mockResolvedValue(response('denied'));

    expect(await readForegroundPermission(true)).toEqual({ granted: false, definitive: true });
  });

  it('never shows the system dialog when prompt is false', async () => {
    mocked.getForegroundPermissionsAsync.mockResolvedValue(response('undetermined'));

    await readForegroundPermission(false);

    expect(mocked.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(mocked.getForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('a prompt-free "undetermined" is not definitive — never asked is not denied', async () => {
    mocked.getForegroundPermissionsAsync.mockResolvedValue(response('undetermined'));

    expect(await readForegroundPermission(false)).toEqual({ granted: false, definitive: false });
  });

  it('a prompt-free "denied" is definitive', async () => {
    mocked.getForegroundPermissionsAsync.mockResolvedValue(response('denied'));

    expect(await readForegroundPermission(false)).toEqual({ granted: false, definitive: true });
  });

  it('a prompt-free "granted" is definitive and granted', async () => {
    mocked.getForegroundPermissionsAsync.mockResolvedValue(response('granted'));

    expect(await readForegroundPermission(false)).toEqual({ granted: true, definitive: true });
  });
});
