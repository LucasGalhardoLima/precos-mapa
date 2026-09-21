import { useState } from 'react';
import { Pressable, Text, StyleSheet, type GestureResponderEvent } from 'react-native';
import { colors, fontFamily, radii, targets } from '../constants/tokens';

interface FilledButtonProps {
  label: string;
  onPress?: (e: GestureResponderEvent) => void;
}

// Never disabled: mobile/CLAUDE.md — "nenhum botão fica desabilitado
// esperando o usuário fazer algo opcional". Pressed feedback is tracked in
// state instead of Pressable's `style={({ pressed }) => ...}` form because
// under nativewind's jsxImportSource that function form dropped the whole
// style (no background, height or centering — seen in the Etapa 1+2
// screenshot); a static style array renders correctly, like Chip and ListRow.
export function FilledButton({ label, onPress }: FilledButtonProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[styles.button, pressed && styles.pressed]}
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
  label: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: '#fff',
  },
});
