import { View, Text, TextInput, ScrollView, Alert, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { LogOut } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { storeSetupSchema } from '@/lib/schemas';
import { useAuthStore } from '@precomapa/shared';
import { StyledButton } from '@/components/ui/button';
import { Colors } from '@/constants/colors';

export default function BusinessProfile() {
  const session = useAuthStore((s) => s.session);
  const setSession = useAuthStore((s) => s.setSession);
  const [store, setStore] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    phone: '',
  });

  useEffect(() => {
    async function fetchStore() {
      if (!session?.user) return;

      const { data: member } = await supabase
        .from('store_members')
        .select('store_id')
        .eq('user_id', session.user.id)
        .single();

      if (!member) {
        setIsLoading(false);
        return;
      }

      const { data } = await supabase
        .from('stores')
        .select('*')
        .eq('id', member.store_id)
        .single();

      if (data) {
        setStore(data);
        setForm({
          name: data.name ?? '',
          address: data.address ?? '',
          city: data.city ?? '',
          state: data.state ?? '',
          phone: data.phone ?? '',
        });
      }
      setIsLoading(false);
    }

    fetchStore();
  }, [session]);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!store) return;

    const payload = {
      ...form,
      state: form.state.toUpperCase(),
      latitude: store.latitude,
      longitude: store.longitude,
    };

    const result = storeSetupSchema.safeParse(payload);
    if (!result.success) {
      Alert.alert('Dados invalidos', result.error.issues[0].message);
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('stores')
        .update({
          name: form.name,
          address: form.address,
          city: form.city,
          state: form.state.toUpperCase(),
          phone: form.phone || null,
        })
        .eq('id', store.id);

      if (error) throw error;
      Alert.alert('Sucesso', 'Perfil da loja atualizado');
    } catch (error: any) {
      Alert.alert('Erro', error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color={Colors.brand.green} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-6 pb-8"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-2xl font-bold text-text-primary">
          Perfil da Loja
        </Text>
        <Text className="text-sm text-text-secondary mt-1 mb-6">
          Gerencie as informacoes da sua loja
        </Text>

        <View className="gap-5">
          <FormField
            label="Nome da loja"
            value={form.name}
            onChangeText={(v) => updateField('name', v)}
            placeholder="Nome da loja"
          />
          <FormField
            label="Endereco"
            value={form.address}
            onChangeText={(v) => updateField('address', v)}
            placeholder="Rua, numero - Bairro"
          />
          <View className="flex-row gap-4">
            <View className="flex-1">
              <FormField
                label="Cidade"
                value={form.city}
                onChangeText={(v) => updateField('city', v)}
                placeholder="Cidade"
              />
            </View>
            <View className="w-24">
              <FormField
                label="UF"
                value={form.state}
                onChangeText={(v) => updateField('state', v.slice(0, 2))}
                placeholder="SP"
                maxLength={2}
              />
            </View>
          </View>
          <FormField
            label="Telefone"
            value={form.phone}
            onChangeText={(v) => updateField('phone', v)}
            placeholder="(16) 99999-9999"
            keyboardType="phone-pad"
          />
        </View>

        <StyledButton
          title={isSaving ? 'Salvando...' : 'Salvar alteracoes'}
          variant="primary"
          className="mt-8"
          onPress={handleSave}
          disabled={isSaving}
        />

        {/* Sign out */}
        <Pressable
          onPress={async () => {
            await supabase.auth.signOut();
            setSession(null);
          }}
          className="mt-6 bg-white rounded-2xl p-4 flex-row items-center gap-3 border border-border"
        >
          <LogOut size={18} color={Colors.text.secondary} />
          <Text className="text-sm font-semibold text-text-primary">Sair</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  maxLength,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  maxLength?: number;
  keyboardType?: 'default' | 'phone-pad';
}) {
  return (
    <View>
      <Text className="text-sm font-medium text-text-primary mb-1.5">
        {label}
      </Text>
      <TextInput
        className="border border-border rounded-xl px-4 py-3 text-base text-text-primary"
        placeholder={placeholder}
        placeholderTextColor={Colors.text.tertiary}
        value={value}
        onChangeText={onChangeText}
        maxLength={maxLength}
        keyboardType={keyboardType}
      />
    </View>
  );
}
