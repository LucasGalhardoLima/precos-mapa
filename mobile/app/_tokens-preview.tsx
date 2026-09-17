// Temporary screen — renders every Etapa 2 base component in every state,
// for the side-by-side screenshot against the artifact's "Design system"
// section. Not a real screen; delete once the PR is reviewed.
import { useState } from 'react';
import { ScrollView, View, Text } from 'react-native';
import { colors, typography, spacing } from '../constants/tokens';
import { FilledButton } from '../components/filled-button';
import { TextLink } from '../components/text-link';
import { ListRow } from '../components/list-row';
import { BlockLabel } from '../components/block-label';
import { Provenance } from '../components/provenance';
import { AmberBanner } from '../components/amber-banner';
import { EmptyCard } from '../components/empty-card';
import { SearchField } from '../components/search-field';
import { Chip } from '../components/chip';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.xl * 2 }}>
      <Text style={{ ...typography.support, color: colors.ink, marginBottom: spacing.md }}>{title}</Text>
      <View style={{ gap: spacing.md }}>{children}</View>
    </View>
  );
}

export default function TokensPreview() {
  const [query, setQuery] = useState('');
  const [query2, setQuery2] = useState('Arroz');
  const [selected, setSelected] = useState<Record<string, boolean>>({ Arroz: true, Detergente: false });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.xl }}>
      <Text style={{ ...typography.title, color: colors.ink, marginBottom: spacing.xl }}>Design system — preview</Text>

      <Section title="Botão preenchido (52 px)">
        <FilledButton label="Usar minha localização ›" onPress={() => {}} />
        <FilledButton label="Desabilitado" onPress={() => {}} disabled />
      </Section>

      <Section title="Texto-link com chevron">
        <TextLink label="ver todos os mercados" onPress={() => {}} />
      </Section>

      <Section title="Linha de lista">
        <ListRow title="Fato, sem chevron" subtitle="menor no Savegnago" />
        <ListRow title="Tocável, com chevron" subtitle="menor no Savegnago" chevron onPress={() => {}} />
        <ListRow title="Com ✕ à esquerda" subtitle="acompanhando" onRemove={() => {}} />
        <ListRow
          title="Com miniatura (image_url presente)"
          subtitle="menor no Savegnago"
          imageUrl="https://savegnagoio.vteximg.com.br/arquivos/ids/349096/figura1frente.jpg"
          chevron
          onPress={() => {}}
        />
        <ListRow title="Sem miniatura (image_url ausente) — a linha fecha o espaço" subtitle="menor no Savegnago" chevron onPress={() => {}} />
      </Section>

      <Section title="Rótulo de bloco">
        <BlockLabel>ONDE</BlockLabel>
      </Section>

      <Section title="Procedência">
        <Provenance>preço de hoje, 03:00 · Jaú Serve</Provenance>
      </Section>

      <Section title="Faixa âmbar">
        <AmberBanner>Amarelinha: preços de 5 dias atrás</AmberBanner>
      </Section>

      <Section title="Cartão tracejado de ausência">
        <EmptyCard>Nenhum ainda. Ao ver o preço de um produto, toque em &quot;acompanhar este item&quot;.</EmptyCard>
      </Section>

      <Section title="Campo de busca — vazio / em foco">
        <SearchField value={query} onChangeText={setQuery} />
        <SearchField value={query2} onChangeText={setQuery2} />
      </Section>

      <Section title="Chip">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {Object.keys(selected).map((label) => (
            <Chip
              key={label}
              label={label}
              selected={selected[label]}
              onToggle={() => setSelected((s) => ({ ...s, [label]: !s[label] }))}
            />
          ))}
        </View>
      </Section>
    </ScrollView>
  );
}
