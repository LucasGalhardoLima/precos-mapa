import { ScrollView, Pressable, Text } from "react-native";
import { useAppStore } from "@/store/app-store";
import type { SortMode } from "@/types";

const FILTERS: { label: string; mode: SortMode }[] = [
  { label: "Mais barato", mode: "cheapest" },
  { label: "Mais perto", mode: "nearest" },
  { label: "Acaba hoje", mode: "expiring" },
];

export function FilterChips() {
  const sortMode = useAppStore((s) => s.sortMode);
  const setSortMode = useAppStore((s) => s.setSortMode);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2"
    >
      {FILTERS.map((filter) => {
        const isActive = sortMode === filter.mode;
        return (
          <Pressable
            key={filter.mode}
            onPress={() => setSortMode(filter.mode)}
            className={`rounded-full px-4 py-2 border ${
              isActive
                ? "bg-brand-green border-brand-green"
                : "bg-white border-border"
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                isActive ? "text-white" : "text-text-secondary"
              }`}
            >
              {filter.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
