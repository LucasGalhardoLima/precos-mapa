import { Text, View, StyleSheet } from 'react-native';
import { colors, fontFamily, radii, spacing } from '../constants/tokens';

interface AmberBannerProps {
  children: string;
}

// Staleness warning, e.g. "Amarelinha: preços de 5 dias atrás" — never for
// error states (that's red, not amber; see mobile/CLAUDE.md's hard rules).
export function AmberBanner({ children }: AmberBannerProps) {
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.amberBackground,
    borderRadius: radii.md,
    paddingVertical: 11,
    paddingHorizontal: spacing.lg,
  },
  text: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: colors.amberText,
  },
});
