import { Pressable, Text, StyleSheet, type GestureResponderEvent } from 'react-native';
import { colors, fontFamily, radii, targets } from '../constants/tokens';

interface FilledButtonProps {
  label: string;
  onPress?: (e: GestureResponderEvent) => void;
  disabled?: boolean;
}

export function FilledButton({ label, onPress, disabled }: FilledButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
      accessibilityRole="button"
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: targets.button,
    backgroundColor: colors.brandInk,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: '#fff',
  },
});
