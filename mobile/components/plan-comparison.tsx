import { View, Text, ScrollView, Modal, Pressable } from 'react-native';
import { useState } from 'react';
import { X, Check, Minus } from 'lucide-react-native';
import { StyledButton } from '@/components/ui/button';
import { Colors } from '@/constants/colors';

interface PlanComparisonProps {
  visible: boolean;
  onClose: () => void;
  onSelectPlan?: (planId: string) => void;
  currentPlan?: string;
}

const TIERS = [
  {
    id: 'free',
    name: 'Gratuito',
    monthly: 0,
    annual: 0,
    features: {
      ofertas: '5/mes',
      importadorIA: false,
      inteligenciaCompetitiva: false,
      analytics: false,
      emailDigest: false,
      prioridade: false,
      suporte: 'Comunidade',
    },
  },
  {
    id: 'premium',
    name: 'Premium',
    monthly: 299,
    annual: 3014,
    features: {
      ofertas: '50/mes',
      importadorIA: '4/mes',
      inteligenciaCompetitiva: 'Basica',
      analytics: false,
      emailDigest: true,
      prioridade: true,
      suporte: 'Email',
    },
  },
  {
    id: 'premium_plus',
    name: 'Premium+',
    monthly: 699,
    annual: 7030,
    features: {
      ofertas: 'Ilimitado',
      importadorIA: 'Ilimitado',
      inteligenciaCompetitiva: 'Completa',
      analytics: true,
      emailDigest: true,
      prioridade: true,
      suporte: 'Prioritario',
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthly: -1,
    annual: -1,
    features: {
      ofertas: 'Ilimitado',
      importadorIA: 'Ilimitado',
      inteligenciaCompetitiva: 'Completa + API',
      analytics: true,
      emailDigest: true,
      prioridade: true,
      suporte: 'Dedicado',
    },
  },
];

const FEATURE_LABELS: Record<string, string> = {
  ofertas: 'Ofertas',
  importadorIA: 'Importador IA',
  inteligenciaCompetitiva: 'Intel. Competitiva',
  analytics: 'Dashboard Analytics',
  emailDigest: 'Email Digest',
  prioridade: 'Prioridade na busca',
  suporte: 'Suporte',
};

function FeatureValue({ value }: { value: string | boolean }) {
  if (value === false) return <Minus size={16} color={Colors.text.tertiary} />;
  if (value === true) return <Check size={16} color={Colors.semantic.success} />;
  return (
    <Text className="text-xs font-medium text-text-primary">{value}</Text>
  );
}

export function PlanComparisonModal({
  visible,
  onClose,
  onSelectPlan,
  currentPlan = 'free',
}: PlanComparisonProps) {
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-white">
        <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
          <Text className="text-xl font-bold text-text-primary">
            Planos B2B
          </Text>
          <Pressable
            onPress={onClose}
            className="w-10 h-10 items-center justify-center"
          >
            <X size={24} color={Colors.text.secondary} />
          </Pressable>
        </View>

        {/* Billing toggle */}
        <View className="flex-row items-center justify-center gap-3 py-3">
          <Pressable onPress={() => setIsAnnual(false)}>
            <Text
              className={`text-sm font-semibold ${
                !isAnnual ? 'text-brand-green' : 'text-text-tertiary'
              }`}
            >
              Mensal
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setIsAnnual(!isAnnual)}
            className={`w-12 h-7 rounded-full justify-center px-0.5 ${
              isAnnual ? 'bg-brand-green' : 'bg-border'
            }`}
          >
            <View
              className={`w-6 h-6 rounded-full bg-white ${
                isAnnual ? 'self-end' : 'self-start'
              }`}
            />
          </Pressable>
          <View className="flex-row items-center gap-1">
            <Pressable onPress={() => setIsAnnual(true)}>
              <Text
                className={`text-sm font-semibold ${
                  isAnnual ? 'text-brand-green' : 'text-text-tertiary'
                }`}
              >
                Anual
              </Text>
            </Pressable>
            <View className="bg-brand-green/10 rounded px-1.5 py-0.5">
              <Text className="text-[10px] font-bold text-brand-green">-16%</Text>
            </View>
          </View>
        </View>

        <ScrollView className="flex-1" contentContainerClassName="px-5 pb-8">
          {TIERS.map((tier) => {
            const isCurrent = tier.id === currentPlan;
            const price = isAnnual ? tier.annual : tier.monthly;
            const priceLabel =
              price === 0
                ? 'Gratis'
                : price === -1
                  ? 'Sob consulta'
                  : `R$ ${price.toLocaleString('pt-BR')}`;
            const period = isAnnual ? '/ano' : '/mes';

            return (
              <View
                key={tier.id}
                className={`rounded-2xl p-4 mb-3 border ${
                  isCurrent
                    ? 'border-brand-green bg-brand-green/5'
                    : 'border-border bg-surface-tertiary'
                }`}
              >
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-base font-bold text-text-primary">
                      {tier.name}
                    </Text>
                    <Text className="text-lg font-bold text-brand-green mt-0.5">
                      {priceLabel}
                      {price > 0 && (
                        <Text className="text-xs font-normal text-text-tertiary">
                          {period}
                        </Text>
                      )}
                    </Text>
                  </View>
                  {isCurrent && (
                    <View className="bg-brand-green rounded-full px-3 py-1">
                      <Text className="text-xs font-bold text-white">Atual</Text>
                    </View>
                  )}
                </View>

                <View className="mt-3 gap-2">
                  {Object.entries(tier.features).map(([key, value]) => (
                    <View key={key} className="flex-row items-center justify-between">
                      <Text className="text-xs text-text-secondary">
                        {FEATURE_LABELS[key]}
                      </Text>
                      <FeatureValue value={value} />
                    </View>
                  ))}
                </View>

                {!isCurrent && tier.id !== 'enterprise' && onSelectPlan && (
                  <StyledButton
                    title={
                      tier.id === 'premium'
                        ? 'Iniciar teste gratis de 7 dias'
                        : `Upgrade para ${tier.name}`
                    }
                    variant="primary"
                    className="mt-4"
                    onPress={() => onSelectPlan(tier.id)}
                  />
                )}

                {tier.id === 'enterprise' && (
                  <StyledButton
                    title="Falar com vendas"
                    variant="outline"
                    className="mt-4"
                    onPress={() => {}}
                  />
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}
