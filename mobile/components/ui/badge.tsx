import { View, Text } from "react-native";

type Variant = "discount" | "verified" | "expiring" | "below-normal";

const variantStyles: Record<Variant, { container: string; text: string }> = {
  discount: {
    container: "bg-brand-green rounded-md px-2 py-0.5",
    text: "text-white text-xs font-bold",
  },
  verified: {
    container: "bg-semantic-info/10 rounded-md px-2 py-0.5",
    text: "text-semantic-info text-xs font-semibold",
  },
  expiring: {
    container: "bg-semantic-error/10 rounded-md px-2 py-0.5",
    text: "text-semantic-error text-xs font-semibold",
  },
  "below-normal": {
    container: "bg-brand-orange/10 rounded-md px-2 py-0.5",
    text: "text-brand-orange text-xs font-semibold",
  },
};

interface BadgeProps {
  variant: Variant;
  label: string;
}

export function Badge({ variant, label }: BadgeProps) {
  const styles = variantStyles[variant];
  return (
    <View className={styles.container}>
      <Text className={styles.text}>{label}</Text>
    </View>
  );
}
