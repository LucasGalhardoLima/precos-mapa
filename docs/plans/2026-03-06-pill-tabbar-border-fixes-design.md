# Pill Tab Bar + Border Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the bottom tab bar into a frosted glass floating pill and fix all unsupported dashed border warnings.

**Architecture:** Replace the edge-to-edge tab bar container with a pill-shaped `BlurView` wrapper using `expo-blur`. Replace all 5 `borderStyle: 'dashed'` usages with solid borders (RN default). Existing screen padding formulas (`TAB_BAR_HEIGHT + insets.bottom`) continue working because `TAB_BAR_HEIGHT` is redefined to include pill margins.

**Tech Stack:** expo-blur, react-native-reanimated (existing), react-native-safe-area-context (existing)

---

### Task 1: Install expo-blur

**Files:**
- Modify: `mobile/package.json`

**Step 1: Install the package**

Run: `cd /Users/lucasgalhardo/Documents/Projects/precos-mapa/mobile && npx expo install expo-blur`

Expected: Package added to `package.json` dependencies.

**Step 2: Verify installation**

Run: `cd /Users/lucasgalhardo/Documents/Projects/precos-mapa/mobile && grep expo-blur package.json`

Expected: `"expo-blur": "~14.x.x"` (version depends on SDK 54 compatibility)

**Step 3: Commit**

```bash
cd /Users/lucasgalhardo/Documents/Projects/precos-mapa
git add mobile/package.json mobile/package-lock.json
git commit -m "feat(mobile): install expo-blur for frosted glass tab bar"
```

---

### Task 2: Transform FloatingTabBar into frosted glass pill

**Files:**
- Modify: `mobile/components/floating-tab-bar.tsx`

**Step 1: Rewrite floating-tab-bar.tsx**

Replace the entire file with:

```tsx
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
```

Key changes from current implementation:
- Import `BlurView` from `expo-blur`
- `TAB_BAR_HEIGHT` changes from `72` to `76` (60px pill + 8px bottom + 8px top margin)
- Container: `left/right: 16` (margins), `borderRadius: 28` (full pill), `bottom` is dynamic via `insets.bottom + 8`
- Background: `BlurView` with `intensity={80}` + semi-transparent white overlay (`rgba(255,255,255,0.6)`)
- Shadow direction flipped from `-4` to `+4` (pill floats, shadow below)
- No more `paddingBottom: insets.bottom` (pill floats above safe area instead of wrapping it)

**Step 2: Verify the app compiles**

Run: `cd /Users/lucasgalhardo/Documents/Projects/precos-mapa/mobile && npx expo start --clear`

Expected: App starts without errors. Tab bar renders as a floating frosted glass pill.

**Step 3: Commit**

```bash
cd /Users/lucasgalhardo/Documents/Projects/precos-mapa
git add mobile/components/floating-tab-bar.tsx
git commit -m "feat(mobile): frosted glass pill-shaped floating tab bar

Replace edge-to-edge bottom bar with a floating pill using expo-blur BlurView.
Pill has 16px horizontal margins, 28px border radius, 60px height."
```

---

### Task 3: Replace dashed borders in list-skeleton.tsx

**Files:**
- Modify: `mobile/components/skeleton/list-skeleton.tsx:20,54-64`

**Step 1: Remove dashed border logic**

In `mobile/components/skeleton/list-skeleton.tsx`:

1. Delete line 20 (`const isDashed = ...`) — no longer needed.
2. Replace lines 56-62 (the separator View) with:

```tsx
<View
  style={[
    styles.separator,
    { borderColor: tokens.border },
  ]}
/>
```

This removes `borderStyle: isDashed ? 'dashed' : 'solid'` entirely — solid is the RN default.

3. Remove the `palette` destructure from `useTheme()` on line 18 if no longer used. Change to:
```tsx
const { tokens } = useTheme();
```

**Step 2: Verify no dashed references remain**

Run: `grep -n "dashed\|isDashed" /Users/lucasgalhardo/Documents/Projects/precos-mapa/mobile/components/skeleton/list-skeleton.tsx`

Expected: No output.

**Step 3: Commit**

```bash
cd /Users/lucasgalhardo/Documents/Projects/precos-mapa
git add mobile/components/skeleton/list-skeleton.tsx
git commit -m "fix(mobile): replace dashed border with solid in list skeleton"
```

---

### Task 4: Replace dashed border in coupon-line.tsx

**Files:**
- Modify: `mobile/components/themed/coupon-line.tsx:53-57`

**Step 1: Remove borderStyle from dashedLine style**

In `mobile/components/themed/coupon-line.tsx`, update the `dashedLine` style (line 53-57) — remove `borderStyle: 'dashed'`:

```tsx
dashedLine: {
  flex: 1,
  borderBottomWidth: 1,
},
```

**Step 2: Verify no dashed references remain**

Run: `grep -n "dashed" /Users/lucasgalhardo/Documents/Projects/precos-mapa/mobile/components/themed/coupon-line.tsx`

Expected: No output.

**Step 3: Commit**

```bash
cd /Users/lucasgalhardo/Documents/Projects/precos-mapa
git add mobile/components/themed/coupon-line.tsx
git commit -m "fix(mobile): replace dashed border with solid in coupon line"
```

---

### Task 5: Replace dashed border in section-divider.tsx

**Files:**
- Modify: `mobile/components/themed/section-divider.tsx:27-31`

**Step 1: Remove borderStyle from inline style**

In `mobile/components/themed/section-divider.tsx`, update the inline style (lines 27-31) — remove `borderStyle: 'dashed'`:

```tsx
<View
  style={[
    {
      borderBottomWidth: 1,
      borderBottomColor: tokens.border,
    },
    style,
  ]}
/>
```

**Step 2: Update the JSDoc comment on line 20**

Change from:
```tsx
/** Subtle dashed-line section divider used across both palettes. */
```
To:
```tsx
/** Subtle section divider used across all palettes. */
```

**Step 3: Verify no dashed references remain**

Run: `grep -n "dashed" /Users/lucasgalhardo/Documents/Projects/precos-mapa/mobile/components/themed/section-divider.tsx`

Expected: No output.

**Step 4: Commit**

```bash
cd /Users/lucasgalhardo/Documents/Projects/precos-mapa
git add mobile/components/themed/section-divider.tsx
git commit -m "fix(mobile): replace dashed border with solid in section divider"
```

---

### Task 6: Replace dashed border in receipt-separator.tsx

**Files:**
- Modify: `mobile/components/encarte/receipt-separator.tsx:28-34`

**Step 1: Remove borderStyle from styles**

In `mobile/components/encarte/receipt-separator.tsx`, update the `line` style (lines 29-33) — remove `borderStyle: 'dashed'`:

```tsx
line: {
  alignSelf: 'stretch',
  borderBottomWidth: 1,
},
```

**Step 2: Update the JSDoc comment on lines 9-12**

Change from:
```tsx
/**
 * Dashed horizontal line that mimics the cut-line on receipt paper.
 *
 * A single `<View>` with a dashed bottom border — nothing more.
 */
```
To:
```tsx
/**
 * Horizontal line divider styled as a receipt paper separator.
 */
```

**Step 3: Verify no dashed references remain**

Run: `grep -n "dashed" /Users/lucasgalhardo/Documents/Projects/precos-mapa/mobile/components/encarte/receipt-separator.tsx`

Expected: No output.

**Step 4: Commit**

```bash
cd /Users/lucasgalhardo/Documents/Projects/precos-mapa
git add mobile/components/encarte/receipt-separator.tsx
git commit -m "fix(mobile): replace dashed border with solid in receipt separator"
```

---

### Task 7: Replace dashed border in economy-card.tsx

**Files:**
- Modify: `mobile/components/economy-card.tsx:118-126`

**Step 1: Remove borderStyle from inline style**

In `mobile/components/economy-card.tsx`, update the divider View (lines 119-126) — remove `borderStyle: 'dashed'`:

```tsx
{/* Divider */}
<View
  style={{
    marginVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  }}
/>
```

**Step 2: Verify no dashed references remain**

Run: `grep -n "dashed" /Users/lucasgalhardo/Documents/Projects/precos-mapa/mobile/components/economy-card.tsx`

Expected: No output.

**Step 3: Commit**

```bash
cd /Users/lucasgalhardo/Documents/Projects/precos-mapa
git add mobile/components/economy-card.tsx
git commit -m "fix(mobile): replace dashed border with solid in economy card"
```

---

### Task 8: Final verification

**Step 1: Verify no dashed borders remain in the codebase**

Run: `grep -rn "borderStyle.*dashed\|borderStyle.*dotted" /Users/lucasgalhardo/Documents/Projects/precos-mapa/mobile/`

Expected: No output.

**Step 2: Start the app and verify**

Run: `cd /Users/lucasgalhardo/Documents/Projects/precos-mapa/mobile && npx expo start --clear`

Expected:
- No "Unsupported dashed / dotted border style" warnings
- Frosted glass pill tab bar renders at bottom with horizontal margins
- Content scrolls behind the pill tab bar
- Tab icons, labels, dot indicators, and haptics work as before
- All 5 tabs navigable
