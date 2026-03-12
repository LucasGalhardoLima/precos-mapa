// mobile/__tests__/components/featured-deals-carousel.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { FeaturedDealsCarousel } from '../../components/featured-deals-carousel';
import type { EnrichedPromotion } from '../../types';

// Mock useFeaturedDeals hook
const mockDeals: EnrichedPromotion[] = [];
jest.mock('../../hooks/use-featured-deals', () => ({
  useFeaturedDeals: () => ({ deals: mockDeals, isLoading: false }),
}));

// Mock Moti animations
jest.mock('moti', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { View } = require('react-native');
  return { MotiView: View };
});

// Mock Badge component
jest.mock('../../components/ui/badge', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Text } = require('react-native');
  return {
    Badge: ({ label }: { label: string }) => <Text>{label}</Text>,
  };
});

function makeDeal(overrides: Partial<EnrichedPromotion> & { id: string }): EnrichedPromotion {
  return {
    product_id: 'p1',
    store_id: 's1',
    promo_price: 5.0,
    original_price: 10.0,
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    status: 'active',
    verified: true,
    source: 'manual',
    created_by: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    product: {
      id: 'p1',
      name: 'Arroz 5kg',
      category_id: 'cat1',
      brand: 'Tio João',
      reference_price: 9.0,
      image_url: null,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
    store: {
      id: 's1',
      name: 'Mercado A',
      chain: 'Rede A',
      address: 'Rua X, 123',
      city: 'SP',
      state: 'SP',
      latitude: -23.5,
      longitude: -46.6,
      phone: null,
      logo_url: null,
      logo_initial: 'M',
      logo_color: '#000000',
      b2b_plan: 'free',
      stripe_customer_id: null,
      stripe_subscription_id: null,
      trial_ends_at: null,
      search_priority: 0,
      is_active: true,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
    discountPercent: 50,
    belowNormalPercent: 44,
    gamificationMessage: '🔥 Preço incrível!',
    distanceKm: 2.5,
    isExpiringSoon: false,
    isBestPrice: false,
    isLocked: false,
    ...overrides,
  } as EnrichedPromotion;
}

describe('FeaturedDealsCarousel', () => {
  beforeEach(() => {
    mockDeals.length = 0;
  });

  it('returns null when no deals', () => {
    const { toJSON } = render(<FeaturedDealsCarousel />);
    expect(toJSON()).toBeNull();
  });

  it('renders header when deals exist', () => {
    mockDeals.push(makeDeal({ id: 'd1' }));
    const { getByText } = render(<FeaturedDealsCarousel />);
    expect(getByText('Ofertas em destaque')).toBeTruthy();
  });

  it('renders product name and store name', () => {
    mockDeals.push(
      makeDeal({
        id: 'd1',
        product: { id: 'p1', name: 'Café Pilão', category_id: 'c1', brand: 'Pilão', reference_price: 12, image_url: null, created_at: '', updated_at: '' },
        store: { id: 's1', name: 'Extra', chain: '', address: '', city: '', state: '', latitude: 0, longitude: 0, phone: null, logo_url: null, logo_initial: 'E', logo_color: '#000000', b2b_plan: 'free', stripe_customer_id: null, stripe_subscription_id: null, trial_ends_at: null, search_priority: 0, is_active: true, created_at: '', updated_at: '' },
      }),
    );
    const { getByText } = render(<FeaturedDealsCarousel />);
    expect(getByText('Café Pilão')).toBeTruthy();
    expect(getByText('Extra')).toBeTruthy();
  });

  it('renders promo price formatted', () => {
    mockDeals.push(makeDeal({ id: 'd1', promo_price: 7.99 }));
    const { getByText } = render(<FeaturedDealsCarousel />);
    expect(getByText('R$ 7.99')).toBeTruthy();
  });

  it('shows discount badge when discountPercent > 0', () => {
    mockDeals.push(makeDeal({ id: 'd1', discountPercent: 30 }));
    const { getByText } = render(<FeaturedDealsCarousel />);
    expect(getByText('-30%')).toBeTruthy();
  });

  it('hides discount badge when discountPercent is 0', () => {
    mockDeals.push(makeDeal({ id: 'd1', discountPercent: 0 }));
    const { queryByText } = render(<FeaturedDealsCarousel />);
    expect(queryByText('-0%')).toBeNull();
  });

  it('renders multiple deals', () => {
    mockDeals.push(
      makeDeal({ id: 'd1', product: { id: 'p1', name: 'Arroz', category_id: 'c1', brand: '', reference_price: 9, image_url: null, created_at: '', updated_at: '' } }),
      makeDeal({ id: 'd2', product: { id: 'p2', name: 'Feijão', category_id: 'c1', brand: '', reference_price: 7, image_url: null, created_at: '', updated_at: '' } }),
    );
    const { getByText } = render(<FeaturedDealsCarousel />);
    expect(getByText('Arroz')).toBeTruthy();
    expect(getByText('Feijão')).toBeTruthy();
  });
});
