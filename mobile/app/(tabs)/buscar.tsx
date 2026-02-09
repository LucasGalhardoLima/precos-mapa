import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { mobileOffers } from "../../src/data/mock";
import { OfferCard } from "../../src/components/offer-card";
import { ScreenShell } from "../../src/components/screen-shell";
import { SectionCard } from "../../src/components/section-card";
import { TagChip } from "../../src/components/tag-chip";
import { palette } from "../../src/ui/theme";

const categories = ["Todos", "Mercearia", "Limpeza", "Laticínios", "Hortifruti"];

export default function BuscarScreen() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");

  const filtered = useMemo(() => {
    return mobileOffers.filter((offer) => {
      const matchesText = offer.name.toLowerCase().includes(query.toLowerCase());
      const matchesCategory = category === "Todos" || offer.category === category;
      return matchesText && matchesCategory;
    });
  }, [query, category]);

  return (
    <ScreenShell title="Buscar" subtitle="Encontre o melhor preço por produto e categoria.">
      <SectionCard title="Pesquisa inteligente" subtitle="Digite produto ou marca.">
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Ex: detergente, arroz..."
          placeholderTextColor="#90A49A"
          style={styles.searchInput}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chips}>
            {categories.map((item) => (
              <Text
                key={item}
                onPress={() => setCategory(item)}
                style={[styles.category, category === item ? styles.categoryActive : null]}
              >
                {item}
              </Text>
            ))}
          </View>
        </ScrollView>
      </SectionCard>

      <SectionCard title="Comparação" subtitle={`${filtered.length} resultados encontrados.`}>
        {filtered.length === 0 ? <TagChip label="Nenhum resultado para os filtros" /> : null}
        {filtered.map((offer) => (
          <OfferCard key={offer.id} offer={offer} />
        ))}
      </SectionCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  searchInput: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    backgroundColor: palette.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: palette.ink,
  },
  chips: {
    flexDirection: "row",
    marginTop: 2,
  },
  category: {
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.white,
    color: palette.muted,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 13,
    marginRight: 8,
    overflow: "hidden",
  },
  categoryActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
    color: palette.white,
  },
});
