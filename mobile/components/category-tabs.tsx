import { ScrollView, Pressable, Text, View } from "react-native";
import {
  Package,
  Coffee,
  Sparkles,
  Wheat,
  Apple,
  Croissant,
  Heart,
} from "lucide-react-native";
import { useCategories } from "@/hooks/use-categories";
import { useAppStore } from "@/store/app-store";
import { Colors } from "@/constants/colors";
import type { ComponentType } from "react";

const ICON_MAP: Record<string, ComponentType<{ size: number; color: string }>> = {
  package: Package,
  coffee: Coffee,
  sparkles: Sparkles,
  wheat: Wheat,
  apple: Apple,
  croissant: Croissant,
  heart: Heart,
};

export function CategoryTabs() {
  const { categories } = useCategories();
  const selectedCategoryId = useAppStore((s) => s.selectedCategoryId);
  const setSelectedCategoryId = useAppStore((s) => s.setSelectedCategoryId);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-1"
    >
      {categories.map((cat) => {
        const isActive =
          selectedCategoryId === cat.id ||
          (!selectedCategoryId && cat.id === "cat_todos");
        const IconComponent = ICON_MAP[cat.icon] ?? Package;
        return (
          <Pressable
            key={cat.id}
            onPress={() =>
              setSelectedCategoryId(cat.id === "cat_todos" ? null : cat.id)
            }
            className="items-center px-3 py-2"
          >
            <IconComponent
              size={22}
              color={isActive ? Colors.brand.green : Colors.text.tertiary}
            />
            <Text
              className={`text-xs mt-1 font-medium ${
                isActive ? "text-brand-green" : "text-text-tertiary"
              }`}
            >
              {cat.name}
            </Text>
            {isActive && (
              <View className="w-6 h-0.5 bg-brand-green rounded-full mt-1" />
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
