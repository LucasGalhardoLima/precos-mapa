import { View, Text, FlatList, Pressable, TextInput, Alert, Linking } from 'react-native';
import { useState } from 'react';
import { Plus, Trash2, Check, Navigation, ShoppingCart } from 'lucide-react-native';
import { useShoppingList } from '@/hooks/use-shopping-list';
import { useLocation } from '@/hooks/use-location';
import { StyledButton } from '@/components/ui/button';
import { Colors } from '@/constants/colors';

interface SmartListProps {
  listId: string;
}

export function SmartList({ listId }: SmartListProps) {
  const { lists, toggleItem, removeItem, optimizeList } = useShoppingList();
  const location = useLocation();
  const [optimizing, setOptimizing] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof optimizeList>>>(null);

  const list = lists.find((l) => l.id === listId);
  if (!list) return null;

  const handleOptimize = async () => {
    if (!location.latitude || !location.longitude) {
      Alert.alert('Localizacao', 'Precisamos da sua localizacao para otimizar a rota.');
      return;
    }

    setOptimizing(true);
    const optimization = await optimizeList(listId, location.latitude, location.longitude);
    setResult(optimization);
    setOptimizing(false);
  };

  const handleNavigate = () => {
    if (result?.mapsUrl) {
      Linking.openURL(result.mapsUrl);
    }
  };

  return (
    <View className="flex-1">
      <Text className="text-xl font-bold text-text-primary">{list.name}</Text>
      <Text className="text-sm text-text-secondary mt-1">
        {list.items.length} itens
      </Text>

      <FlatList
        data={list.items}
        keyExtractor={(item) => item.id}
        contentContainerClassName="gap-2 mt-4"
        renderItem={({ item }) => (
          <View className="flex-row items-center bg-surface-tertiary rounded-xl p-3 gap-3">
            <Pressable
              onPress={() => toggleItem(item.id, !item.is_checked)}
              className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                item.is_checked
                  ? 'bg-brand-green border-brand-green'
                  : 'border-border'
              }`}
            >
              {item.is_checked && <Check size={14} color="white" />}
            </Pressable>

            <View className="flex-1">
              <Text
                className={`text-sm font-medium ${
                  item.is_checked
                    ? 'text-text-tertiary line-through'
                    : 'text-text-primary'
                }`}
              >
                {item.product?.name ?? 'Produto'}
              </Text>
              <Text className="text-xs text-text-tertiary">
                Qtd: {item.quantity}
              </Text>
            </View>

            <Pressable
              onPress={() => removeItem(item.id)}
              className="w-8 h-8 items-center justify-center"
            >
              <Trash2 size={16} color={Colors.semantic.error} />
            </Pressable>
          </View>
        )}
      />

      <View className="mt-4 gap-3">
        <StyledButton
          title={optimizing ? 'Otimizando...' : 'Otimizar compra'}
          variant="primary"
          onPress={handleOptimize}
          disabled={optimizing || list.items.length === 0}
        />

        {result && (
          <View className="bg-surface-tertiary rounded-2xl p-4 gap-3">
            <View className="flex-row items-center gap-2">
              <ShoppingCart size={20} color={Colors.brand.green} />
              <Text className="text-base font-bold text-text-primary">
                Resultado da otimizacao
              </Text>
            </View>

            <Text className="text-sm text-text-secondary">
              {result.stores.length} loja(s) para visitar
            </Text>

            {result.stores.map((store) => (
              <View key={store.storeId} className="bg-white rounded-xl p-3">
                <Text className="text-sm font-semibold text-text-primary">
                  {store.storeName}
                </Text>
                {store.items.map((item, i) => (
                  <Text key={i} className="text-xs text-text-secondary mt-0.5">
                    {item.productName} x{item.quantity} — R$ {item.price.toFixed(2)}
                  </Text>
                ))}
                <Text className="text-sm font-bold text-brand-green mt-1">
                  Subtotal: R$ {store.subtotal.toFixed(2)}
                </Text>
              </View>
            ))}

            <View className="flex-row items-center justify-between mt-2">
              <Text className="text-base font-bold text-text-primary">
                Total: R$ {result.totalCost.toFixed(2)}
              </Text>
              <Text className="text-sm text-semantic-success font-semibold">
                ~R$ {result.estimatedSavings.toFixed(2)} economia
              </Text>
            </View>

            {result.mapsUrl && (
              <StyledButton
                title="Navegar rota otimizada"
                variant="outline"
                onPress={handleNavigate}
              />
            )}
          </View>
        )}
      </View>
    </View>
  );
}
