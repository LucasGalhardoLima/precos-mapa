import { useState } from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { colors, fontFamily, radii, targets, borderWidth, spacing } from '../constants/tokens';

interface SearchFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

// States: vazio (empty, gray icon/text) and em foco (green border + ✕ to
// clear). Verified empty state on the artifact; focused state composes the
// same tokens per the explicit spec ("borda verde e ✕") since the artifact's
// static mockup only renders the empty state.
export function SearchField({ value, onChangeText, placeholder = 'buscar produto' }: SearchFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.field, focused && styles.focused]}>
      <Search size={20} color={focused ? colors.secondary : colors.absence} strokeWidth={2.2} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.secondary}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, { color: focused ? colors.ink : colors.secondary }]}
      />
      {focused && value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} accessibilityRole="button" accessibilityLabel="Limpar busca">
          <X size={20} color={colors.absence} strokeWidth={2.2} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    height: targets.button,
    backgroundColor: '#fff',
    borderWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
  },
  focused: {
    borderColor: colors.brand,
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: 16,
  },
});
