import { View, Text, FlatList, Switch, Pressable } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Bell, MapPin, Crown } from 'lucide-react-native';
import { useAlerts } from '@/hooks/use-alerts';
import { useAuthStore } from '@precomapa/shared';
import { Paywall } from '@/components/paywall';
import { Colors } from '@/constants/colors';
import type { AlertWithProduct } from '@/types';

const FREE_ALERT_LIMIT = 3;

export default function AlertsScreen() {
  const { alerts, isLoading, disable, count } = useAlerts();
  const profile = useAuthStore((s) => s.profile);
  const isFree = profile?.b2c_plan === 'free';
  const [showPaywall, setShowPaywall] = useState(false);
  const limitReached = isFree && count >= FREE_ALERT_LIMIT;

  const renderItem = ({ item, index }: { item: AlertWithProduct; index: number }) => (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 300, delay: index * 50 }}
    >
      <View className="bg-white rounded-2xl border border-border p-4 flex-row items-center gap-3">
        <View className="w-10 h-10 bg-brand-green/10 rounded-full items-center justify-center">
          <Bell size={20} color={Colors.brand.green} />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-text-primary">
            {item.product.name}
          </Text>
          {item.target_price && (
            <Text className="text-xs text-text-secondary">
              Alvo: R$ {item.target_price.toFixed(2)}
            </Text>
          )}
          <View className="flex-row items-center gap-1 mt-0.5">
            <MapPin size={10} color={Colors.text.tertiary} />
            <Text className="text-xs text-text-tertiary">
              Raio: {item.radius_km} km
            </Text>
          </View>
        </View>
        <Switch
          value={item.is_active}
          onValueChange={(value) => {
            if (!value) disable(item.id);
          }}
          trackColor={{ false: Colors.border.default, true: Colors.brand.green }}
        />
      </View>
    </MotiView>
  );

  return (
    <SafeAreaView className="flex-1 bg-surface-secondary" edges={['top']}>
      <View className="px-4 pt-6 pb-3">
        <Text className="text-2xl font-bold text-text-primary">
          Alertas de Ofertas
        </Text>
        <Text className="text-sm text-text-secondary mt-1">
          Receba notificacoes quando seus produtos favoritos entrarem em
          promocao
        </Text>
        {isFree && (
          <Pressable
            onPress={() => limitReached && setShowPaywall(true)}
            className="bg-brand-green/10 rounded-lg px-3 py-1.5 mt-2 flex-row items-center gap-1.5 self-start"
          >
            <Text className="text-xs font-semibold text-brand-green">
              {count}/{FREE_ALERT_LIMIT} alertas
            </Text>
            {limitReached && (
              <Crown size={12} color={Colors.brand.green} />
            )}
          </Pressable>
        )}
        {limitReached && (
          <Pressable
            onPress={() => setShowPaywall(true)}
            className="bg-semantic-warning/10 rounded-xl px-4 py-3 mt-2 flex-row items-center gap-2"
          >
            <Crown size={16} color={Colors.brand.orange} />
            <Text className="text-xs text-text-secondary flex-1">
              Limite de alertas atingido.{' '}
              <Text className="text-brand-green font-semibold">
                Faca upgrade
              </Text>{' '}
              para alertas ilimitados.
            </Text>
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View className="gap-3 px-4 mt-2">
          {[0, 1, 2].map((i) => (
            <MotiView
              key={i}
              from={{ opacity: 0.4 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', duration: 800, loop: true }}
              className="bg-white rounded-2xl border border-border p-4 flex-row items-center gap-3"
            >
              <View className="w-10 h-10 bg-border rounded-full" />
              <View className="flex-1 gap-1.5">
                <View className="bg-border rounded-lg h-4 w-2/3" />
                <View className="bg-border rounded-lg h-3 w-1/3" />
              </View>
              <View className="bg-border rounded-full h-8 w-12" />
            </MotiView>
          ))}
        </View>
      ) : !isLoading && alerts.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Bell size={48} color={Colors.text.tertiary} />
          <Text className="text-lg font-semibold text-text-primary mt-4">
            Nenhum alerta ativo
          </Text>
          <Text className="text-sm text-text-secondary text-center mt-2">
            Receba notificacoes quando seus produtos favoritos entrarem em
            promocao perto de voce
          </Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item) => item.id}
          contentContainerClassName="gap-3 px-4 pb-4"
          renderItem={renderItem}
        />
      )}
      <Paywall visible={showPaywall} onClose={() => setShowPaywall(false)} />
    </SafeAreaView>
  );
}
