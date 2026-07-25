// mobile/__tests__/screens/scan.test.tsx
//
// Regression tests for the price-report submit flow (mirrors
// __tests__/e2e/consumer-scan-manual-entry.yaml for the unmatched-EAN path;
// the matched-product, store-attribution, and error paths below have no
// Maestro equivalent since they depend on seeded catalog/store data). A
// geofence hard-reject was considered and deliberately rejected: scanning is
// a legitimate action away from any store too (checking a product at home
// before shopping, browsing a pantry item), not just an in-store price
// report — so a report with no nearby store must still save, just without a
// store_id, in every location state (resolved or not).
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ScanScreen from '../../app/scan';
import type { Product } from '@/types';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

jest.mock('react-native-vision-camera', () => ({
  Camera: () => null,
  useCameraDevice: () => null,
  useCameraPermission: () => ({ hasPermission: false, requestPermission: jest.fn() }),
  useCodeScanner: () => ({}),
}));

jest.mock('lucide-react-native', () => {
  const { Text } = require('react-native');
  const icon = (name: string) => () => <Text>{name}</Text>;
  return {
    X: icon('X'),
    Keyboard: icon('Keyboard'),
    CircleCheckBig: icon('CircleCheckBig'),
    CameraOff: icon('CameraOff'),
    Package: icon('Package'),
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

const mockUseLocation = jest.fn();
jest.mock('../../hooks/use-location', () => ({
  useLocation: () => mockUseLocation(),
  calculateDistanceKm: () => 0,
}));

jest.mock('@poup/shared', () => ({
  getAnonymousId: () => Promise.resolve('anon-test-id'),
}));

// Mutable per-test fixtures — set in beforeEach/individual tests, read by
// the supabase.from() mock below. Names must start with `mock` so Jest's
// module-factory hoisting allows referencing them from inside jest.mock().
// calculateDistanceKm is mocked to always return 0, so any row returned
// from `stores` is treated as the nearest store (0km <= NEAREST_STORE_MAX_KM).
let mockProductData: Product | null = null;
let mockStoresData: { id: string; latitude: number; longitude: number }[] = [];
let mockStorePriceData: { price: number } | null = null;
let mockInsertResult: { error: { code?: string; message?: string } | null } = { error: null };

const mockInsert = jest.fn((_row: Record<string, unknown>) => Promise.resolve(mockInsertResult));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'products') {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: mockProductData, error: null }) }) }) };
      }
      if (table === 'stores') {
        return { select: () => ({ eq: () => Promise.resolve({ data: mockStoresData }) }) };
      }
      if (table === 'store_prices') {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: mockStorePriceData, error: null }) }) }),
          }),
        };
      }
      if (table === 'price_reports') {
        return { insert: mockInsert };
      }
      return { select: () => ({ eq: () => Promise.resolve({ data: [] }) }) };
    },
  },
}));

const NEARBY_STORE_ID = 'store-nearby-1';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'product-1',
    name: 'Arroz Tipo 1 5kg',
    category_id: 'cat_alimentos',
    brand: 'Tio João',
    reference_price: 24.9,
    image_url: null,
    ean: '9999999999999',
    cosmos_synced_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

async function scanEan(getByText: any, getByLabelText: any, getByPlaceholderText: any, ean: string) {
  fireEvent.press(getByText('Digitar código manualmente'));
  fireEvent.changeText(getByPlaceholderText('Digite o código de barras'), ean);
  await waitFor(() => getByLabelText('Buscar produto'));
  fireEvent.press(getByLabelText('Buscar produto'));
}

describe('ScanScreen manual price report submission', () => {
  beforeEach(() => {
    mockInsert.mockClear();
    mockProductData = null;
    mockStoresData = [];
    mockStorePriceData = null;
    mockInsertResult = { error: null };
    // hasResolvedLocation: false — the state a fresh install with no
    // location permission is actually in (no city geocoded, none selected).
    mockUseLocation.mockReturnValue({
      latitude: -21.6033,
      longitude: -48.3658,
      hasResolvedLocation: false,
    });
  });

  it('submits a manually-entered price when location has not resolved', async () => {
    const { getByText, getByLabelText, getByPlaceholderText } = render(<ScanScreen />);

    await scanEan(getByText, getByLabelText, getByPlaceholderText, '9999999999999');

    await waitFor(() => getByText('Produto não encontrado'));

    fireEvent.changeText(getByLabelText('Preço do produto'), '1299');
    fireEvent.press(getByLabelText('Confirmar preço'));

    await waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(1));
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ ean: '9999999999999', store_id: null, product_id: null, price: 12.99 }),
    );
  });

  it('still submits (with store_id null) once location has resolved and no store is nearby', async () => {
    mockUseLocation.mockReturnValue({
      latitude: -21.6033,
      longitude: -48.3658,
      hasResolvedLocation: true, // resolved, and the stores query above returns [] -> no nearby store
    });

    const { getByText, getByLabelText, getByPlaceholderText } = render(<ScanScreen />);

    await scanEan(getByText, getByLabelText, getByPlaceholderText, '9999999999999');

    await waitFor(() => getByText('Produto não encontrado'));

    fireEvent.changeText(getByLabelText('Preço do produto'), '1299');
    fireEvent.press(getByLabelText('Confirmar preço'));

    await waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(1));
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ ean: '9999999999999', store_id: null, price: 12.99 }),
    );
  });

  it('shows the matched product and pre-fills the reference price when no nearby store price exists', async () => {
    mockProductData = makeProduct();

    const { getByText, getByLabelText, getByPlaceholderText } = render(<ScanScreen />);

    await scanEan(getByText, getByLabelText, getByPlaceholderText, '9999999999999');

    await waitFor(() => getByText('Arroz Tipo 1 5kg'));
    expect(getByText('EAN 9999999999999')).toBeTruthy();
    // reference_price 24.90 pre-filled as the price input's value
    expect(getByLabelText('Preço do produto').props.value).toBe('24,90');

    fireEvent.press(getByLabelText('Confirmar preço'));

    await waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(1));
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ ean: '9999999999999', product_id: 'product-1', store_id: null, price: 24.9 }),
    );
  });

  it('attributes the report to the nearest store and prefers its store_prices over reference_price', async () => {
    mockUseLocation.mockReturnValue({
      latitude: -21.6033,
      longitude: -48.3658,
      hasResolvedLocation: true,
    });
    mockProductData = makeProduct();
    mockStoresData = [{ id: NEARBY_STORE_ID, latitude: -21.6033, longitude: -48.3658 }];
    mockStorePriceData = { price: 22.5 };

    const { getByText, getByLabelText, getByPlaceholderText } = render(<ScanScreen />);

    await scanEan(getByText, getByLabelText, getByPlaceholderText, '9999999999999');

    await waitFor(() => getByText('Arroz Tipo 1 5kg'));
    // store_prices (22.50) wins over reference_price (24.90)
    await waitFor(() => expect(getByLabelText('Preço do produto').props.value).toBe('22,50'));

    fireEvent.press(getByLabelText('Confirmar preço'));

    await waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(1));
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ product_id: 'product-1', store_id: NEARBY_STORE_ID, price: 22.5 }),
    );
  });

  it('shows the confirmation banner and closes the sheet after a successful submit', async () => {
    mockProductData = makeProduct();

    const { getByText, getByLabelText, getByPlaceholderText, queryByText } = render(<ScanScreen />);

    await scanEan(getByText, getByLabelText, getByPlaceholderText, '9999999999999');
    await waitFor(() => getByText('Arroz Tipo 1 5kg'));

    fireEvent.press(getByLabelText('Confirmar preço'));

    await waitFor(() =>
      expect(getByText('Você contribuiu com o preço de Arroz Tipo 1 5kg! Isso ajuda outros consumidores.')).toBeTruthy(),
    );
    // The price sheet closed — the matched product name is no longer rendered inside it.
    expect(queryByText('EAN 9999999999999')).toBeNull();
  });

  it('shows a friendly message and keeps the sheet open on a duplicate report (unique constraint violation)', async () => {
    mockInsertResult = { error: { code: '23505', message: 'duplicate key value violates unique constraint' } };

    const { getByText, getByLabelText, getByPlaceholderText } = render(<ScanScreen />);

    await scanEan(getByText, getByLabelText, getByPlaceholderText, '9999999999999');
    await waitFor(() => getByText('Produto não encontrado'));

    fireEvent.changeText(getByLabelText('Preço do produto'), '1299');
    fireEvent.press(getByLabelText('Confirmar preço'));

    await waitFor(() => getByText('Você já reportou o preço deste produto hoje.'));
    // Sheet stays open for retry — the manual-entry EAN state wasn't reset.
    expect(getByText('Código 9999999999999 — sem correspondência no catálogo')).toBeTruthy();
  });

  it('shows a generic error message on any other insert failure', async () => {
    mockInsertResult = { error: { code: '500', message: 'network error' } };

    const { getByText, getByLabelText, getByPlaceholderText } = render(<ScanScreen />);

    await scanEan(getByText, getByLabelText, getByPlaceholderText, '9999999999999');
    await waitFor(() => getByText('Produto não encontrado'));

    fireEvent.changeText(getByLabelText('Preço do produto'), '1299');
    fireEvent.press(getByLabelText('Confirmar preço'));

    await waitFor(() => getByText('Não foi possível salvar. Tente novamente.'));
  });
});
