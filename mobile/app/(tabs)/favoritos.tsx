import { StyleSheet, Text, View } from "react-native";
import { mobileOffers } from "../../src/data/mock";
import { OfferCard } from "../../src/components/offer-card";
import { ScreenShell } from "../../src/components/screen-shell";
import { SectionCard } from "../../src/components/section-card";
import { palette } from "../../src/ui/theme";

export default function FavoritosScreen() {
  const favorites = mobileOffers.filter((offer) => offer.isFavorite);

  return (
    <ScreenShell title="Favoritos" subtitle="Acompanhe produtos salvos e variações de preço.">
      <SectionCard title="Itens monitorados" subtitle={`${favorites.length} produtos com alerta de queda.`}>
        {favorites.map((offer) => (
          <OfferCard key={offer.id} offer={offer} />
        ))}
      </SectionCard>

      <SectionCard title="Resumo da semana">
        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>Economia potencial</Text>
          <Text style={styles.summaryValue}>R$ 38,20</Text>
          <Text style={styles.summaryMeta}>Comparando os favoritos em 3 mercados próximos.</Text>
        </View>
      </SectionCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  summaryBox: {
    borderRadius: 14,
    backgroundColor: palette.surfaceStrong,
    padding: 14,
  },
  summaryTitle: {
    fontSize: 13,
    color: palette.muted,
  },
  summaryValue: {
    marginTop: 4,
    fontSize: 30,
    fontWeight: "700",
    color: palette.primaryDeep,
  },
  summaryMeta: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: palette.muted,
  },
});
