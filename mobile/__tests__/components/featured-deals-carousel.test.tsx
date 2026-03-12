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
    end_date: '2026-12-31',
    status: 'active',
    created_at: '2026-01-01',
    verification_count: 0,
    product: {
      id: 'p1',
      name: 'Arroz 5kg',
      category_id: 'cat1',
      brand: 'Tio João',
      unit: 'kg',
      reference_price: 9.0,
      barcode: null,
      image_url: null,
    },
    store: {
      id: 's1',
      name: 'Mercado A',
      chain: 'Rede A',
      address: 'Rua X, 123',
      city: 'SP',
      state: 'SP',
      zip_code: '01000-000',
      latitude: -23.5,
      longitude: -46.6,
      phone: null,
      opening_hours: null,
      logo_url: null,
      b2b_plan: 'free',
      owner_id: null,
      search_priority: 0,
      is_verified: false,
      neighborhood: null,
      cnpj: null,
      created_at: '2026-01-01',
    },
    discountPercent: 50,
    belowNormalPercent: 44,
    gamificationMessage: '🔥 Preço incrível!',
    distanceKm: 2.5,
    isExpiringSoon: false,
    isBestPrice: false,
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
        product: { id: 'p1', name: 'Café Pilão', category_id: 'c1', brand: 'Pilão', unit: 'g', reference_price: 12, barcode: null, image_url: null },
        store: { id: 's1', name: 'Extra', chain: '', address: '', city: '', state: '', zip_code: '', latitude: 0, longitude: 0, phone: null, opening_hours: null, logo_url: null, b2b_plan: 'free', owner_id: null, search_priority: 0, is_verified: false, neighborhood: null, cnpj: null, created_at: '' },
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
      makeDeal({ id: 'd1', product: { id: 'p1', name: 'Arroz', category_id: 'c1', brand: '', unit: 'kg', reference_price: 9, barcode: null, image_url: null } }),
      makeDeal({ id: 'd2', product: { id: 'p2', name: 'Feijão', category_id: 'c1', brand: '', unit: 'kg', reference_price: 7, barcode: null, image_url: null } }),
    );
    const { getByText } = render(<FeaturedDealsCarousel />);
    expect(getByText('Arroz')).toBeTruthy();
    expect(getByText('Feijão')).toBeTruthy();
  });
});
