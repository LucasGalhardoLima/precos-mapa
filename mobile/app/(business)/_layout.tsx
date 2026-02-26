import { useEffect } from 'react';
import { Tabs, router } from 'expo-router';
import { LayoutDashboard, Tag, Upload, Store } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@precomapa/shared';

export default function BusinessTabLayout() {
  const session = useAuthStore((s) => s.session);

  useEffect(() => {
    if (session === null) {
      router.replace('/onboarding');
    }
  }, [session]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.tab.active,
        tabBarInactiveTintColor: Colors.tab.inactive,
        tabBarStyle: {
          backgroundColor: Colors.surface.primary,
          borderTopColor: Colors.border.default,
          height: 88,
          paddingBottom: 28,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        animation: 'shift',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="offers"
        options={{
          title: 'Ofertas',
          tabBarIcon: ({ color, size }) => (
            <Tag size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="importer"
        options={{
          title: 'Importador',
          tabBarIcon: ({ color, size }) => (
            <Upload size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Loja',
          tabBarIcon: ({ color, size }) => (
            <Store size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
