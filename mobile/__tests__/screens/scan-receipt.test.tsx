// mobile/__tests__/screens/scan-receipt.test.tsx
//
// Regression tests for the NFC-e receipt scan screen (015 Mode B). The real
// camera/scanner is mocked (as in scan.test.tsx) — these tests simulate a
// QR scan by invoking the onCodeScanned callback captured from the mocked
// useCodeScanner call, then assert on how the screen renders the edge
// function's response. They do NOT exercise sefaz-nfce-fetch itself (that's
// covered by its own Deno tests) — only the mobile screen's handling of
// each possible response shape.
import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import ScanReceiptScreen from '../../app/scan-receipt';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

let capturedOnCodeScanned: ((codes: { value?: string }[]) => void) | null = null;

jest.mock('react-native-vision-camera', () => ({
  Camera: () => null,
  useCameraDevice: () => ({ id: 'mock-back-camera' }),
  useCameraPermission: () => ({ hasPermission: true, requestPermission: jest.fn() }),
  useCodeScanner: (config: { onCodeScanned: (codes: { value?: string }[]) => void }) => {
    capturedOnCodeScanned = config.onCodeScanned;
    return {};
  },
}));

jest.mock('lucide-react-native', () => {
  const { Text } = require('react-native');
  const icon = (name: string) => () => <Text>{name}</Text>;
  return {
    X: icon('X'),
    CameraOff: icon('CameraOff'),
    CircleCheckBig: icon('CircleCheckBig'),
    TriangleAlert: icon('TriangleAlert'),
  };
});

jest.mock('../../theme/use-theme', () => ({
  useTheme: () => ({
    tokens: {
      dark: '#0A0A0F',
      surface: '#FFFFFF',
      primary: '#0D9488',
      primaryMuted: '#CCFBF1',
      border: '#E8EDF2',
      textPrimary: '#1A1A2E',
      textSecondary: '#6B7280',
      textHint: '#94A3B8',
    },
  }),
}));

jest.mock('@poup/shared', () => ({
  getAnonymousId: () => Promise.resolve('anon-test-id'),
}));

const mockInvoke = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (name: string, opts: unknown) => mockInvoke(name, opts),
    },
  },
}));

const QR_URL =
  'https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaSummary.aspx?chNFe=35260712345678000190650010000012345678901234';

async function simulateScan(url: string) {
  await act(async () => {
    capturedOnCodeScanned?.([{ value: url }]);
    // let the async handleQrScanned's promise chain flush
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('ScanReceiptScreen NFC-e result handling', () => {
  beforeEach(() => {
    mockInvoke.mockClear();
    capturedOnCodeScanned = null;
  });

  it('calls the edge function with the scanned QR url and anonymous id', async () => {
    mockInvoke.mockResolvedValue({
      data: { status: 'processed', storeName: 'Savegnago', totalValue: 87.4, itemCount: 12, savedItemCount: 12 },
      error: null,
    });

    render(<ScanReceiptScreen />);
    await simulateScan(QR_URL);

    expect(mockInvoke).toHaveBeenCalledWith('sefaz-nfce-fetch', {
      body: { qrUrl: QR_URL, anonymousId: 'anon-test-id' },
    });
  });

  it('shows the item count, store, and total on a processed result', async () => {
    mockInvoke.mockResolvedValue({
      data: { status: 'processed', storeName: 'Savegnago', totalValue: 87.4, itemCount: 12, savedItemCount: 12 },
      error: null,
    });

    const { getByText } = render(<ScanReceiptScreen />);
    await simulateScan(QR_URL);

    await waitFor(() => getByText('12 produtos encontrados'));
    expect(getByText('Savegnago — R$ 87,40. Isso ajuda outros consumidores.')).toBeTruthy();
  });

  it('shows the partial-result message when item scraping failed but the total was saved', async () => {
    mockInvoke.mockResolvedValue({
      data: { status: 'partial', storeName: null, totalValue: 87.4, itemCount: 0, savedItemCount: 0 },
      error: null,
    });

    const { getByText } = render(<ScanReceiptScreen />);
    await simulateScan(QR_URL);

    await waitFor(() => getByText('Total registrado'));
    expect(
      getByText('Não conseguimos ler os itens desta nota, mas o valor total (R$ 87,40) foi registrado. Isso ainda ajuda outros consumidores.'),
    ).toBeTruthy();
  });

  it('shows the already-processed message without claiming new items were saved', async () => {
    mockInvoke.mockResolvedValue({
      data: { status: 'already_processed', storeName: null, totalValue: 87.4, itemCount: 12, savedItemCount: 12 },
      error: null,
    });

    const { getByText } = render(<ScanReceiptScreen />);
    await simulateScan(QR_URL);

    await waitFor(() => getByText('Nota já registrada'));
    expect(getByText('Você já registrou os 12 itens desta nota anteriormente.')).toBeTruthy();
  });

  it('shows the São Paulo-only message for an unsupported state', async () => {
    mockInvoke.mockResolvedValue({ data: { error: 'unsupported_state', host: 'www.fazenda.rj.gov.br' }, error: null });

    const { getByText } = render(<ScanReceiptScreen />);
    await simulateScan(QR_URL);

    await waitFor(() => getByText('No momento só oferecemos suporte a notas fiscais de São Paulo.'));
  });

  it('shows a generic error on an edge function failure, and ignores further scans until "Tentar novamente" resets it', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'network error' } });

    const { getByText, getByLabelText } = render(<ScanReceiptScreen />);
    await simulateScan(QR_URL);

    await waitFor(() => getByText('Não foi possível ler a nota fiscal. Tente novamente.'));
    expect(mockInvoke).toHaveBeenCalledTimes(1);

    // Screen is in the 'error' state, not 'scanning' — onCodeScanned no-ops until reset.
    await simulateScan(QR_URL);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    getByText('Não foi possível ler a nota fiscal. Tente novamente.');

    getByLabelText('Tentar novamente');
  });
});
