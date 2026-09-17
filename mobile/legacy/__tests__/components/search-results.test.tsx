// mobile/__tests__/components/search-results.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SearchResults } from '../../components/search-results';
import type { EnrichedPromotion, Product, Store } from '@/types';

// Mock useTheme
jest.mock('../../theme/use-theme', () => ({
  useTheme: () => ({
    tokens: {
      surface: '#FFFFFF',
      textPrimary: '#111111',
      textHint: '#999999',
      textSecondary: '#666666',
      primary: '#22C55E',
    },
  }),
}));

// Mock DiscountBadge to simplify testing
jest.mock('../../components/themed/discount-badge', () => ({
  DiscountBadge: ({ label }: { label: string }) => {
    const { Text } = require('react-native');
    return <Text>{label}</Text>;
  },
}));

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'p1',
  name: 'Leite Integral',
  category_id: 'cat1',
  brand: 'Parmalat',
  reference_price: 10.0,
  image_url: null,
  ean: null,
  cosmos_synced_at: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  ...overrides,
});

const makeStore = (overrides: Partial<Store> = {}): Store => ({
  id: 's1',
  name: 'Mercado Central',
  chain: null,
  address: 'Rua A, 123',
  city: 'Matao',
  state: 'SP',
  latitude: -21.6,
  longitude: -48.4,
  logo_url: null,
  logo_initial: 'M',
  logo_color: '#FF0000',
  phone: null,
  b2b_plan: 'free',
  stripe_customer_id: null,
  stripe_subscription_id: null,
  trial_ends_at: null,
  search_priority: 0,
  is_active: true,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  ...overrides,
});

const makePromotion = (overrides: Partial<EnrichedPromotion> = {}): EnrichedPromotion => ({
  id: 'promo-1',
  product_id: 'p1',
  store_id: 's1',
  original_price: 10.0,
  promo_price: 7.0,
  start_date: '2026-03-01',
  end_date: '2026-03-15',
  status: 'active',
  verified: true,
  source: 'manual',
  created_by: null,
  created_at: '2026-03-01',
  updated_at: '2026-03-01',
  product: makeProduct(),
  store: makeStore(),
  discountPercent: 30,
  belowNormalPercent: 30,
  gamificationMessage: null,
  distanceKm: 2.5,
  isExpiringSoon: false,
  isBestPrice: true,
  isLocked: false,
  ...overrides,
});

describe('SearchResults', () => {
  const onPressItem = jest.fn();
  const onPressLocked = jest.fn();

  beforeEach(() => {
    onPressItem.mockClear();
    onPressLocked.mockClear();
  });

  it('renders product name as title', () => {
    const { getByText } = render(
      <SearchResults
        promotions={[makePromotion()]}
        onPressItem={onPressItem}
        onPressLocked={onPressLocked}
      />,
    );
    expect(getByText('Leite Integral')).toBeTruthy();
  });

  it('renders store name in subtitle line', () => {
    const { getByText } = render(
      <SearchResults
        promotions={[makePromotion()]}
        onPressItem={onPressItem}
        onPressLocked={onPressLocked}
      />,
    );
    expect(getByText(/Mercado Central/)).toBeTruthy();
  });

  it('renders promo price formatted as BRL', () => {
    const { getByText } = render(
      <SearchResults
        promotions={[makePromotion()]}
        onPressItem={onPressItem}
        onPressLocked={onPressLocked}
      />,
    );
    expect(getByText('R$ 7,00')).toBeTruthy();
  });

  it('renders original price when discounted', () => {
    const { getByText } = render(
      <SearchResults
        promotions={[makePromotion({ original_price: 10.0, promo_price: 7.0 })]}
        onPressItem={onPressItem}
        onPressLocked={onPressLocked}
      />,
    );
    expect(getByText('R$ 10,00')).toBeTruthy();
  });

  it('does not render original price when equal to promo price', () => {
    const promo = makePromotion({ original_price: 7.0, promo_price: 7.0 });
    const { queryByText } = render(
      <SearchResults
        promotions={[promo]}
        onPressItem={onPressItem}
        onPressLocked={onPressLocked}
      />,
    );
    // Should have promo price but not a separate original price line
    expect(queryByText('R$ 7,00')).toBeTruthy();
  });

  it('renders "Melhor preço" badge when isBestPrice', () => {
    const { getByText } = render(
      <SearchResults
        promotions={[makePromotion({ isBestPrice: true })]}
        onPressItem={onPressItem}
        onPressLocked={onPressLocked}
      />,
    );
    expect(getByText('Melhor preço')).toBeTruthy();
  });

  it('renders discount badge when discountPercent > 0', () => {
    const { getByText } = render(
      <SearchResults
        promotions={[makePromotion({ discountPercent: 30 })]}
        onPressItem={onPressItem}
        onPressLocked={onPressLocked}
      />,
    );
    expect(getByText('-30%')).toBeTruthy();
  });

  it('does not render discount badge when discountPercent is 0', () => {
    const { queryByText } = render(
      <SearchResults
        promotions={[makePromotion({ discountPercent: 0, isBestPrice: false })]}
        onPressItem={onPressItem}
        onPressLocked={onPressLocked}
      />,
    );
    expect(queryByText(/-\d+%/)).toBeNull();
  });

  it('calls onPressItem when tapping unlocked result', () => {
    const promo = makePromotion({ isLocked: false });
    const { getByText } = render(
      <SearchResults
        promotions={[promo]}
        onPressItem={onPressItem}
        onPressLocked={onPressLocked}
      />,
    );
    fireEvent.press(getByText('Leite Integral'));
    expect(onPressItem).toHaveBeenCalledWith(promo);
  });

  it('shows locked overlay for locked results', () => {
    const promo = makePromotion({ isLocked: true });
    const { getByText } = render(
      <SearchResults
        promotions={[promo]}
        onPressItem={onPressItem}
        onPressLocked={onPressLocked}
      />,
    );
    expect(getByText('Assine Plus para ver')).toBeTruthy();
  });

  it('calls onPressLocked when tapping locked result overlay', () => {
    const promo = makePromotion({ isLocked: true });
    const { getByText } = render(
      <SearchResults
        promotions={[promo]}
        onPressItem={onPressItem}
        onPressLocked={onPressLocked}
      />,
    );
    fireEvent.press(getByText('Assine Plus para ver'));
    expect(onPressLocked).toHaveBeenCalled();
  });

  it('renders multiple results', () => {
    const promos = [
      makePromotion({ id: 'pr1', product: makeProduct({ name: 'Leite' }) }),
      makePromotion({ id: 'pr2', product: makeProduct({ id: 'p2', name: 'Pao' }), store: makeStore({ name: 'Padaria' }) }),
    ];
    const { getByText } = render(
      <SearchResults
        promotions={promos}
        onPressItem={onPressItem}
        onPressLocked={onPressLocked}
      />,
    );
    expect(getByText('Leite')).toBeTruthy();
    expect(getByText('Pao')).toBeTruthy();
  });

  it('renders distance in subtitle', () => {
    const { getByText } = render(
      <SearchResults
        promotions={[makePromotion({ distanceKm: 3.2 })]}
        onPressItem={onPressItem}
        onPressLocked={onPressLocked}
      />,
    );
    expect(getByText(/3\.2 km/)).toBeTruthy();
  });
});
