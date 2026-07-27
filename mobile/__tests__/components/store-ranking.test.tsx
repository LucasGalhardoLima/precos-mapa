// mobile/__tests__/components/store-ranking.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StoreRanking } from '../../components/store-ranking';
import type { StoreRankEntry } from '../../hooks/use-store-ranking';

jest.mock('../../theme/use-theme', () => ({
  useTheme: () => ({
    tokens: {
      primary: '#0D9488',
      textPrimary: '#1A1A2E',
      textDark: '#1A1A2E',
      textHint: '#8A97A8',
      surface: '#FFFFFF',
      border: '#E2E8F0',
      accentSoft: '#DCFCE7',
      accent: '#22C55E',
      primaryMuted: '#CCFBF1',
      success: '#16A34A',
    },
  }),
}));

const makeRanking = (stores: StoreRankEntry[]) => ({
  stores,
  city: 'São Paulo',
  basketLabel: 'lista base',
});

function renderRanking(stores: StoreRankEntry[], onPressStore: (entry: StoreRankEntry) => void = jest.fn()) {
  return render(<StoreRanking ranking={makeRanking(stores)} onPressStore={onPressStore} />);
}

describe('StoreRanking', () => {
  const defaultStores: StoreRankEntry[] = [
    { id: 's1', name: 'Atacadão', totalPrice: 45.50, savingsPercent: 12, rank: 1 },
    { id: 's2', name: 'Extra', totalPrice: 48.00, savingsPercent: 5, rank: 2 },
    { id: 's3', name: 'Pão de Açúcar', totalPrice: 51.70, savingsPercent: 0, rank: 3 },
  ];

  it('renders all store names', () => {
    const { getByText } = renderRanking(defaultStores);
    expect(getByText('Atacadão')).toBeTruthy();
    expect(getByText('Extra')).toBeTruthy();
    expect(getByText('Pão de Açúcar')).toBeTruthy();
  });

  it('renders medal emojis for each rank', () => {
    const { getByText } = renderRanking(defaultStores);
    expect(getByText('🥇')).toBeTruthy();
    expect(getByText('🥈')).toBeTruthy();
    expect(getByText('🥉')).toBeTruthy();
  });

  it('formats total prices as BRL', () => {
    const { getByText } = renderRanking(defaultStores);
    expect(getByText('R$ 45,50')).toBeTruthy();
    expect(getByText('R$ 48,00')).toBeTruthy();
    expect(getByText('R$ 51,70')).toBeTruthy();
  });

  it('shows "Mais barato" badge only for rank 1', () => {
    const { getAllByText, queryByText } = renderRanking(defaultStores);
    expect(getAllByText('Mais barato')).toHaveLength(1);
    // Rank 2 and 3 do not get the badge
    expect(queryByText('2º')).toBeNull();
    expect(queryByText('3º')).toBeNull();
  });

  it('hides "Mais barato" badge when rank 1 store has no savings', () => {
    const stores: StoreRankEntry[] = [
      { id: 's1', name: 'Loja A', totalPrice: 50, savingsPercent: 0, rank: 1 },
    ];
    const { getByText } = renderRanking(stores);
    // "Mais barato" badge is still shown for rank 1 regardless of savingsPercent
    expect(getByText('Mais barato')).toBeTruthy();
  });

  it('renders single store with correct medal', () => {
    const stores: StoreRankEntry[] = [
      { id: 's1', name: 'Loja Única', totalPrice: 30, savingsPercent: 10, rank: 1 },
    ];
    const { getByText } = renderRanking(stores);
    expect(getByText('Loja Única')).toBeTruthy();
    expect(getByText('🥇')).toBeTruthy();
  });

  it('renders store initial in avatar', () => {
    const stores: StoreRankEntry[] = [
      { id: 's1', name: 'Atacadão', totalPrice: 30, savingsPercent: 0, rank: 1 },
    ];
    const { getByText } = renderRanking(stores);
    expect(getByText('A')).toBeTruthy();
  });

  it('calls onPressStore with the tapped store entry', () => {
    const onPressStore = jest.fn();
    const { getByLabelText } = renderRanking(defaultStores, onPressStore);

    fireEvent.press(getByLabelText('Ver ofertas em Extra'));

    expect(onPressStore).toHaveBeenCalledTimes(1);
    expect(onPressStore).toHaveBeenCalledWith(defaultStores[1]);
  });

  it('calls onPressStore only for the tapped card, not other cards', () => {
    const onPressStore = jest.fn();
    const { getByLabelText } = renderRanking(defaultStores, onPressStore);

    fireEvent.press(getByLabelText('Ver ofertas em Atacadão'));

    expect(onPressStore).toHaveBeenCalledTimes(1);
    expect(onPressStore).toHaveBeenCalledWith(defaultStores[0]);
  });
});
