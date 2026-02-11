import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bell, ShoppingBag, Tag, Clock } from "lucide-react-native";
import { Colors } from "@/constants/colors";

const MOCK_ALERTS = [
  {
    id: "alert_001",
    product: "Arroz Tio Joao 5kg",
    store: "Mais Barato Araraquara",
    price: "R$ 19,99",
    time: "Ha 2 horas",
    icon: ShoppingBag,
  },
  {
    id: "alert_002",
    product: "Coca-Cola 2L",
    store: "Carol Supermercado",
    price: "R$ 7,49",
    time: "Ha 5 horas",
    icon: Tag,
  },
  {
    id: "alert_003",
    product: "Sabao em Po Omo 1kg",
    store: "Bom Dia Ribeirao",
    price: "R$ 9,99",
    time: "Ontem",
    icon: Tag,
  },
];

export default function AlertsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface-secondary" edges={["top"]}>
      <View className="px-4 pt-6 pb-3">
        <Text className="text-2xl font-bold text-text-primary">
          Alertas de Ofertas
        </Text>
        <Text className="text-sm text-text-secondary mt-1">
          Receba notificacoes quando seus produtos favoritos entrarem em
          promocao perto de voce
        </Text>
      </View>

      {/* Feature explanation */}
      <View className="mx-4 bg-brand-green/5 rounded-2xl p-5 items-center mb-4">
        <Bell size={40} color={Colors.brand.green} />
        <Text className="text-sm text-text-secondary text-center mt-3 leading-5">
          Quando voce favoritar produtos, vamos te avisar automaticamente quando
          eles entrarem em promocao nos mercados perto de voce.
        </Text>
      </View>

      {/* Mock alerts */}
      <View className="px-4 gap-3">
        <Text className="text-base font-semibold text-text-primary">
          Exemplo de alertas
        </Text>
        {MOCK_ALERTS.map((alert) => {
          const IconComponent = alert.icon;
          return (
            <View
              key={alert.id}
              className="bg-white rounded-2xl border border-border p-4 flex-row items-center gap-3"
            >
              <View className="w-10 h-10 bg-brand-green/10 rounded-full items-center justify-center">
                <IconComponent size={20} color={Colors.brand.green} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-text-primary">
                  {alert.product}
                </Text>
                <Text className="text-xs text-text-secondary">
                  {alert.store} — {alert.price}
                </Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Clock size={10} color={Colors.text.tertiary} />
                <Text className="text-xs text-text-tertiary">
                  {alert.time}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
