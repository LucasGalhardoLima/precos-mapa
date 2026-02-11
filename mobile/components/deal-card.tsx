import { View, Text } from "react-native";
import { MotiView } from "moti";
import { MapPin, Clock } from "lucide-react-native";
import { Badge } from "@/components/ui/badge";
import { Colors } from "@/constants/colors";
import type { EnrichedPromotion } from "@/types";

interface DealCardProps {
  deal: EnrichedPromotion;
  index?: number;
  compact?: boolean;
}

export function DealCard({ deal, index = 0, compact = false }: DealCardProps) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 350, delay: index * 60 }}
      className={`bg-white rounded-2xl border border-border ${
        compact ? "p-3" : "p-4"
      }`}
    >
      {/* Header: Product + Store */}
      <View className="flex-row items-start justify-between">
        <View className="flex-1 mr-3">
          <Text
            className={`font-semibold text-text-primary ${
              compact ? "text-sm" : "text-base"
            }`}
            numberOfLines={1}
          >
            {deal.product.name}
          </Text>
          {deal.product.brand && (
            <Text className="text-xs text-text-tertiary">
              {deal.product.brand}
            </Text>
          )}
        </View>
        {/* Store Avatar */}
        <View
          className="w-8 h-8 rounded-full items-center justify-center"
          style={{ backgroundColor: deal.store.logoColor }}
        >
          <Text className="text-white font-bold text-sm">
            {deal.store.logoInitial}
          </Text>
        </View>
      </View>

      {/* Store name + distance */}
      <View className="flex-row items-center gap-1 mt-1">
        <Text className="text-xs text-text-secondary">{deal.store.name}</Text>
        <View className="flex-row items-center gap-0.5 ml-2">
          <MapPin size={10} color={Colors.text.tertiary} />
          <Text className="text-xs text-text-tertiary">
            {deal.distanceKm} km
          </Text>
        </View>
      </View>

      {/* Price Row */}
      <View className="flex-row items-center gap-2 mt-3">
        <Text className={`font-bold text-brand-green ${compact ? "text-lg" : "text-xl"}`}>
          R$ {deal.promoPrice.toFixed(2)}
        </Text>
        <Text className="text-sm text-text-tertiary line-through">
          R$ {deal.originalPrice.toFixed(2)}
        </Text>
      </View>

      {/* Badges Row */}
      <View className="flex-row flex-wrap gap-1.5 mt-2">
        <Badge variant="discount" label={`-${deal.discountPercent}%`} />
        {deal.verified && <Badge variant="verified" label="Verificado" />}
        {deal.belowNormalPercent > 0 && (
          <Badge
            variant="below-normal"
            label={`${deal.belowNormalPercent}% abaixo do normal`}
          />
        )}
        {deal.isExpiringSoon && (
          <Badge variant="expiring" label="Acaba hoje!" />
        )}
      </View>

      {/* Gamification Message */}
      {deal.gamificationMessage && !compact && (
        <Text className="text-xs font-medium text-brand-green-dark mt-2">
          {deal.gamificationMessage}
        </Text>
      )}

      {/* Expiry info */}
      {!compact && (
        <View className="flex-row items-center gap-1 mt-2">
          <Clock size={12} color={Colors.text.tertiary} />
          <Text className="text-xs text-text-tertiary">
            Valido ate{" "}
            {new Date(deal.endDate).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
            })}
          </Text>
        </View>
      )}
    </MotiView>
  );
}
