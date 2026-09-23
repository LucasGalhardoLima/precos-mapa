import { shouldProcessScan, SCAN_COOLDOWN_MS, type ScanGateState } from '../scan';

describe('shouldProcessScan', () => {
  const emptyState: ScanGateState = { lastCode: null, lastReadAt: null };

  it('allows the first read of a code', () => {
    expect(shouldProcessScan('7891234567890', emptyState, 1000)).toBe(true);
  });

  it('blocks a repeat of the same code within the cooldown window', () => {
    const state: ScanGateState = { lastCode: '7891234567890', lastReadAt: 1000 };
    expect(shouldProcessScan('7891234567890', state, 1000 + SCAN_COOLDOWN_MS - 1)).toBe(false);
  });

  it('allows the same code again once the cooldown has fully elapsed', () => {
    const state: ScanGateState = { lastCode: '7891234567890', lastReadAt: 1000 };
    expect(shouldProcessScan('7891234567890', state, 1000 + SCAN_COOLDOWN_MS)).toBe(true);
  });

  it('allows a different code immediately, even mid-cooldown for the previous one', () => {
    const state: ScanGateState = { lastCode: '7891234567890', lastReadAt: 1000 };
    expect(shouldProcessScan('7899999999999', state, 1000)).toBe(true);
  });
});
