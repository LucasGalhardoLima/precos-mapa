// mobile/__tests__/components/deal-card.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { DealCard } from '../../components/deal-card';
import type { EnrichedPromotion, Product, Store } from '@/types';

// Mock MotiView — render children without animation
jest.mock('moti', () => ({
  MotiView: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

// Mock lucide icons as simple Text nodes
jest.mock('lucide-react-native', () => ({
  MapPin: () => {
    const { Text } = require('react-native');
    return <Text>MapPin</Text>;
  },
  Clock: () => {
    const { Text } = require('react-native');
    return <Text>Clock</Text>;
  },
}));

// Mock Badge to expose label text
jest.mock('../../components/ui/badge', () => ({
  Badge: ({ label }: { label: string }) => {
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

const makeDeal = (overrides: Partial<EnrichedPromotion> = {}): EnrichedPromotion => ({
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

describe('DealCard', () => {
  it('renders product name', () => {
    const { getByText } = render(<DealCard deal={makeDeal()} />);
    expect(getByText('Leite Integral')).toBeTruthy();
  });

  it('renders product brand when present', () => {
    const { getByText } = render(
      <DealCard deal={makeDeal({ product: makeProduct({ brand: 'Italac' }) })} />,
    );
    expect(getByText('Italac')).toBeTruthy();
  });

  it('does not render brand when null', () => {
    const { queryByText } = render(
      <DealCard deal={makeDeal({ product: makeProduct({ brand: null }) })} />,
    );
    expect(queryByText('Parmalat')).toBeNull();
  });

  it('renders store avatar initial', () => {
    const { getByText } = render(<DealCard deal={makeDeal()} />);
    expect(getByText('M')).toBeTruthy();
  });

  it('renders store name', () => {
    const { getByText } = render(<DealCard deal={makeDeal()} />);
    expect(getByText('Mercado Central')).toBeTruthy();
  });

  it('renders distance in km', () => {
    const { getByText } = render(<DealCard deal={makeDeal({ distanceKm: 3.2 })} />);
    expect(getByText('3.2 km')).toBeTruthy();
  });

  it('shows "Dados básicos" for free b2b stores', () => {
    const { getByText } = render(
      <DealCard deal={makeDeal({ store: makeStore({ b2b_plan: 'free' }) })} />,
    );
    expect(getByText('Dados básicos')).toBeTruthy();
  });

  it('does not show "Dados básicos" for premium stores', () => {
    const { queryByText } = render(
      <DealCard deal={makeDeal({ store: makeStore({ b2b_plan: 'premium' }) })} />,
    );
    expect(queryByText('Dados básicos')).toBeNull();
  });

  it('renders promo price formatted', () => {
    const { getByText } = render(<DealCard deal={makeDeal({ promo_price: 7.0 })} />);
    expect(getByText('R$ 7.00')).toBeTruthy();
  });

  it('renders original price with strikethrough when discounted', () => {
    const { getByText } = render(
      <DealCard deal={makeDeal({ original_price: 10.0, promo_price: 7.0 })} />,
    );
    expect(getByText('R$ 10.00')).toBeTruthy();
  });

  it('does not render original price when equal to promo price', () => {
    const { queryAllByText } = render(
      <DealCard deal={makeDeal({ original_price: 7.0, promo_price: 7.0 })} />,
    );
    // Only one "R$ 7.00" (the promo price), not a second strikethrough one
    expect(queryAllByText('R$ 7.00')).toHaveLength(1);
  });

  it('renders discount badge', () => {
    const { getByText } = render(<DealCard deal={makeDeal({ discountPercent: 30 })} />);
    expect(getByText('-30%')).toBeTruthy();
  });

  it('does not render discount badge when 0%', () => {
    const { queryByText } = render(
      <DealCard deal={makeDeal({ discountPercent: 0, isBestPrice: false })} />,
    );
    expect(queryByText(/-\d+%/)).toBeNull();
  });

  it('renders "Melhor preço" badge', () => {
    const { getByText } = render(<DealCard deal={makeDeal({ isBestPrice: true })} />);
    expect(getByText('Melhor preço')).toBeTruthy();
  });

  it('renders "Verificado" badge when verified', () => {
    const { getByText } = render(<DealCard deal={makeDeal({ verified: true })} />);
    expect(getByText('Verificado')).toBeTruthy();
  });

  it('renders below-normal badge', () => {
    const { getByText } = render(<DealCard deal={makeDeal({ belowNormalPercent: 20 })} />);
    expect(getByText('20% abaixo do normal')).toBeTruthy();
  });

  it('renders "Acaba hoje!" when expiring soon', () => {
    const { getByText } = render(<DealCard deal={makeDeal({ isExpiringSoon: true })} />);
    expect(getByText('Acaba hoje!')).toBeTruthy();
  });

  it('renders gamification message in non-compact mode', () => {
    const { getByText } = render(
      <DealCard deal={makeDeal({ gamificationMessage: 'Você economiza R$3!' })} />,
    );
    expect(getByText('Você economiza R$3!')).toBeTruthy();
  });

  it('hides gamification message in compact mode', () => {
    const { queryByText } = render(
      <DealCard deal={makeDeal({ gamificationMessage: 'Você economiza R$3!' })} compact />,
    );
    expect(queryByText('Você economiza R$3!')).toBeNull();
  });

  it('renders expiry date in non-compact mode', () => {
    const { getByText } = render(
      <DealCard deal={makeDeal({ end_date: '2026-03-15' })} />,
    );
    expect(getByText(/Válido até/)).toBeTruthy();
  });

  it('hides expiry date in compact mode', () => {
    const { queryByText } = render(
      <DealCard deal={makeDeal({ end_date: '2026-03-15' })} compact />,
    );
    expect(queryByText(/Válido até/)).toBeNull();
  });
});
