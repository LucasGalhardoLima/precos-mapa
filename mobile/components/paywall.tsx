import { View, Text, Modal, Pressable, ActivityIndicator, Alert } from 'react-native';
import { X, Check, Crown, Users } from 'lucide-react-native';
import { useSubscription } from '@/hooks/use-subscription';
import { StyledButton } from '@/components/ui/button';
import { Colors } from '@/constants/colors';

interface PaywallProps {
  visible: boolean;
  onClose: () => void;
}

const PLUS_FEATURES = [
  'Favoritos ilimitados',
  'Alertas ilimitados',
  'Sem anuncios',
  'Listas de compras inteligentes',
  'Historico de precos',
  'Comparacao ilimitada',
];

const FAMILY_FEATURES = [
  'Tudo do Plus',
  'Ate 5 membros da familia',
  'Listas compartilhadas',
  'Notificacoes em grupo',
];

export function Paywall({ visible, onClose }: PaywallProps) {
  const { offerings, purchasePackage, restore, isLoading } = useSubscription();

  const plusPackage = offerings?.current?.availablePackages.find(
    (p) => p.identifier === 'plus_monthly' || p.identifier === '$rc_monthly',
  );
  const familyPackage = offerings?.current?.availablePackages.find(
    (p) => p.identifier === 'family_monthly',
  );

  const handlePurchase = async (pkg: typeof plusPackage) => {
    if (!pkg) {
      Alert.alert('Indisponivel', 'Assinatura nao disponivel no momento.');
      return;
    }
    const success = await purchasePackage(pkg);
    if (success) {
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-white">
        <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
          <Text className="text-xl font-bold text-text-primary">
            Desbloqueie tudo
          </Text>
          <Pressable
            onPress={onClose}
            className="w-10 h-10 items-center justify-center"
          >
            <X size={24} color={Colors.text.secondary} />
          </Pressable>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={Colors.brand.green} />
          </View>
        ) : (
          <View className="flex-1 px-5 pt-4">
            {/* Plus tier */}
            <View className="border border-brand-green rounded-2xl p-5 mb-4">
              <View className="flex-row items-center gap-2 mb-3">
                <Crown size={20} color={Colors.brand.green} />
                <Text className="text-lg font-bold text-text-primary">Plus</Text>
              </View>
              <Text className="text-2xl font-bold text-brand-green">
                R$ 9,90
                <Text className="text-sm font-normal text-text-tertiary">/mes</Text>
              </Text>
              <Text className="text-xs text-text-secondary mt-1">
                ou R$ 99/ano (economize 16%)
              </Text>

              <View className="mt-4 gap-2">
                {PLUS_FEATURES.map((feature) => (
                  <View key={feature} className="flex-row items-center gap-2">
                    <Check size={16} color={Colors.semantic.success} />
                    <Text className="text-sm text-text-primary">{feature}</Text>
                  </View>
                ))}
              </View>

              <StyledButton
                title="Iniciar teste gratis de 7 dias"
                variant="primary"
                className="mt-5"
                onPress={() => handlePurchase(plusPackage)}
              />
            </View>

            {/* Family tier */}
            <View className="border border-border rounded-2xl p-5 mb-4">
              <View className="flex-row items-center gap-2 mb-3">
                <Users size={20} color={Colors.brand.orange} />
                <Text className="text-lg font-bold text-text-primary">Family</Text>
              </View>
              <Text className="text-2xl font-bold text-brand-orange">
                R$ 19,90
                <Text className="text-sm font-normal text-text-tertiary">/mes</Text>
              </Text>
              <Text className="text-xs text-text-secondary mt-1">
                ou R$ 199/ano (economize 16%)
              </Text>

              <View className="mt-4 gap-2">
                {FAMILY_FEATURES.map((feature) => (
                  <View key={feature} className="flex-row items-center gap-2">
                    <Check size={16} color={Colors.semantic.success} />
                    <Text className="text-sm text-text-primary">{feature}</Text>
                  </View>
                ))}
              </View>

              <StyledButton
                title="Assinar Family"
                variant="outline"
                className="mt-5"
                onPress={() => handlePurchase(familyPackage)}
              />
            </View>

            {/* Restore purchases */}
            <Pressable onPress={restore} className="py-3">
              <Text className="text-sm text-brand-green text-center font-medium">
                Restaurar compras anteriores
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}
