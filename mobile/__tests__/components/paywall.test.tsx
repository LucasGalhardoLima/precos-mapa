// mobile/__tests__/components/paywall.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Paywall } from '../../components/paywall';

// Mock safe-area — include all component exports that react-native-css-interop accesses
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  const SafeAreaView = ({ children }: { children: React.ReactNode }) => <View>{children}</View>;
  SafeAreaView.displayName = 'SafeAreaView';
  return {
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    SafeAreaView,
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    SafeAreaConsumer: ({ children }: { children: (insets: object) => React.ReactNode }) =>
      children({ top: 0, bottom: 0, left: 0, right: 0 }),
    initialWindowMetrics: { insets: { top: 0, bottom: 0, left: 0, right: 0 }, frame: { x: 0, y: 0, width: 390, height: 844 } },
  };
});

// Mock useTheme
jest.mock('../../theme/use-theme', () => ({
  useTheme: () => ({
    tokens: {
      dark: '#0C1829',
      darkSurface: '#162438',
      primary: '#22C55E',
      warning: '#F59E0B',
      textHint: '#94A3B8',
    },
  }),
}));

// Mock lucide icons — use require() pattern so mocks work after hoisting
jest.mock('lucide-react-native', () => ({
  X: () => { const { Text } = require('react-native'); return <Text>X</Text>; },
  Check: () => { const { Text } = require('react-native'); return <Text>Check</Text>; },
  Minus: () => { const { Text } = require('react-native'); return <Text>Minus</Text>; },
  Sparkles: () => { const { Text } = require('react-native'); return <Text>Sparkles</Text>; },
  TrendingDown: () => { const { Text } = require('react-native'); return <Text>TrendingDown</Text>; },
  Star: () => { const { Text } = require('react-native'); return <Text>Star</Text>; },
  ShieldCheck: () => { const { Text } = require('react-native'); return <Text>ShieldCheck</Text>; },
  Crown: () => { const { Text } = require('react-native'); return <Text>Crown</Text>; },
}));

// Mock DiscountBadge
jest.mock('../../components/themed/discount-badge', () => ({
  DiscountBadge: ({ label }: { label: string }) => {
    const { Text } = require('react-native');
    return <Text>{label}</Text>;
  },
}));

// Mock useSubscription — UI-only, no RevenueCat flows.
// Default returns real-looking packages so the pricing UI renders; tests for
// the unavailable state override this via mockUseSubscription.mockReturnValue.
const mockPurchasePackage = jest.fn();
const mockRestore = jest.fn();
const mockUseSubscription = jest.fn();
jest.mock('../../hooks/use-subscription', () => ({
  useSubscription: () => mockUseSubscription(),
}));

const MOCK_OFFERINGS = {
  current: {
    availablePackages: [
      { identifier: 'plus_monthly', product: { priceString: 'R$ 9,90', price: 9.9 } },
      { identifier: 'plus_annual', product: { priceString: 'R$ 94,80', price: 94.8 } },
    ],
  },
};

describe('Paywall', () => {
  const onClose = jest.fn();

  beforeEach(() => {
    onClose.mockClear();
    mockPurchasePackage.mockClear();
    mockRestore.mockClear();
    mockUseSubscription.mockReturnValue({
      offerings: MOCK_OFFERINGS,
      purchasePackage: mockPurchasePackage,
      restore: mockRestore,
      isLoading: false,
    });
  });

  it('renders hero savings amount', () => {
    const { getByText } = render(<Paywall visible onClose={onClose} />);
    expect(getByText('Economize até R$ 120/mês')).toBeTruthy();
  });

  it('renders branding text', () => {
    const { getByText } = render(<Paywall visible onClose={onClose} />);
    expect(getByText('Economize mais. Sem limites.')).toBeTruthy();
  });

  it('renders comparison table rows', () => {
    const { getByText } = render(<Paywall visible onClose={onClose} />);
    expect(getByText('Comparar mercados')).toBeTruthy();
    expect(getByText('Lista de compras')).toBeTruthy();
    expect(getByText('Histórico de preços')).toBeTruthy();
    expect(getByText('Alertas de preço')).toBeTruthy();
    expect(getByText('Análise de economia')).toBeTruthy();
  });

  it('renders comparison table headers', () => {
    const { getByText, getAllByText } = render(<Paywall visible onClose={onClose} />);
    expect(getByText('Grátis')).toBeTruthy();
    // 'Plus' appears in both the hero title and the comparison header
    expect(getAllByText('Plus').length).toBeGreaterThanOrEqual(1);
  });

  it('renders free column values', () => {
    const { getByText } = render(<Paywall visible onClose={onClose} />);
    expect(getByText('limitado')).toBeTruthy();
    expect(getByText('limitada')).toBeTruthy();
  });

  it('renders plus column values', () => {
    const { getByText } = render(<Paywall visible onClose={onClose} />);
    expect(getByText('Todos')).toBeTruthy();
    expect(getByText('Ilimitada')).toBeTruthy();
    expect(getByText('90 dias')).toBeTruthy();
  });

  it('renders pricing cycle labels', () => {
    const { getByText } = render(<Paywall visible onClose={onClose} />);
    expect(getByText('Mensal')).toBeTruthy();
    expect(getByText('Anual')).toBeTruthy();
  });

  it('shows real package prices from offerings', () => {
    const { getByText } = render(<Paywall visible onClose={onClose} />);
    expect(getByText('R$ 9,90')).toBeTruthy();
    expect(getByText('R$ 7,90')).toBeTruthy();
    expect(getByText('R$ 94,80/ano')).toBeTruthy();
  });

  it('shows an unavailable message instead of a price when no packages are offered', () => {
    // App Store compliance: never show a price that might not match what
    // StoreKit actually charges — when RevenueCat has no packages loaded,
    // the paywall must show an explicit unavailable state, not a fallback price.
    mockUseSubscription.mockReturnValue({
      offerings: null,
      purchasePackage: mockPurchasePackage,
      restore: mockRestore,
      isLoading: false,
    });
    const { getByText, queryByText } = render(<Paywall visible onClose={onClose} />);
    expect(getByText(/Assinatura indisponível no momento/)).toBeTruthy();
    expect(queryByText('R$ 9,90')).toBeNull();
    expect(queryByText('Experimentar 7 dias grátis')).toBeNull();
  });

  it('shows a loading indicator while offerings are loading', () => {
    mockUseSubscription.mockReturnValue({
      offerings: null,
      purchasePackage: mockPurchasePackage,
      restore: mockRestore,
      isLoading: true,
    });
    const { queryByText } = render(<Paywall visible onClose={onClose} />);
    expect(queryByText(/Assinatura indisponível no momento/)).toBeNull();
    expect(queryByText('Experimentar 7 dias grátis')).toBeNull();
  });

  it('renders CTA button text', () => {
    const { getByText } = render(<Paywall visible onClose={onClose} />);
    expect(getByText('Experimentar 7 dias grátis')).toBeTruthy();
  });

  it('renders restore button', () => {
    const { getByText } = render(<Paywall visible onClose={onClose} />);
    expect(getByText('Restaurar compras')).toBeTruthy();
  });

  it('renders discount badge on annual card', () => {
    const { getByText } = render(<Paywall visible onClose={onClose} />);
    expect(getByText('-20%')).toBeTruthy();
  });

  it('switches to monthly cycle when pressed', () => {
    const { getByText } = render(<Paywall visible onClose={onClose} />);
    fireEvent.press(getByText('Mensal'));
    // After pressing, the monthly card should still render
    expect(getByText('R$ 9,90')).toBeTruthy();
  });
});
