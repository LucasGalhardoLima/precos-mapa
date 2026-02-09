import { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { palette } from "../ui/theme";

interface ScreenShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function ScreenShell({ title, subtitle, children }: ScreenShellProps) {
  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.wrapper}>
      <LinearGradient colors={["#10B46E", "#27C48D"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroSubtitle}>{subtitle}</Text>
      </LinearGradient>
      <View style={styles.body}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: palette.surface,
  },
  content: {
    paddingBottom: 22,
  },
  hero: {
    marginTop: 14,
    marginHorizontal: 14,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 22,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: "white",
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    lineHeight: 20,
  },
  body: {
    marginTop: 12,
    gap: 12,
    paddingHorizontal: 14,
  },
});
