import { StyleSheet, Text, View } from "react-native";
import { palette } from "../ui/theme";

export function TagChip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  text: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: "600",
  },
});
