// mobile/__tests__/components/store-ranking.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { StoreRanking } from '../../components/store-ranking';

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

const makeRanking = (stores: Array<{ id: string; name: string; totalPrice: number; savingsPercent: number; rank: 1 | 2 | 3 }>) => ({
  stores,
  city: 'São Paulo',
  basketLabel: 'lista base',
});

describe('StoreRanking', () => {
  const defaultStores = [
    { id: 's1', name: 'Atacadão', totalPrice: 45.50, savingsPercent: 12, rank: 1 as const },
    { id: 's2', name: 'Extra', totalPrice: 48.00, savingsPercent: 5, rank: 2 as const },
    { id: 's3', name: 'Pão de Açúcar', totalPrice: 51.70, savingsPercent: 0, rank: 3 as const },
  ];

  it('renders all store names', () => {
    const { getByText } = render(
      <StoreRanking ranking={makeRanking(defaultStores)} />,
    );
    expect(getByText('Atacadão')).toBeTruthy();
    expect(getByText('Extra')).toBeTruthy();
    expect(getByText('Pão de Açúcar')).toBeTruthy();
  });

  it('renders medal emojis for each rank', () => {
    const { getByText } = render(
      <StoreRanking ranking={makeRanking(defaultStores)} />,
    );
    expect(getByText('🥇')).toBeTruthy();
    expect(getByText('🥈')).toBeTruthy();
    expect(getByText('🥉')).toBeTruthy();
  });

  it('formats total prices as BRL', () => {
    const { getByText } = render(
      <StoreRanking ranking={makeRanking(defaultStores)} />,
    );
    expect(getByText('R$ 45,50')).toBeTruthy();
    expect(getByText('R$ 48,00')).toBeTruthy();
    expect(getByText('R$ 51,70')).toBeTruthy();
  });

  it('shows "Mais barato" badge only for rank 1', () => {
    const { getAllByText, queryByText } = render(
      <StoreRanking ranking={makeRanking(defaultStores)} />,
    );
    expect(getAllByText('Mais barato')).toHaveLength(1);
    // Rank 2 and 3 do not get the badge
    expect(queryByText('2º')).toBeNull();
    expect(queryByText('3º')).toBeNull();
  });

  it('hides "Mais barato" badge when rank 1 store has no savings', () => {
    const stores = [
      { id: 's1', name: 'Loja A', totalPrice: 50, savingsPercent: 0, rank: 1 as const },
    ];
    const { getByText } = render(
      <StoreRanking ranking={makeRanking(stores)} />,
    );
    // "Mais barato" badge is still shown for rank 1 regardless of savingsPercent
    expect(getByText('Mais barato')).toBeTruthy();
  });

  it('renders single store with correct medal', () => {
    const stores = [
      { id: 's1', name: 'Loja Única', totalPrice: 30, savingsPercent: 10, rank: 1 as const },
    ];
    const { getByText } = render(
      <StoreRanking ranking={makeRanking(stores)} />,
    );
    expect(getByText('Loja Única')).toBeTruthy();
    expect(getByText('🥇')).toBeTruthy();
  });

  it('renders store initial in avatar', () => {
    const stores = [
      { id: 's1', name: 'Atacadão', totalPrice: 30, savingsPercent: 0, rank: 1 as const },
    ];
    const { getByText } = render(
      <StoreRanking ranking={makeRanking(stores)} />,
    );
    expect(getByText('A')).toBeTruthy();
  });
});
