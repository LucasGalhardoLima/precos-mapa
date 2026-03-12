// mobile/__tests__/components/store-ranking.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { StoreRanking } from '../../components/store-ranking';

jest.mock('../../theme/use-theme', () => ({
  useTheme: () => ({
    tokens: {
      primary: '#0D9488',
      textPrimary: '#1A1A2E',
      textHint: '#8A97A8',
      surface: '#FFFFFF',
      border: '#E2E8F0',
      accentSoft: '#DCFCE7',
      accent: '#22C55E',
      primaryMuted: '#CCFBF1',
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

  it('renders header and city', () => {
    const { getByText } = render(
      <StoreRanking ranking={makeRanking(defaultStores)} />,
    );
    expect(getByText('Ranking da semana')).toBeTruthy();
    expect(getByText('mais baratos · São Paulo')).toBeTruthy();
  });

  it('renders all store names', () => {
    const { getByText } = render(
      <StoreRanking ranking={makeRanking(defaultStores)} />,
    );
    expect(getByText('Atacadão')).toBeTruthy();
    expect(getByText('Extra')).toBeTruthy();
    expect(getByText('Pão de Açúcar')).toBeTruthy();
  });

  it('renders rank positions with ordinal suffix', () => {
    const { getByText } = render(
      <StoreRanking ranking={makeRanking(defaultStores)} />,
    );
    expect(getByText('1º')).toBeTruthy();
    expect(getByText('2º')).toBeTruthy();
    expect(getByText('3º')).toBeTruthy();
  });

  it('formats total prices as BRL', () => {
    const { getByText } = render(
      <StoreRanking ranking={makeRanking(defaultStores)} />,
    );
    expect(getByText('R$ 45,50')).toBeTruthy();
    expect(getByText('R$ 48,00')).toBeTruthy();
    expect(getByText('R$ 51,70')).toBeTruthy();
  });

  it('shows discount badge only for rank 1 with savingsPercent > 0', () => {
    const { getByText, queryByText } = render(
      <StoreRanking ranking={makeRanking(defaultStores)} />,
    );
    // Rank 1 with 12% savings should show badge
    expect(getByText('-12%')).toBeTruthy();
    // Rank 2 and 3 should NOT show badges (even though rank 2 has 5%)
    // DiscountBadge only renders for rank === 1
    // We can verify by checking that -5% and -0% don't appear
    expect(queryByText('-5%')).toBeNull();
    expect(queryByText('-0%')).toBeNull();
  });

  it('hides discount badge for rank 1 when savingsPercent is 0', () => {
    const stores = [
      { id: 's1', name: 'Loja A', totalPrice: 50, savingsPercent: 0, rank: 1 as const },
    ];
    const { queryByText } = render(
      <StoreRanking ranking={makeRanking(stores)} />,
    );
    expect(queryByText('-0%')).toBeNull();
  });

  it('renders single store', () => {
    const stores = [
      { id: 's1', name: 'Loja Única', totalPrice: 30, savingsPercent: 10, rank: 1 as const },
    ];
    const { getByText } = render(
      <StoreRanking ranking={makeRanking(stores)} />,
    );
    expect(getByText('Loja Única')).toBeTruthy();
    expect(getByText('1º')).toBeTruthy();
  });

  it('shows "total da lista base" label for each row', () => {
    const stores = [
      { id: 's1', name: 'A', totalPrice: 30, savingsPercent: 0, rank: 1 as const },
      { id: 's2', name: 'B', totalPrice: 35, savingsPercent: 0, rank: 2 as const },
    ];
    const { getAllByText } = render(
      <StoreRanking ranking={makeRanking(stores)} />,
    );
    expect(getAllByText('total da lista base')).toHaveLength(2);
  });
});
