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
