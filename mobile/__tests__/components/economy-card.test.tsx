// mobile/__tests__/components/economy-card.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { EconomyCard } from '../../components/economy-card';

jest.mock('../../theme/use-theme', () => ({
  useTheme: () => ({
    tokens: {
      dark: '#1A1A2E',
      headerText: '#FFFFFF',
      textPrimary: '#1A1A2E',
      textHint: '#8A97A8',
    },
  }),
}));

describe('EconomyCard', () => {
  it('formats savings as BRL', () => {
    const { getByText } = render(
      <EconomyCard totalSavings={42.5} cheapestStore={null} mode="deals" itemCount={3} />,
    );
    expect(getByText('R$ 42,50')).toBeTruthy();
  });

  it('displays subtitle text', () => {
    const { getByText } = render(
      <EconomyCard totalSavings={0} cheapestStore={null} mode="deals" itemCount={0} />,
    );
    expect(getByText('de economia potencial')).toBeTruthy();
  });

  it('shows list mode label with item count', () => {
    const { getByText } = render(
      <EconomyCard totalSavings={10} cheapestStore={null} mode="list" itemCount={5} />,
    );
    expect(getByText('5 itens na lista')).toBeTruthy();
  });

  it('shows deals mode label with deal count', () => {
    const { getByText } = render(
      <EconomyCard totalSavings={10} cheapestStore={null} mode="deals" itemCount={12} />,
    );
    expect(getByText('12 ofertas ativas')).toBeTruthy();
  });

  it('renders cheapest store when provided', () => {
    const { getByText } = render(
      <EconomyCard
        totalSavings={10}
        cheapestStore={{ id: 's1', name: 'Mercado Extra' }}
        mode="deals"
        itemCount={3}
      />,
    );
    expect(getByText('Mercado mais barato:')).toBeTruthy();
    expect(getByText('Mercado Extra')).toBeTruthy();
  });

  it('hides cheapest store section when null', () => {
    const { queryByText } = render(
      <EconomyCard totalSavings={10} cheapestStore={null} mode="deals" itemCount={3} />,
    );
    expect(queryByText('Mercado mais barato:')).toBeNull();
  });

  it('renders compare button when onComparePress provided', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <EconomyCard
        totalSavings={10}
        cheapestStore={null}
        mode="list"
        itemCount={3}
        onComparePress={onPress}
      />,
    );
    const button = getByText('Comparar lista');
    expect(button).toBeTruthy();
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('hides compare button when onComparePress not provided', () => {
    const { queryByText } = render(
      <EconomyCard totalSavings={10} cheapestStore={null} mode="list" itemCount={3} />,
    );
    expect(queryByText('Comparar lista')).toBeNull();
  });

  it('formats zero savings correctly', () => {
    const { getByText } = render(
      <EconomyCard totalSavings={0} cheapestStore={null} mode="deals" itemCount={0} />,
    );
    expect(getByText('R$ 0,00')).toBeTruthy();
  });

  it('formats large savings correctly', () => {
    const { getByText } = render(
      <EconomyCard totalSavings={1234.56} cheapestStore={null} mode="deals" itemCount={50} />,
    );
    expect(getByText('R$ 1234,56')).toBeTruthy();
  });
});
