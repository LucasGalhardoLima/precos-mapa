import { View, Text, Pressable } from 'react-native';
import { WifiOff, RefreshCw } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { formatLastUpdated } from '../lib/cache';

interface OfflineBannerProps {
  lastUpdated: number | null;
  onRetry?: () => void;
}

export function OfflineBanner({ lastUpdated, onRetry }: OfflineBannerProps) {
  return (
    <View className="bg-semantic-warning/10 rounded-xl px-4 py-3 mx-4 mt-2 flex-row items-center gap-2">
      <WifiOff size={16} color={Colors.semantic.warning} />
      <View className="flex-1">
        <Text className="text-xs font-semibold text-text-secondary">
          Sem conexao — exibindo dados salvos
        </Text>
        {lastUpdated && (
          <Text className="text-[10px] text-text-tertiary mt-0.5">
            {formatLastUpdated(lastUpdated)}
          </Text>
        )}
      </View>
      {onRetry && (
        <Pressable
          onPress={onRetry}
          className="w-8 h-8 items-center justify-center"
        >
          <RefreshCw size={16} color={Colors.brand.green} />
        </Pressable>
      )}
    </View>
  );
}
