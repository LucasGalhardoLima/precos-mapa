import { useState } from 'react';
import { TextInput, StyleSheet, type TextInputProps } from 'react-native';
import { colors, fontFamily, radii, targets, borderWidth, spacing } from '../constants/tokens';

// Plain one-line text field (e-mail in onboarding "Fora de Matão", artifact
// 7c): 52 px, border 1.5 that turns brand on focus, placeholder in the
// absence gray. SearchField is the same box with a search icon and a ✕.
export function TextField(props: TextInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      placeholderTextColor={colors.absence}
      selectionColor={colors.brand}
      {...props}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      style={[styles.field, focused && styles.focused, props.style]}
    />
  );
}

const styles = StyleSheet.create({
  field: {
    height: targets.button,
    backgroundColor: '#fff',
    borderWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xl,
    fontFamily: fontFamily.medium,
    fontSize: 16,
    color: colors.ink,
  },
  focused: {
    borderColor: colors.brand,
  },
});
