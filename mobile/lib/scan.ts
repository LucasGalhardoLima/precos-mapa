// Pure logic for app/scan.tsx, split out for the same reason as lib/resposta.ts
// — testable without mounting the camera.

// VisionCamera's onCodeScanned fires on every analyzed frame while a barcode
// stays in view (commonly 10+ times/second), not once per physical scan.
// Without a gate, a single scan would fire the haptic/navigate flow (or a
// scan_read event) repeatedly. One read per distinct code, plus a short
// cooldown so a re-shown code (e.g. after "ler outro código") is still
// caught on its next appearance.
export const SCAN_COOLDOWN_MS = 1200;

export interface ScanGateState {
  lastCode: string | null;
  lastReadAt: number | null;
}

export function shouldProcessScan(code: string, state: ScanGateState, now: number): boolean {
  if (state.lastCode === code && state.lastReadAt != null && now - state.lastReadAt < SCAN_COOLDOWN_MS) {
    return false;
  }
  return true;
}
