import { View, Text, ScrollView, Pressable, Alert, Share } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Slider from '@react-native-community/slider';
import {
  User,
  MapPin,
  Bell,
  Crown,
  FileDown,
  Trash2,
  Shield,
  LogOut,
  ChevronRight,
} from 'lucide-react-native';
import { useAuthStore } from '@precomapa/shared';
import { useAccount } from '@/hooks/use-account';
import { useSubscription } from '@/hooks/use-subscription';
import { Paywall } from '@/components/paywall';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';

export default function ProfileScreen() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const setSession = useAuthStore((s) => s.setSession);
  const { exportData, deleteAccount, isDeleting, isExporting } = useAccount();
  const { plan } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);
  const [searchRadius, setSearchRadius] = useState(profile?.search_radius_km ?? 5);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  const handleExport = async () => {
    const data = await exportData();
    if (!data) return;

    const json = JSON.stringify(data, null, 2);
    await Share.share({
      message: json,
      title: 'Meus dados — PrecoMapa',
    });
  };

  const handleDelete = () => {
    Alert.alert(
      'Excluir conta',
      'Tem certeza? Todos os seus dados serao removidos permanentemente. Esta acao nao pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir minha conta',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteAccount();
            if (!success) {
              Alert.alert('Erro', 'Nao foi possivel excluir a conta. Tente novamente.');
            }
          },
        },
      ],
    );
  };

  const handleRadiusChange = async (value: number) => {
    setSearchRadius(value);
    if (session?.user?.id) {
      await supabase
        .from('profiles')
        .update({ search_radius_km: value })
        .eq('id', session.user.id);
    }
  };

  const planLabel = plan === 'plus' ? 'Plus' : plan === 'family' ? 'Family' : 'Gratuito';

  return (
    <SafeAreaView className="flex-1 bg-surface-secondary" edges={['top']}>
      <ScrollView className="flex-1" contentContainerClassName="pb-8">
        <View className="px-5 pt-6">
          <Text className="text-2xl font-bold text-text-primary">Perfil</Text>
        </View>

        {/* User info */}
        <View className="mx-5 mt-4 bg-white rounded-2xl p-4 flex-row items-center gap-3">
          <View className="w-12 h-12 bg-brand-green/10 rounded-full items-center justify-center">
            <User size={24} color={Colors.brand.green} />
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-text-primary">
              {profile?.display_name ?? 'Usuario'}
            </Text>
            <Text className="text-sm text-text-secondary">
              {session?.user?.email ?? ''}
            </Text>
          </View>
        </View>

        {/* Plan status */}
        <Pressable
          onPress={() => plan === 'free' && setShowPaywall(true)}
          className="mx-5 mt-3 bg-white rounded-2xl p-4 flex-row items-center gap-3"
        >
          <Crown size={20} color={plan === 'free' ? Colors.text.tertiary : Colors.brand.green} />
          <View className="flex-1">
            <Text className="text-sm font-semibold text-text-primary">
              Plano {planLabel}
            </Text>
            {plan === 'free' && (
              <Text className="text-xs text-text-secondary">
                Faca upgrade para desbloquear tudo
              </Text>
            )}
          </View>
          {plan === 'free' && (
            <ChevronRight size={16} color={Colors.text.tertiary} />
          )}
        </Pressable>

        {/* Search radius */}
        <View className="mx-5 mt-3 bg-white rounded-2xl p-4">
          <View className="flex-row items-center gap-2 mb-2">
            <MapPin size={18} color={Colors.brand.green} />
            <Text className="text-sm font-semibold text-text-primary">
              Raio de busca
            </Text>
            <Text className="text-sm font-bold text-brand-green ml-auto">
              {searchRadius} km
            </Text>
          </View>
          <Slider
            minimumValue={1}
            maximumValue={50}
            step={1}
            value={searchRadius}
            onSlidingComplete={handleRadiusChange}
            minimumTrackTintColor={Colors.brand.green}
            maximumTrackTintColor={Colors.border.default}
            thumbTintColor={Colors.brand.green}
          />
          <View className="flex-row justify-between">
            <Text className="text-[10px] text-text-tertiary">1 km</Text>
            <Text className="text-[10px] text-text-tertiary">50 km</Text>
          </View>
        </View>

        {/* Notifications */}
        <View className="mx-5 mt-3 bg-white rounded-2xl p-4 flex-row items-center gap-3">
          <Bell size={18} color={Colors.brand.green} />
          <Text className="text-sm font-semibold text-text-primary flex-1">
            Notificacoes
          </Text>
          <Text className="text-xs text-text-tertiary">Ativadas</Text>
        </View>

        {/* LGPD section */}
        <Text className="text-xs font-semibold text-text-tertiary uppercase tracking-wider px-5 mt-6 mb-2">
          Privacidade e dados
        </Text>

        <Pressable
          onPress={() => router.push('/privacy')}
          className="mx-5 bg-white rounded-t-2xl p-4 flex-row items-center gap-3 border-b border-border"
        >
          <Shield size={18} color={Colors.text.secondary} />
          <Text className="text-sm text-text-primary flex-1">
            Politica de Privacidade
          </Text>
          <ChevronRight size={16} color={Colors.text.tertiary} />
        </Pressable>

        <Pressable
          onPress={handleExport}
          disabled={isExporting}
          className="mx-5 bg-white p-4 flex-row items-center gap-3 border-b border-border"
        >
          <FileDown size={18} color={Colors.text.secondary} />
          <Text className="text-sm text-text-primary flex-1">
            {isExporting ? 'Exportando...' : 'Exportar meus dados'}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleDelete}
          disabled={isDeleting}
          className="mx-5 bg-white rounded-b-2xl p-4 flex-row items-center gap-3"
        >
          <Trash2 size={18} color={Colors.semantic.error} />
          <Text className="text-sm text-semantic-error flex-1">
            {isDeleting ? 'Excluindo...' : 'Excluir minha conta'}
          </Text>
        </Pressable>

        {/* Sign out */}
        <Pressable
          onPress={handleSignOut}
          className="mx-5 mt-4 bg-white rounded-2xl p-4 flex-row items-center gap-3"
        >
          <LogOut size={18} color={Colors.text.secondary} />
          <Text className="text-sm font-semibold text-text-primary">Sair</Text>
        </Pressable>
      </ScrollView>

      <Paywall visible={showPaywall} onClose={() => setShowPaywall(false)} />
    </SafeAreaView>
  );
}
