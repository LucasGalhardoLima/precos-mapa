import { View, Text, StyleSheet } from "react-native";
import { palette } from "../ui/theme";
import { MobileOffer } from "../data/mock";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function OfferCard({ offer }: { offer: MobileOffer }) {
  const discount = Math.max(0, Math.round(((offer.previousPrice - offer.price) / offer.previousPrice) * 100));

  return (
    <View style={styles.card}>
      <View style={styles.badgeRow}>
        <Text style={styles.badgeText}>-{discount}%</Text>
      </View>
      <Text style={styles.name}>{offer.name}</Text>
      <Text style={styles.market}>{offer.market}</Text>
      <View style={styles.priceRow}>
        <Text style={styles.price}>{formatCurrency(offer.price)}</Text>
        <Text style={styles.prevPrice}>{formatCurrency(offer.previousPrice)}</Text>
      </View>
      <Text style={styles.helper}>Válido até {offer.validUntil} · {offer.marketDistanceKm} km</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 16,
    backgroundColor: palette.white,
    padding: 14,
    gap: 6,
  },
  badgeRow: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#FFE8E6",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: palette.danger,
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
    color: palette.ink,
  },
  market: {
    fontSize: 13,
    color: palette.muted,
  },
  priceRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-end",
  },
  price: {
    fontSize: 26,
    fontWeight: "700",
    color: palette.primaryDeep,
  },
  prevPrice: {
    fontSize: 14,
    color: palette.muted,
    textDecorationLine: "line-through",
  },
  helper: {
    fontSize: 12,
    color: palette.muted,
  },
});
