import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import {
  Camera,
  ImageIcon,
  Upload,
  Trash2,
  CheckCircle,
  RotateCcw,
  Lock,
  Plus,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@precomapa/shared';
import { StyledButton } from '@/components/ui/button';
import { Colors } from '@/constants/colors';
import { useImagePicker } from '@/hooks/use-image-picker';
import { useExtraction, type ExtractedProduct } from '@/hooks/use-extraction';
import { usePublishImport } from '@/hooks/use-publish-import';

type Step = 'capture' | 'processing' | 'review' | 'success';

const UNITS: ExtractedProduct['unit'][] = ['un', 'kg', 'g', 'l', 'ml', 'pack'];

export default function BusinessImporter() {
  const session = useAuthStore((s) => s.session);
  const router = useRouter();
  const [store, setStore] = useState<any>(null);
  const [step, setStep] = useState<Step>('capture');
  const [editableProducts, setEditableProducts] = useState<ExtractedProduct[]>([]);

  const imagePicker = useImagePicker();
  const extraction = useExtraction();
  const publisher = usePublishImport();

  const profile = useAuthStore((s) => s.profile);
  const isSuperAdmin = profile?.role === 'super_admin';

  // Fetch store membership
  useEffect(() => {
    async function fetchStore() {
      if (!session?.user) return;

      const { data: member } = await supabase
        .from('store_members')
        .select('store_id')
        .eq('user_id', session.user.id)
        .single();

      if (!member && isSuperAdmin) {
        // Super admin has no store_members entry — pick the first store
        const { data: firstStore } = await supabase
          .from('stores')
          .select('*')
          .limit(1)
          .single();
        if (firstStore) setStore(firstStore);
        return;
      }

      if (!member) return;

      const { data } = await supabase
        .from('stores')
        .select('*')
        .eq('id', member.store_id)
        .single();

      if (data) setStore(data);
    }

    fetchStore();
  }, [session, isSuperAdmin]);

  // Auto-transition from processing to review when products arrive
  useEffect(() => {
    if (extraction.products.length > 0 && step === 'processing') {
      setEditableProducts([...extraction.products]);
      setStep('review');
    }
  }, [extraction.products, step]);

  const isPremium =
    isSuperAdmin ||
    store?.b2b_plan === 'premium' ||
    store?.b2b_plan === 'premium_plus' ||
    store?.b2b_plan === 'enterprise';

  const handleAnalyze = useCallback(async () => {
    if (!imagePicker.image) return;
    setStep('processing');
    await extraction.extractFromImage(imagePicker.image.uri);
  }, [imagePicker.image, extraction]);

  const handleRetry = useCallback(() => {
    extraction.reset();
    setStep('capture');
  }, [extraction]);

  const handlePublish = useCallback(async () => {
    if (!store?.id || editableProducts.length === 0) return;

    const result = await publisher.publish(store.id, editableProducts);
    if (result && result.count > 0) {
      setStep('success');
    }
  }, [store?.id, editableProducts, publisher]);

  const handleRestart = useCallback(() => {
    imagePicker.clearImage();
    extraction.reset();
    publisher.reset();
    setEditableProducts([]);
    setStep('capture');
  }, [imagePicker, extraction, publisher]);

  const updateProduct = useCallback((index: number, updates: Partial<ExtractedProduct>) => {
    setEditableProducts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  }, []);

  const removeProduct = useCallback((index: number) => {
    setEditableProducts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addManualProduct = useCallback(() => {
    setEditableProducts((prev) => [
      ...prev,
      { name: '', price: 0, unit: 'un', validity: null },
    ]);
  }, []);

  const showUnitPicker = useCallback((index: number) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancelar', ...UNITS],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex > 0) {
            updateProduct(index, { unit: UNITS[buttonIndex - 1] });
          }
        },
      );
    } else {
      Alert.alert(
        'Unidade',
        'Selecione a unidade',
        UNITS.map((u) => ({
          text: u,
          onPress: () => updateProduct(index, { unit: u }),
        })),
      );
    }
  }, [updateProduct]);

  // Plan gate — Premium+ check
  if (!isPremium) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center px-8">
          <Lock size={48} color={Colors.text.tertiary} />
          <Text className="text-lg font-semibold text-text-primary mt-4 text-center">
            Importador IA
          </Text>
          <Text className="text-sm text-text-secondary text-center mt-2">
            Importe ofertas em massa a partir de panfletos e tabelas. Disponível
            nos planos Premium e superiores.
          </Text>
          <StyledButton
            title="Conhecer planos"
            variant="primary"
            className="mt-6"
            onPress={() => {}}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Step 1 — Capture
  if (step === 'capture') {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 px-5 pt-6">
          <Text className="text-2xl font-bold text-text-primary">
            Importador IA
          </Text>
          <Text className="text-base text-text-secondary mt-2">
            Fotografe ou selecione uma imagem de encarte para extrair ofertas automaticamente.
          </Text>

          {!imagePicker.image ? (
            <View className="flex-1 items-center justify-center">
              <View className="w-full bg-surface-tertiary rounded-2xl p-8 items-center border-2 border-dashed border-border">
                <Upload size={48} color={Colors.brand.green} />
                <Text className="text-base font-semibold text-text-primary mt-4">
                  Envie seu panfleto
                </Text>
                <Text className="text-sm text-text-secondary text-center mt-2">
                  Tire uma foto ou selecione uma imagem da galeria
                </Text>
                <View className="flex-row gap-3 mt-6">
                  <Pressable
                    className="flex-1 flex-row items-center justify-center bg-brand-green rounded-xl py-4 px-4 gap-2 active:opacity-80"
                    onPress={imagePicker.pickFromCamera}
                  >
                    <Camera size={20} color="white" />
                    <Text className="text-white font-bold text-sm">Tirar Foto</Text>
                  </Pressable>
                  <Pressable
                    className="flex-1 flex-row items-center justify-center border-2 border-brand-green rounded-xl py-4 px-4 gap-2 active:opacity-80"
                    onPress={imagePicker.pickFromGallery}
                  >
                    <ImageIcon size={20} color={Colors.brand.green} />
                    <Text className="text-brand-green font-bold text-sm">Galeria</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : (
            <View className="flex-1 mt-4">
              <Image
                source={{ uri: imagePicker.image.uri }}
                className="w-full h-64 rounded-2xl"
                resizeMode="cover"
              />
              <View className="mt-4 gap-3">
                <StyledButton
                  title="Analisar com IA"
                  variant="primary"
                  onPress={handleAnalyze}
                />
                <StyledButton
                  title="Trocar imagem"
                  variant="ghost"
                  onPress={imagePicker.clearImage}
                />
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // Step 2 — Processing
  if (step === 'processing') {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 px-5 pt-6">
          <Text className="text-2xl font-bold text-text-primary">
            Analisando encarte
          </Text>
          <Text className="text-base text-text-secondary mt-2">
            Aguarde enquanto a IA extrai as ofertas...
          </Text>

          <View className="flex-1 mt-6">
            {extraction.isExtracting && (
              <ActivityIndicator size="large" color={Colors.brand.green} className="mb-4" />
            )}

            <ScrollView className="flex-1" contentContainerClassName="gap-2">
              {extraction.logs.map((log, i) => (
                <View key={i} className="flex-row items-start gap-2">
                  <Text className="text-brand-green text-xs mt-0.5">●</Text>
                  <Text className="text-sm text-text-secondary flex-1">{log}</Text>
                </View>
              ))}
            </ScrollView>

            {extraction.error && (
              <View className="mt-4">
                <Text className="text-sm text-semantic-error mb-3">
                  {extraction.error}
                </Text>
                <StyledButton
                  title="Tentar novamente"
                  variant="secondary"
                  onPress={handleRetry}
                />
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Step 3 — Review
  if (step === 'review') {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 px-5 pt-6">
          <Text className="text-2xl font-bold text-text-primary">
            Revisar ofertas
          </Text>
          <Text className="text-base text-text-secondary mt-2">
            {editableProducts.length} ofertas extraídas. Revise e edite antes de publicar.
          </Text>

          <FlatList
            data={editableProducts}
            keyExtractor={(_, index) => index.toString()}
            className="mt-4"
            contentContainerClassName="gap-3 pb-4"
            renderItem={({ item, index }) => (
              <View className="bg-surface-tertiary rounded-2xl p-4">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 mr-2">
                    <TextInput
                      className="text-base font-semibold text-text-primary bg-white rounded-lg px-3 py-2 border border-border"
                      value={item.name}
                      onChangeText={(text) => updateProduct(index, { name: text })}
                      placeholder="Nome do produto"
                      placeholderTextColor={Colors.text.tertiary}
                    />
                  </View>
                  <Pressable
                    className="w-10 h-10 items-center justify-center"
                    onPress={() => removeProduct(index)}
                  >
                    <Trash2 size={20} color={Colors.semantic.error} />
                  </Pressable>
                </View>

                <View className="flex-row gap-2 mt-2">
                  <View className="flex-1">
                    <Text className="text-xs text-text-tertiary mb-1">Preço</Text>
                    <TextInput
                      className="text-sm text-text-primary bg-white rounded-lg px-3 py-2 border border-border"
                      value={item.price > 0 ? item.price.toString() : ''}
                      onChangeText={(text) => {
                        const num = parseFloat(text.replace(',', '.'));
                        updateProduct(index, { price: isNaN(num) ? 0 : num });
                      }}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={Colors.text.tertiary}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-text-tertiary mb-1">Preço original</Text>
                    <TextInput
                      className="text-sm text-text-primary bg-white rounded-lg px-3 py-2 border border-border"
                      value={item.original_price ? item.original_price.toString() : ''}
                      onChangeText={(text) => {
                        const num = parseFloat(text.replace(',', '.'));
                        updateProduct(index, {
                          original_price: isNaN(num) || num === 0 ? undefined : num,
                        });
                      }}
                      keyboardType="decimal-pad"
                      placeholder="Opcional"
                      placeholderTextColor={Colors.text.tertiary}
                    />
                  </View>
                  <View>
                    <Text className="text-xs text-text-tertiary mb-1">Unidade</Text>
                    <Pressable
                      className="bg-white rounded-lg px-3 py-2 border border-border"
                      onPress={() => showUnitPicker(index)}
                    >
                      <Text className="text-sm text-text-primary">{item.unit}</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}
            ListFooterComponent={
              <Pressable
                className="flex-row items-center justify-center gap-2 py-3 active:opacity-70"
                onPress={addManualProduct}
              >
                <Plus size={18} color={Colors.brand.green} />
                <Text className="text-brand-green font-semibold text-sm">
                  Adicionar produto
                </Text>
              </Pressable>
            }
          />

          <View className="pb-4 gap-2">
            {publisher.error && (
              <Text className="text-sm text-semantic-error text-center">
                {publisher.error}
              </Text>
            )}
            <StyledButton
              title={
                publisher.isPublishing
                  ? 'Publicando...'
                  : `Publicar ${editableProducts.length} ofertas`
              }
              variant="primary"
              onPress={handlePublish}
              disabled={publisher.isPublishing || editableProducts.length === 0}
            />
            <StyledButton
              title="Voltar"
              variant="ghost"
              onPress={handleRestart}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Step 4 — Success
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center px-8">
        <CheckCircle size={64} color={Colors.semantic.success} />
        <Text className="text-2xl font-bold text-text-primary mt-6 text-center">
          {publisher.result?.count ?? 0} ofertas publicadas!
        </Text>
        <Text className="text-base text-text-secondary text-center mt-2">
          Suas ofertas já estão visíveis para os consumidores.
        </Text>

        <View className="w-full mt-8 gap-3">
          <StyledButton
            title="Importar outro encarte"
            variant="primary"
            onPress={handleRestart}
          />
          <StyledButton
            title="Ver minhas ofertas"
            variant="ghost"
            onPress={() => router.replace('/(business)/offers')}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
