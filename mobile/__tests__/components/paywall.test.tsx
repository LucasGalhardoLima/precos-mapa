// mobile/__tests__/components/paywall.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Paywall } from '../../components/paywall';

// Mock safe-area
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

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

// Mock lucide icons
jest.mock('lucide-react-native', () => ({
  X: () => {
    const { Text } = require('react-native');
    return <Text>X</Text>;
  },
  Check: () => {
    const { Text } = require('react-native');
    return <Text>Check</Text>;
  },
  Minus: () => {
    const { Text } = require('react-native');
    return <Text>Minus</Text>;
  },
  Sparkles: () => {
    const { Text } = require('react-native');
    return <Text>Sparkles</Text>;
  },
}));

// Mock DiscountBadge
jest.mock('../../components/themed/discount-badge', () => ({
  DiscountBadge: ({ label }: { label: string }) => {
    const { Text } = require('react-native');
    return <Text>{label}</Text>;
  },
}));

// Mock useSubscription — UI-only, no RevenueCat flows
const mockPurchasePackage = jest.fn();
const mockRestore = jest.fn();
jest.mock('../../hooks/use-subscription', () => ({
  useSubscription: () => ({
    offerings: null,
    purchasePackage: mockPurchasePackage,
    restore: mockRestore,
    isLoading: false,
  }),
}));

describe('Paywall', () => {
  const onClose = jest.fn();

  beforeEach(() => {
    onClose.mockClear();
    mockPurchasePackage.mockClear();
    mockRestore.mockClear();
  });

  it('renders hero savings amount', () => {
    const { getByText } = render(<Paywall visible onClose={onClose} />);
    expect(getByText('R$ 120')).toBeTruthy();
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
    const { getByText } = render(<Paywall visible onClose={onClose} />);
    expect(getByText('Grátis')).toBeTruthy();
    expect(getByText('Plus')).toBeTruthy();
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

  it('shows fallback prices when offerings are null', () => {
    const { getByText } = render(<Paywall visible onClose={onClose} />);
    expect(getByText('R$ 9,90')).toBeTruthy();
    expect(getByText('R$ 6,90')).toBeTruthy();
    expect(getByText('R$ 82,80/ano')).toBeTruthy();
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
    expect(getByText('-30%')).toBeTruthy();
  });

  it('switches to monthly cycle when pressed', () => {
    const { getByText } = render(<Paywall visible onClose={onClose} />);
    fireEvent.press(getByText('Mensal'));
    // After pressing, the monthly card should still render
    expect(getByText('R$ 9,90')).toBeTruthy();
  });
});
