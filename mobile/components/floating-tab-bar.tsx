import { useEffect } from 'react';
import { View, Pressable, Text, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  Home,
  Search,
  MapPin,
  ListChecks,
  User,
} from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/use-theme';
import { triggerHaptic } from '@/hooks/use-haptics';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PILL_HEIGHT = 60;
const PILL_MARGIN_BOTTOM = 8;
const PILL_MARGIN_TOP = 8;
const PILL_MARGIN_HORIZONTAL = 16;

/** Total vertical space occupied by the pill above the safe-area insets.
 *  Screens use `TAB_BAR_HEIGHT + insets.bottom` for scroll padding. */
export const TAB_BAR_HEIGHT = PILL_HEIGHT + PILL_MARGIN_BOTTOM + PILL_MARGIN_TOP;

/** Spring configuration for tab animations. */
const SPRING_CONFIG = { damping: 15, stiffness: 150 };

// ---------------------------------------------------------------------------
// Tab metadata
// ---------------------------------------------------------------------------

const TAB_CONFIG: Record<string, { Icon: typeof Home; label: string }> = {
  index: { Icon: Home, label: 'Início' },
  search: { Icon: Search, label: 'Busca' },
  map: { Icon: MapPin, label: 'Mapa' },
  list: { Icon: ListChecks, label: 'Lista' },
  account: { Icon: User, label: 'Conta' },
};

// ---------------------------------------------------------------------------
// TabItem – animated individual tab
// ---------------------------------------------------------------------------

interface TabItemProps {
  Icon: typeof Home;
  label: string;
  isFocused: boolean;
  color: string;
  primaryColor: string;
  onPress: () => void;
  onLongPress: () => void;
  accessibilityLabel: string;
}

function TabItem({
  Icon,
  label,
  isFocused,
  color,
  primaryColor,
  onPress,
  onLongPress,
  accessibilityLabel,
}: TabItemProps) {
  const scale = useSharedValue(isFocused ? 1.2 : 1);
  const dotOpacity = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    scale.value = withSpring(isFocused ? 1.2 : 1, SPRING_CONFIG);
    dotOpacity.value = withSpring(isFocused ? 1 : 0, SPRING_CONFIG);
  }, [isFocused, scale, dotOpacity]);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const dotAnimatedStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value,
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tab}
    >
      <Animated.View style={iconAnimatedStyle}>
        <Icon size={22} color={color} />
      </Animated.View>
      <Text style={[styles.label, { color }]}>{label}</Text>
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: primaryColor },
          dotAnimatedStyle,
        ]}
      />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// FloatingTabBar
// ---------------------------------------------------------------------------

export function FloatingTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();

  return (
    <View
      style={[
        styles.outerContainer,
        { bottom: insets.bottom + PILL_MARGIN_BOTTOM },
      ]}
    >
      <BlurView intensity={80} tint="light" style={styles.blurContainer}>
        <View style={styles.tintOverlay} />
        <View style={styles.tabRow}>
          {state.routes.map((route, index) => {
            const config = TAB_CONFIG[route.name];

            // Hidden routes (favorites, alerts, profile) have no config — skip.
            if (!config) return null;

            const isFocused = state.index === index;
            const color = isFocused ? tokens.primary : tokens.textHint;

            const { Icon, label } = config;

            const onPress = () => {
              triggerHaptic();
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            return (
              <TabItem
                key={route.key}
                Icon={Icon}
                label={label}
                isFocused={isFocused}
                color={color}
                primaryColor={tokens.primary}
                onPress={onPress}
                onLongPress={onLongPress}
                accessibilityLabel={label}
              />
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    left: PILL_MARGIN_HORIZONTAL,
    right: PILL_MARGIN_HORIZONTAL,
    borderRadius: 28,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  blurContainer: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  tintOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  tabRow: {
    flexDirection: 'row',
    height: PILL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 2,
  },
});
