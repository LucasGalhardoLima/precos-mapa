import { View, Text, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { BarChart3, Tag, Eye, TrendingUp, Trophy, Lock } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@precomapa/shared';
import { useCompetitive } from '@/hooks/use-competitive';
import { StyledButton } from '@/components/ui/button';
import { Colors } from '@/constants/colors';

const PLAN_LIMITS: Record<string, { promotions: number; label: string }> = {
  free: { promotions: 5, label: 'Gratuito' },
  premium: { promotions: 50, label: 'Premium' },
  premium_plus: { promotions: -1, label: 'Premium+' },
  enterprise: { promotions: -1, label: 'Enterprise' },
};

export default function BusinessDashboard() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const [store, setStore] = useState<any>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [activeCount, setActiveCount] = useState(0);
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [storeCount, setStoreCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const competitive = useCompetitive(storeId);

  useEffect(() => {
    async function fetchDashboard() {
      if (!session?.user) return;

      // Get user's store
      const { data: member } = await supabase
        .from('store_members')
        .select('store_id')
        .eq('user_id', session.user.id)
        .single();

      if (!member) {
        // Super admin has no store membership — show aggregate view
        if (profile?.role === 'super_admin') {
          setIsSuperAdmin(true);

          const [activeRes, monthlyRes, storesRes] = await Promise.all([
            supabase
              .from('promotions')
              .select('*', { count: 'exact', head: true })
              .eq('status', 'active'),
            supabase
              .from('promotions')
              .select('*', { count: 'exact', head: true })
              .gte('created_at', getMonthStart()),
            supabase
              .from('stores')
              .select('*', { count: 'exact', head: true })
              .eq('is_active', true),
          ]);

          setActiveCount(activeRes.count ?? 0);
          setMonthlyCount(monthlyRes.count ?? 0);
          setStoreCount(storesRes.count ?? 0);
        }
        setIsLoading(false);
        return;
      }

      const sid = member.store_id;
      setStoreId(sid);

      const [storeRes, activeRes, monthlyRes] = await Promise.all([
        supabase.from('stores').select('*').eq('id', sid).single(),
        supabase
          .from('promotions')
          .select('*', { count: 'exact', head: true })
          .eq('store_id', sid)
          .eq('status', 'active'),
        supabase
          .from('promotions')
          .select('*', { count: 'exact', head: true })
          .eq('store_id', sid)
          .gte('created_at', getMonthStart()),
      ]);

      if (storeRes.data) setStore(storeRes.data);
      setActiveCount(activeRes.count ?? 0);
      setMonthlyCount(monthlyRes.count ?? 0);
      setIsLoading(false);
    }

    fetchDashboard();
  }, [session, profile]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color={Colors.brand.green} />
      </SafeAreaView>
    );
  }

  // Super admin aggregate view
  if (isSuperAdmin) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <ScrollView className="flex-1" contentContainerClassName="px-5 pt-6 pb-8">
          <Text className="text-2xl font-bold text-text-primary">Dashboard</Text>
          <Text className="text-sm text-text-secondary mt-1">
            Visao geral da plataforma
          </Text>

          <View className="bg-purple-100 rounded-lg px-3 py-1.5 mt-4 self-start">
            <Text className="text-xs font-semibold text-purple-700">
              Super Admin
            </Text>
          </View>

          <View className="flex-row gap-3 mt-6">
            <KPICard
              icon={<Tag size={20} color={Colors.brand.green} />}
              value={String(activeCount)}
              label="Ofertas ativas"
            />
            <KPICard
              icon={<BarChart3 size={20} color={Colors.brand.orange} />}
              value={String(monthlyCount)}
              label="Ofertas este mes"
            />
          </View>

          <View className="flex-row gap-3 mt-3">
            <KPICard
              icon={<Eye size={20} color={Colors.semantic.info} />}
              value={String(storeCount)}
              label="Mercados ativos"
            />
            <KPICard
              icon={<TrendingUp size={20} color={Colors.semantic.success} />}
              value="--"
              label="Usuarios"
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const planInfo = PLAN_LIMITS[store?.b2b_plan ?? 'free'];
  const isFree = store?.b2b_plan === 'free';
  const monthlyLimit = planInfo.promotions;
  const usageText =
    monthlyLimit === -1
      ? `${monthlyCount} ofertas este mes`
      : `${monthlyCount}/${monthlyLimit} ofertas este mes`;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1" contentContainerClassName="px-5 pt-6 pb-8">
        <Text className="text-2xl font-bold text-text-primary">Dashboard</Text>
        <Text className="text-sm text-text-secondary mt-1">
          {store?.name ?? 'Sua loja'}
        </Text>

        {/* Plan Badge */}
        <View className="bg-brand-green/10 rounded-lg px-3 py-1.5 mt-4 self-start">
          <Text className="text-xs font-semibold text-brand-green">
            Plano {planInfo.label}
          </Text>
        </View>

        {/* KPI Cards */}
        <View className="flex-row gap-3 mt-6">
          <KPICard
            icon={<Tag size={20} color={Colors.brand.green} />}
            value={String(activeCount)}
            label="Ofertas ativas"
          />
          <KPICard
            icon={<BarChart3 size={20} color={Colors.brand.orange} />}
            value={usageText}
            label="Uso mensal"
          />
        </View>

        <View className="flex-row gap-3 mt-3">
          <KPICard
            icon={<Eye size={20} color={Colors.semantic.info} />}
            value="--"
            label="Visualizacoes"
          />
          <KPICard
            icon={<TrendingUp size={20} color={Colors.semantic.success} />}
            value="--"
            label="Cliques"
          />
        </View>

        {/* Upgrade CTA */}
        {isFree && (
          <View className="bg-surface-tertiary rounded-2xl p-5 mt-6">
            <Text className="text-base font-semibold text-text-primary">
              Desbloqueie mais recursos
            </Text>
            <Text className="text-sm text-text-secondary mt-1">
              Importador IA, inteligencia competitiva e ofertas ilimitadas.
            </Text>
            <StyledButton
              title="Conhecer planos Premium"
              variant="primary"
              className="mt-4"
              onPress={() => {}}
            />
          </View>
        )}

        {/* Competitive Intelligence */}
        <View className="mt-6">
          <Text className="text-lg font-bold text-text-primary mb-3">
            Inteligencia Competitiva
          </Text>
          {!competitive.isPremium ? (
            <View className="bg-surface-tertiary rounded-2xl p-5 items-center">
              <Lock size={32} color={Colors.text.tertiary} />
              <Text className="text-sm font-semibold text-text-primary mt-3 text-center">
                Disponivel nos planos Premium e superiores
              </Text>
              <Text className="text-xs text-text-secondary mt-1 text-center">
                Veja como seus precos se comparam com a concorrencia.
              </Text>
            </View>
          ) : competitive.isLoading ? (
            <ActivityIndicator size="small" color={Colors.brand.green} />
          ) : (
            <View className="gap-3">
              <View className="bg-surface-tertiary rounded-2xl p-4 flex-row items-center gap-3">
                <Trophy size={24} color={Colors.brand.green} />
                <View className="flex-1">
                  <Text className="text-2xl font-bold text-text-primary">
                    {competitive.competitivenessScore}%
                  </Text>
                  <Text className="text-xs text-text-secondary">
                    Score de competitividade
                  </Text>
                </View>
                {competitive.myRank && (
                  <View className="bg-brand-green/10 rounded-lg px-3 py-1.5">
                    <Text className="text-xs font-semibold text-brand-green">
                      #{competitive.myRank} na regiao
                    </Text>
                  </View>
                )}
              </View>

              {competitive.competitorPrices.slice(0, 3).map((cp, i) => (
                <View key={i} className="bg-surface-tertiary rounded-2xl p-4">
                  <Text className="text-sm font-semibold text-text-primary">
                    {cp.product_name}
                  </Text>
                  <View className="flex-row items-center gap-3 mt-1">
                    <Text className="text-sm text-text-secondary">
                      Voce: R$ {cp.my_price.toFixed(2)}
                    </Text>
                    <Text
                      className={`text-sm font-semibold ${
                        cp.price_diff_percent > 0
                          ? 'text-semantic-error'
                          : 'text-semantic-success'
                      }`}
                    >
                      {cp.competitor_store_name}: R$ {cp.competitor_price.toFixed(2)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function KPICard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <View className="flex-1 bg-surface-tertiary rounded-2xl p-4">
      {icon}
      <Text className="text-lg font-bold text-text-primary mt-2">{value}</Text>
      <Text className="text-xs text-text-secondary mt-0.5">{label}</Text>
    </View>
  );
}

function getMonthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}
