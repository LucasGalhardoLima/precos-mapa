import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { palette } from "../../src/ui/theme";

function TabIcon({ name, color, size }: { name: keyof typeof Ionicons.glyphMap; color: string; size: number }) {
  return <Ionicons name={name} color={color} size={size} />;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.primaryDeep,
        tabBarInactiveTintColor: "#7B8F84",
        tabBarStyle: {
          borderTopColor: palette.line,
          backgroundColor: "#FFFFFF",
          height: 62,
          paddingBottom: 6,
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: ({ color, size }) => <TabIcon name="home-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="buscar" options={{ title: "Buscar", tabBarIcon: ({ color, size }) => <TabIcon name="search-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="mapa" options={{ title: "Mapa", tabBarIcon: ({ color, size }) => <TabIcon name="map-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="favoritos" options={{ title: "Favoritos", tabBarIcon: ({ color, size }) => <TabIcon name="heart-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="alertas" options={{ title: "Alertas", tabBarIcon: ({ color, size }) => <TabIcon name="notifications-outline" color={color} size={size} /> }} />
    </Tabs>
  );
}
