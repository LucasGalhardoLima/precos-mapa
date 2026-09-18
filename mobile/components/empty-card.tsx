import { Text, View, StyleSheet } from 'react-native';
import { colors, fontFamily, radii, spacing, borderWidth } from '../constants/tokens';

interface EmptyCardProps {
  children: string;
}

// e.g. "Nenhum ainda. Ao ver o preço de um produto, toque em 'acompanhar
// este item'." — dashed border, no icon/illustration per "nada de informação
// não solicitada".
export function EmptyCard({ children }: EmptyCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth,
    borderStyle: 'dashed',
    borderColor: colors.borderDashed,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  text: {
    fontFamily: fontFamily.medium,
    fontSize: 15,
    color: colors.secondary,
    lineHeight: 21,
  },
});
