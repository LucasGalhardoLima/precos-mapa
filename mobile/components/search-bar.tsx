import { View, TextInput, Pressable, Text, StyleSheet } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { useState, useEffect, useCallback } from 'react';
import { useFilterStore } from '@/store/app-store';
import { useSearch } from '@/hooks/use-search';
import { useTheme } from '@/theme/use-theme';

export function SearchBar() {
  const { tokens } = useTheme();
  const searchQuery = useFilterStore((s) => s.searchQuery);
  const setSearchQuery = useFilterStore((s) => s.setSearchQuery);
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { suggestions } = useSearch(localQuery);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(localQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [localQuery, setSearchQuery]);

  const handleClear = useCallback(() => {
    setLocalQuery('');
    setSearchQuery('');
    setShowSuggestions(false);
  }, [setSearchQuery]);

  const handleSuggestionPress = useCallback(
    (suggestion: string) => {
      setLocalQuery(suggestion);
      setSearchQuery(suggestion);
      setShowSuggestions(false);
    },
    [setSearchQuery],
  );

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.searchBar,
          { backgroundColor: tokens.surface, borderColor: tokens.border },
        ]}
      >
        <Search size={18} color={tokens.textHint} />
        <TextInput
          style={[styles.searchInput, { color: tokens.textPrimary }]}
          placeholder="Buscar produto..."
          placeholderTextColor={tokens.textHint}
          value={localQuery}
          onChangeText={(text) => {
            setLocalQuery(text);
            setShowSuggestions(text.length >= 2);
          }}
          onFocus={() => setShowSuggestions(localQuery.length >= 2)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        />
        {localQuery.length > 0 && (
          <Pressable onPress={handleClear} hitSlop={8}>
            <X size={18} color={tokens.textHint} />
          </Pressable>
        )}
      </View>

      {showSuggestions && suggestions.length > 0 && (
        <View
          style={[
            styles.suggestionsContainer,
            { backgroundColor: tokens.surface, borderColor: tokens.border },
          ]}
        >
          {suggestions.map((s, i) => (
            <Pressable
              key={i}
              style={[styles.suggestionItem, { borderBottomColor: tokens.border }]}
              onPress={() => handleSuggestionPress(s)}
            >
              <Text style={[styles.suggestionText, { color: tokens.textPrimary }]}>
                {s}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
    zIndex: 20,
  },
  suggestionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionText: {
    fontSize: 14,
  },
});
