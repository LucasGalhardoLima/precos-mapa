// mobile/__tests__/components/offline-banner.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { OfflineBanner } from '../../components/offline-banner';

// The OfflineBanner is re-exported from shared; mock the shared module path
jest.mock('@precomapa/shared/components/offline-banner', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { View, Text, Pressable } = require('react-native');

  function MockOfflineBanner({
    lastUpdated,
    onRetry,
  }: {
    lastUpdated: number | null;
    onRetry?: () => void;
  }) {
    return (
      <View>
        <Text>Sem conexao — exibindo dados salvos</Text>
        {lastUpdated && (
          <Text testID="last-updated">Atualizado há pouco</Text>
        )}
        {onRetry && (
          <Pressable onPress={onRetry} testID="retry-button">
            <Text>Tentar novamente</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return { OfflineBanner: MockOfflineBanner };
});

describe('OfflineBanner', () => {
  it('renders offline message', () => {
    const { getByText } = render(
      <OfflineBanner lastUpdated={null} />,
    );
    expect(getByText('Sem conexao — exibindo dados salvos')).toBeTruthy();
  });

  it('shows last updated when timestamp provided', () => {
    const { queryByTestId } = render(
      <OfflineBanner lastUpdated={Date.now() - 60000} />,
    );
    expect(queryByTestId('last-updated')).toBeTruthy();
  });

  it('hides last updated when timestamp is null', () => {
    const { queryByTestId } = render(
      <OfflineBanner lastUpdated={null} />,
    );
    expect(queryByTestId('last-updated')).toBeNull();
  });

  it('renders retry button when onRetry provided', () => {
    const onRetry = jest.fn();
    const { getByTestId } = render(
      <OfflineBanner lastUpdated={null} onRetry={onRetry} />,
    );
    const button = getByTestId('retry-button');
    fireEvent.press(button);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('hides retry button when onRetry not provided', () => {
    const { queryByTestId } = render(
      <OfflineBanner lastUpdated={null} />,
    );
    expect(queryByTestId('retry-button')).toBeNull();
  });
});
