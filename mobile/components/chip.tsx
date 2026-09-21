import { Pressable, Text, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors, fontFamily, borderWidth, targets, spacing } from '../constants/tokens';

interface ChipProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
}

// Onboarding step-2 category chips. Verified exactly on the artifact,
// including the on/off color+weight pairing (own inline state logic, not a
// design-system-page swatch). The ✓ comes AFTER the label (artifact 7b:
// `{label}<svg check>`, stroke 3) — Etapa 2 had it before, fixed in Etapa 3.
export function Chip({ label, selected, onToggle }: ChipProps) {
  return (
    <Pressable
      onPress={onToggle}
      style={[styles.chip, selected ? styles.selected : styles.unselected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.label, { color: selected ? colors.brandInk : colors.ink, fontFamily: selected ? fontFamily.bold : fontFamily.medium }]}>
        {label}
      </Text>
      {selected && <Check size={16} color={colors.brandInk} strokeWidth={3} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: targets.touch,
    paddingHorizontal: spacing.xl,
    borderRadius: targets.touch / 2 + 1,
    borderWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unselected: {
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  selected: {
    borderColor: colors.brand,
    backgroundColor: colors.brandTint,
  },
  label: {
    fontSize: 16,
  },
});
