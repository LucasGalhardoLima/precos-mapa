import { Pressable, Text, StyleSheet, type GestureResponderEvent } from 'react-native';
import { colors, fontFamily, targets } from '../constants/tokens';

interface TextLinkProps {
  label: string;
  onPress?: (e: GestureResponderEvent) => void;
  // brand-ink is calibrated for the app's light surfaces; app/scan.tsx is
  // the one dark surface (mobile/CLAUDE.md) and needs the lighter brand
  // green to stay readable — still one of the system's two green tokens,
  // not a new color.
  color?: string;
}

// "texto-link com chevron" — e.g. "ver todos os mercados ›". Verified against
// the artifact's own rendering: height 44 (touch target), 15/600, brand-ink.
export function TextLink({ label, onPress, color = colors.brandInk }: TextLinkProps) {
  return (
    <Pressable onPress={onPress} style={styles.link} accessibilityRole="button">
      <Text style={[styles.label, { color }]}>{label} ›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    height: targets.touch,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.brandInk,
  },
});
