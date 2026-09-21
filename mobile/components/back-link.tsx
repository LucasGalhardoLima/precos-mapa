import { Pressable, Text, StyleSheet, type GestureResponderEvent } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { colors, fontFamily, targets } from '../constants/tokens';

interface BackLinkProps {
  onPress?: (e: GestureResponderEvent) => void;
}

// "‹ voltar" in the header of a stacked screen (artifact 6a, Ajustes): 44 px
// target, 16/600 brand-ink, chevron-left in the same color.
export function BackLink({ onPress }: BackLinkProps) {
  return (
    <Pressable onPress={onPress} style={styles.link} accessibilityRole="button" accessibilityLabel="Voltar">
      <ChevronLeft size={20} color={colors.brandInk} strokeWidth={2.4} />
      <Text style={styles.label}>voltar</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    height: targets.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    color: colors.brandInk,
  },
});
