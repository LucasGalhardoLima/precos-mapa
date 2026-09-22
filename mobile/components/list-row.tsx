import { View, Text, Image, Pressable, StyleSheet, type GestureResponderEvent } from 'react-native';
import { ChevronRight, X } from 'lucide-react-native';
import { colors, fontFamily, radii, targets, borderWidth, spacing, tabularNums } from '../constants/tokens';

interface ListRowProps {
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  // Trailing price text (e.g. "R$ 24,90"), right-aligned, bold, tabular-nums.
  // "—" + muted is the "sem preço hoje" rendering (2a/4a on the artifact).
  value?: string;
  // "sem preço hoje" treatment (verified on the artifact's own row markup):
  // title drops to colors.secondary (subtitle is already that color), value
  // and chevron drop further to colors.absence — two different mutes, not one.
  muted?: boolean;
  chevron?: boolean; // fato nunca leva chevron — só linhas tocáveis
  // Onboarding's city-picker row (already shipped) relies on the original
  // brandInk default; Raiz/Resultado's price rows pass colors.brand
  // explicitly (verified var(--brand) on their own artifact markup) rather
  // than changing what every existing caller renders.
  chevronColor?: string;
  onRemove?: (e: GestureResponderEvent) => void; // presence alone shows the leading ✕
  onPress?: (e: GestureResponderEvent) => void;
}

// Card-styled row (min-height 64, verified on the artifact) used across
// Raiz/Resultado/Ajustes. No image_url → no thumbnail slot and no gray
// placeholder square; the row just closes the gap (per the 91.7%-coverage
// decision in docs/poup-mlp-decisoes.md).
export function ListRow({ title, subtitle, imageUrl, value, muted, chevron, chevronColor = colors.brandInk, onRemove, onPress }: ListRowProps) {
  const Container = onPress ? Pressable : View;
  const resolvedChevronColor = muted ? colors.absence : chevronColor;

  return (
    <Container style={styles.row} onPress={onPress} accessibilityRole={onPress ? 'button' : undefined}>
      {onRemove && (
        <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel="Remover" style={styles.removeTarget}>
          <X size={20} color={colors.absence} strokeWidth={2.2} />
        </Pressable>
      )}
      {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.thumbnail} /> : null}
      <View style={styles.textColumn}>
        <Text style={[styles.title, muted && styles.titleMuted]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? <Text style={[styles.value, muted && styles.valueMuted]}>{value}</Text> : null}
      {chevron && <ChevronRight size={18} color={resolvedChevronColor} strokeWidth={2.4} />}
    </Container>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    backgroundColor: '#fff',
    borderWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  removeTarget: {
    width: targets.touch,
    height: targets.touch,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.md, // touch target stays 44, visual gap stays 12
  },
  thumbnail: {
    width: targets.touch,
    height: targets.touch,
    borderRadius: 8,
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: fontFamily.medium,
    fontSize: 16,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: colors.secondary,
    marginTop: 2,
  },
  value: {
    fontFamily: fontFamily.extrabold,
    fontSize: 18,
    color: colors.ink,
    ...tabularNums,
  },
  titleMuted: {
    color: colors.secondary,
  },
  valueMuted: {
    color: colors.absence,
  },
});
