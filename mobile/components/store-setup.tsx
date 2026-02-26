import { View, Text, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyledButton } from '@/components/ui/button';
import { storeSetupSchema } from '@/lib/schemas';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from '@/hooks/use-location';
import { Colors } from '@/constants/colors';

interface StoreSetupProps {
  onComplete: () => void;
}

export function StoreSetup({ onComplete }: StoreSetupProps) {
  const { user } = useAuth();
  const { latitude, longitude } = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
  });

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    const payload = {
      ...form,
      state: form.state.toUpperCase(),
      latitude,
      longitude,
    };

    const result = storeSetupSchema.safeParse(payload);
    if (!result.success) {
      const firstError = result.error.issues[0];
      Alert.alert('Dados invalidos', firstError.message);
      return;
    }

    if (!user) {
      Alert.alert('Erro', 'Voce precisa estar autenticado');
      return;
    }

    setIsSubmitting(true);
    try {
      // Create store
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .insert({
          name: result.data.name,
          address: result.data.address,
          city: result.data.city,
          state: result.data.state,
          latitude: result.data.latitude,
          longitude: result.data.longitude,
          logo_initial: result.data.name.charAt(0).toUpperCase(),
          logo_color: '#22C55E',
        })
        .select()
        .single();

      if (storeError) throw storeError;

      // Create store_member with owner role
      const { error: memberError } = await supabase
        .from('store_members')
        .insert({
          store_id: store.id,
          user_id: user.id,
          role: 'owner',
        });

      if (memberError) throw memberError;

      onComplete();
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Falha ao criar loja');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 py-8"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-2xl font-bold text-text-primary mb-2">
          Configure sua loja
        </Text>
        <Text className="text-base text-text-secondary mb-8">
          Preencha os dados abaixo para comecar a publicar ofertas.
        </Text>

        <View className="gap-5">
          <View>
            <Text className="text-sm font-medium text-text-primary mb-1.5">
              Nome da loja *
            </Text>
            <TextInput
              className="border border-border rounded-xl px-4 py-3 text-base text-text-primary"
              placeholder="Ex: Supermercado Carol"
              placeholderTextColor={Colors.text.tertiary}
              value={form.name}
              onChangeText={(v) => updateField('name', v)}
            />
          </View>

          <View>
            <Text className="text-sm font-medium text-text-primary mb-1.5">
              Endereco *
            </Text>
            <TextInput
              className="border border-border rounded-xl px-4 py-3 text-base text-text-primary"
              placeholder="Rua, numero - Bairro"
              placeholderTextColor={Colors.text.tertiary}
              value={form.address}
              onChangeText={(v) => updateField('address', v)}
            />
          </View>

          <View className="flex-row gap-4">
            <View className="flex-1">
              <Text className="text-sm font-medium text-text-primary mb-1.5">
                Cidade *
              </Text>
              <TextInput
                className="border border-border rounded-xl px-4 py-3 text-base text-text-primary"
                placeholder="Matao"
                placeholderTextColor={Colors.text.tertiary}
                value={form.city}
                onChangeText={(v) => updateField('city', v)}
              />
            </View>
            <View className="w-24">
              <Text className="text-sm font-medium text-text-primary mb-1.5">
                UF *
              </Text>
              <TextInput
                className="border border-border rounded-xl px-4 py-3 text-base text-text-primary text-center"
                placeholder="SP"
                placeholderTextColor={Colors.text.tertiary}
                value={form.state}
                onChangeText={(v) => updateField('state', v.slice(0, 2))}
                maxLength={2}
                autoCapitalize="characters"
              />
            </View>
          </View>

          <View className="bg-surface-tertiary rounded-xl p-4">
            <Text className="text-sm text-text-secondary">
              Localizacao GPS detectada automaticamente. Voce pode ajustar depois no perfil da loja.
            </Text>
          </View>
        </View>

        <View className="mt-10">
          <StyledButton
            title={isSubmitting ? 'Criando...' : 'Criar loja e comecar'}
            variant="primary"
            onPress={handleSubmit}
            disabled={isSubmitting}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
