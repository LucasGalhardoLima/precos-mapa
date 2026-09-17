// mobile/__tests__/components/discount-badge.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { DiscountBadge } from '../../components/themed/discount-badge';

// Mock useTheme used by PillBadge
jest.mock('../../theme/use-theme', () => ({
  useTheme: () => ({
    tokens: {
      accentSoft: '#DCFCE7',
      accent: '#22C55E',
      primaryMuted: '#E0F2FE',
      primary: '#3B82F6',
    },
  }),
}));

describe('DiscountBadge', () => {
  it('renders label text for discount variant', () => {
    const { getByText } = render(
      <DiscountBadge label="-30%" variant="discount" />,
    );
    expect(getByText('-30%')).toBeTruthy();
  });

  it('renders label text for highlight variant', () => {
    const { getByText } = render(
      <DiscountBadge label="Melhor preço" variant="highlight" />,
    );
    expect(getByText('Melhor preço')).toBeTruthy();
  });

  it('uses accent colors for discount variant', () => {
    const { getByText } = render(
      <DiscountBadge label="-20%" variant="discount" />,
    );
    const textEl = getByText('-20%');
    expect(textEl.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#22C55E' })]),
    );
  });

  it('uses primary colors for highlight variant', () => {
    const { getByText } = render(
      <DiscountBadge label="Destaque" variant="highlight" />,
    );
    const textEl = getByText('Destaque');
    expect(textEl.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#3B82F6' })]),
    );
  });

  it('renders with arbitrary label content', () => {
    const { getByText } = render(
      <DiscountBadge label="15% abaixo do normal" variant="highlight" />,
    );
    expect(getByText('15% abaixo do normal')).toBeTruthy();
  });
});
