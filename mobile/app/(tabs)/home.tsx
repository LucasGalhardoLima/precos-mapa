import { StyleSheet, Text, View } from "react-native";
import { mobileOffers } from "../../src/data/mock";
import { OfferCard } from "../../src/components/offer-card";
import { ScreenShell } from "../../src/components/screen-shell";
import { SectionCard } from "../../src/components/section-card";
import { palette } from "../../src/ui/theme";

export default function HomeScreen() {
  return (
    <ScreenShell title="PreçoMapa" subtitle="Compare preços perto de você e economize toda semana.">
      <View style={styles.kpis}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>+3.2k</Text>
          <Text style={styles.kpiLabel}>usuários em Matão</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>R$ 47</Text>
          <Text style={styles.kpiLabel}>economia média/mês</Text>
        </View>
      </View>

      <SectionCard title="Ofertas em destaque" subtitle="Promoções verificadas para hoje.">
        {mobileOffers.slice(0, 3).map((offer) => (
          <OfferCard key={offer.id} offer={offer} />
        ))}
      </SectionCard>

      <SectionCard title="Depoimento" subtitle="Resultados reais de quem compara antes de comprar.">
        <View style={styles.quote}>
          <Text style={styles.quoteText}>
            "Comecei a usar e já economizei mais de R$ 120 no último mês."
          </Text>
          <Text style={styles.quoteAuthor}>Maria Silva</Text>
        </View>
      </SectionCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  kpis: {
    flexDirection: "row",
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.white,
    padding: 12,
  },
  kpiValue: {
    fontSize: 30,
    fontWeight: "700",
    color: palette.primaryDeep,
  },
  kpiLabel: {
    marginTop: 4,
    fontSize: 12,
    color: palette.muted,
  },
  quote: {
    borderRadius: 12,
    backgroundColor: palette.surfaceStrong,
    padding: 12,
  },
  quoteText: {
    fontSize: 14,
    lineHeight: 20,
    color: palette.ink,
  },
  quoteAuthor: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "700",
    color: palette.primaryDeep,
  },
});
