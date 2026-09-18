import { View, Text, Image, Pressable, StyleSheet, type GestureResponderEvent } from 'react-native';
import { ChevronRight, X } from 'lucide-react-native';
import { colors, fontFamily, radii, targets, borderWidth, spacing } from '../constants/tokens';

interface ListRowProps {
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  chevron?: boolean; // fato nunca leva chevron — só linhas tocáveis
  onRemove?: (e: GestureResponderEvent) => void; // presence alone shows the leading ✕
  onPress?: (e: GestureResponderEvent) => void;
}

// Card-styled row (min-height 64, verified on the artifact) used across
// Raiz/Resultado/Ajustes. No image_url → no thumbnail slot and no gray
// placeholder square; the row just closes the gap (per the 91.7%-coverage
// decision in docs/poup-mlp-decisoes.md).
export function ListRow({ title, subtitle, imageUrl, chevron, onRemove, onPress }: ListRowProps) {
  const Container = onPress ? Pressable : View;

  return (
    <Container style={styles.row} onPress={onPress} accessibilityRole={onPress ? 'button' : undefined}>
      {onRemove && (
        <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel="Remover" style={styles.removeTarget}>
          <X size={20} color={colors.absence} strokeWidth={2.2} />
        </Pressable>
      )}
      {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.thumbnail} /> : null}
      <View style={styles.textColumn}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {chevron && <ChevronRight size={20} color={colors.brandInk} strokeWidth={2.2} />}
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
});
