import { View, TextInput, Pressable, Text } from "react-native";
import { Search, X } from "lucide-react-native";
import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/store/app-store";
import { useSearch } from "@/hooks/use-search";
import { Colors } from "@/constants/colors";

export function SearchBar() {
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
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
    setLocalQuery("");
    setSearchQuery("");
    setShowSuggestions(false);
  }, [setSearchQuery]);

  const handleSuggestionPress = useCallback(
    (suggestion: string) => {
      setLocalQuery(suggestion);
      setSearchQuery(suggestion);
      setShowSuggestions(false);
    },
    [setSearchQuery]
  );

  return (
    <View className="relative z-10">
      <View className="flex-row items-center bg-surface-tertiary rounded-xl px-4 py-3 gap-3">
        <Search size={20} color={Colors.text.tertiary} />
        <TextInput
          className="flex-1 text-base text-text-primary"
          placeholder="Buscar produto..."
          placeholderTextColor={Colors.text.tertiary}
          value={localQuery}
          onChangeText={(text) => {
            setLocalQuery(text);
            setShowSuggestions(text.length >= 2);
          }}
          onFocus={() => setShowSuggestions(localQuery.length >= 2)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        />
        {localQuery.length > 0 && (
          <Pressable onPress={handleClear}>
            <X size={18} color={Colors.text.tertiary} />
          </Pressable>
        )}
      </View>

      {showSuggestions && suggestions.length > 0 && (
        <View className="absolute top-full left-0 right-0 bg-white rounded-xl mt-1 border border-border shadow-sm z-20">
          {suggestions.map((s, i) => (
            <Pressable
              key={i}
              className="px-4 py-3 border-b border-border-light"
              onPress={() => handleSuggestionPress(s)}
            >
              <Text className="text-sm text-text-primary">{s}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
