import { StyleSheet, Text, View } from "react-native";
import { mobileMarkets, mobileOffers } from "../../src/data/mock";
import { ScreenShell } from "../../src/components/screen-shell";
import { SectionCard } from "../../src/components/section-card";
import { palette } from "../../src/ui/theme";

export default function MapaScreen() {
  return (
    <ScreenShell title="Mapa" subtitle="Mercados próximos e melhores ofertas por distância (mock).">
      <SectionCard title="Mapa inteligente" subtitle="Prévia visual para a demo mobile sem chaves externas.">
        <View style={styles.mockMap}>
          {mobileMarkets.map((market) => (
            <View key={market.id} style={[styles.pin, { top: `${market.pinTop}%`, left: `${market.pinLeft}%` }]}>
              <Text style={styles.pinDot}>📍</Text>
            </View>
          ))}
        </View>
      </SectionCard>

      <SectionCard title="Mercados perto de você" subtitle="Ordenados por distância.">
        {mobileMarkets.map((market) => {
          const bestOffer = mobileOffers
            .filter((offer) => offer.market.includes(market.name.split(" ")[0]))
            .sort((first, second) => first.price - second.price)[0];

          return (
            <View key={market.id} style={styles.marketRow}>
              <View>
                <Text style={styles.marketName}>{market.name}</Text>
                <Text style={styles.marketMeta}>{market.city} · {market.distanceKm} km</Text>
              </View>
              <View style={styles.marketPriceTag}>
                <Text style={styles.marketPriceLabel}>Melhor oferta</Text>
                <Text style={styles.marketPrice}>{bestOffer ? `R$ ${bestOffer.price.toFixed(2).replace(".", ",")}` : "-"}</Text>
              </View>
            </View>
          );
        })}
      </SectionCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  mockMap: {
    height: 240,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: "#E7F5ED",
    position: "relative",
    overflow: "hidden",
  },
  pin: {
    position: "absolute",
  },
  pinDot: {
    fontSize: 24,
  },
  marketRow: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 14,
    backgroundColor: palette.white,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  marketName: {
    fontSize: 16,
    fontWeight: "700",
    color: palette.ink,
  },
  marketMeta: {
    marginTop: 2,
    fontSize: 12,
    color: palette.muted,
  },
  marketPriceTag: {
    alignItems: "flex-end",
  },
  marketPriceLabel: {
    fontSize: 11,
    color: palette.muted,
  },
  marketPrice: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: "700",
    color: palette.primaryDeep,
  },
});
