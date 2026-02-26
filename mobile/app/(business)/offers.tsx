import { View, Text, FlatList, Alert, Pressable } from 'react-native';
import { MotiView } from 'moti';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@precomapa/shared';
import { Badge } from '@/components/ui/badge';
import { Colors } from '@/constants/colors';

export default function BusinessOffers() {
  const session = useAuthStore((s) => s.session);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const profile = useAuthStore((s) => s.profile);
  const isSuperAdmin = profile?.role === 'super_admin';

  const fetchPromotions = useCallback(async () => {
    if (!session?.user) return;

    const { data: member } = await supabase
      .from('store_members')
      .select('store_id')
      .eq('user_id', session.user.id)
      .single();

    if (!member && isSuperAdmin) {
      // Super admin sees all promotions across all stores
      const { data } = await supabase
        .from('promotions')
        .select('*, product:products(*)')
        .order('created_at', { ascending: false });
      if (data) setPromotions(data);
      setIsLoading(false);
      return;
    }

    if (!member) {
      setIsLoading(false);
      return;
    }

    setStoreId(member.store_id);

    const { data } = await supabase
      .from('promotions')
      .select('*, product:products(*)')
      .eq('store_id', member.store_id)
      .order('created_at', { ascending: false });

    if (data) setPromotions(data);
    setIsLoading(false);
  }, [session, isSuperAdmin]);

  useEffect(() => {
    fetchPromotions();
  }, [fetchPromotions]);

  const handleDelete = (promotionId: string, productName: string) => {
    Alert.alert(
      'Excluir oferta',
      `Deseja excluir a oferta de "${productName}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await supabase
              .from('promotions')
              .delete()
              .eq('id', promotionId)
              .eq('store_id', storeId!);
            await fetchPromotions();
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="px-5 pt-6 gap-3">
          <View className="h-8 bg-border rounded-lg w-1/3" />
          <View className="h-4 bg-border rounded-lg w-1/4" />
          {[0, 1, 2].map((i) => (
            <MotiView
              key={i}
              from={{ opacity: 0.4 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', duration: 800, loop: true }}
              className="bg-surface-tertiary rounded-2xl p-4 gap-2"
            >
              <View className="bg-border rounded-lg h-4 w-3/4" />
              <View className="bg-border rounded-lg h-6 w-1/3" />
              <View className="bg-border rounded-md h-5 w-16" />
            </MotiView>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-5 pt-6">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-2xl font-bold text-text-primary">Ofertas</Text>
            <Text className="text-sm text-text-secondary mt-1">
              {promotions.length} ofertas cadastradas
            </Text>
          </View>
          <Pressable
            className="w-12 h-12 bg-brand-green rounded-full items-center justify-center"
            onPress={() => Alert.alert('Nova Oferta', 'Formulario de criacao sera implementado')}
          >
            <Plus size={24} color="white" />
          </Pressable>
        </View>

        <FlatList
          data={promotions}
          keyExtractor={(item) => item.id}
          contentContainerClassName="gap-3 pb-4"
          renderItem={({ item }) => (
            <View className="bg-surface-tertiary rounded-2xl p-4 flex-row items-center">
              <View className="flex-1">
                <Text className="text-base font-semibold text-text-primary">
                  {item.product?.name ?? 'Produto'}
                </Text>
                <View className="flex-row items-center gap-2 mt-1">
                  <Text className="text-lg font-bold text-brand-green">
                    R$ {item.promo_price?.toFixed(2)}
                  </Text>
                  <Text className="text-sm text-text-tertiary line-through">
                    R$ {item.original_price?.toFixed(2)}
                  </Text>
                </View>
                <View className="flex-row gap-1.5 mt-2">
                  <Badge
                    variant={item.status === 'active' ? 'verified' : 'expiring'}
                    label={item.status === 'active' ? 'Ativa' : item.status === 'expired' ? 'Expirada' : 'Revisao'}
                  />
                  {item.source === 'importador_ia' && (
                    <Badge variant="below-normal" label="IA" />
                  )}
                </View>
              </View>
              <Pressable
                className="w-10 h-10 items-center justify-center"
                onPress={() => handleDelete(item.id, item.product?.name)}
              >
                <Trash2 size={20} color={Colors.semantic.error} />
              </Pressable>
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}
