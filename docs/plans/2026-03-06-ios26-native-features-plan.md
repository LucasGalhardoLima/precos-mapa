# iOS 26 Native Features Adoption — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adopt iOS 26 platform features (tab bar minimize, Liquid Glass surfaces, zoom transitions, glass bottom sheets, snappier springs) with graceful fallback on older platforms.

**Architecture:** Use `expo-glass-effect` (`GlassView`, `isLiquidGlassAvailable()`) for glass surfaces with runtime detection. Use `expo-router` native props for tab minimize and zoom transitions. Update Moti animation configs for snappier springs. All changes are additive — non-iOS 26 devices keep current appearance.

**Tech Stack:** expo-glass-effect ~0.1.9, expo-router ~6.0.23 (NativeTabs, Stack), Moti (MotiView), @gorhom/bottom-sheet 5.2.8

---

### Task 1: Tab bar minimize on scroll

**Files:**
- Modify: `mobile/components/native-tab-layout.tsx`

**Step 1: Add minimizeBehavior prop**

```tsx
// mobile/components/native-tab-layout.tsx
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { useTheme } from '../theme/use-theme';

export function NativeTabLayout() {
  const { tokens } = useTheme();

  return (
    <NativeTabs tintColor={tokens.primary} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="index">
        <Icon sf="house.fill" />
        <Label>Início</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="search">
        <Icon sf="magnifyingglass" />
        <Label>Busca</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="map">
        <Icon sf="map.fill" />
        <Label>Mapa</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="list">
        <Icon sf="cart.fill" />
        <Label>Lista</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="account">
        <Icon sf="person.fill" />
        <Label>Conta</Label>
      </NativeTabs.Trigger>

      {/* Hidden legacy routes */}
      <NativeTabs.Trigger name="favorites" hidden />
      <NativeTabs.Trigger name="alerts" hidden />
      <NativeTabs.Trigger name="profile" hidden />
    </NativeTabs>
  );
}
```

**Step 2: Test on simulator**

Run the app, scroll down on Home/Search/List/Account screens. Tab bar should minimize. Scroll back up, it should expand. On the Map tab (no ScrollView), tab bar stays full.

**Step 3: Commit**

```bash
git add mobile/components/native-tab-layout.tsx
git commit -m "feat(mobile): tab bar minimize on scroll (iOS 26)"
```

---

### Task 2: Zoom transition for product detail

**Files:**
- Modify: `mobile/app/_layout.tsx`

**Step 1: Add product screen with zoom animation**

Add a `Stack.Screen` entry for `product/[id]` with `animation: 'ios_from_right'` as default and `animationTypeForReplace: 'push'`. On iOS 26+, use `'zoom'` animation. Since we can't conditionally check iOS version at the Stack level easily, use `'ios_from_right'` which is the standard iOS push — or try `'default'` which on iOS 26 may automatically use the zoom style.

Actually, Expo Router supports the zoom transition directly. Add the Stack.Screen:

```tsx
// In the <Stack> inside _layout.tsx, add before the closing </Stack>:
<Stack.Screen
  name="product/[id]"
  options={{
    animation: 'default',
  }}
/>
```

The `'default'` animation on iOS 26 uses the native push transition. For zoom specifically, the screen presenting the detail needs to use `unstable_sharedTransitionTag`. However, the simplest approach is:

```tsx
<Stack.Screen
  name="product/[id]"
  options={{
    presentation: 'card',
    animation: 'default',
  }}
/>
```

**Step 2: Test navigation**

Navigate from search results or home to a product detail. Verify the transition animates smoothly. On iOS 26 simulator, the native default push animation applies.

**Step 3: Commit**

```bash
git add mobile/app/_layout.tsx
git commit -m "feat(mobile): add product detail stack screen with native transition"
```

---

### Task 3: Glass floating pill on map

**Files:**
- Modify: `mobile/app/(tabs)/map.tsx`

**Step 1: Import GlassView and availability check**

Add at the top of map.tsx:

```tsx
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

const HAS_GLASS = isLiquidGlassAvailable();
```

**Step 2: Wrap the "Ver minha lista" pill in GlassView**

Replace the current pill (lines 363-371):

```tsx
{/* "Ver minha lista" floating pill button */}
{hasListItems && (
  <Pressable
    style={styles.listPill}
    onPress={handleShowListPanel}
  >
    {HAS_GLASS ? (
      <GlassView
        glassEffectStyle="regular"
        tintColor={tokens.primary}
        style={styles.listPillGlass}
      >
        <ListChecks size={16} color="#FFFFFF" />
        <Text style={styles.listPillText}>Ver minha lista</Text>
      </GlassView>
    ) : (
      <>
        <ListChecks size={16} color="#FFFFFF" />
        <Text style={styles.listPillText}>Ver minha lista</Text>
      </>
    )}
  </Pressable>
)}
```

Update styles — the `listPill` style should have `backgroundColor` only when not using glass:

```tsx
listPill: {
  position: 'absolute',
  top: 56,
  right: 16,
  zIndex: 20,
  borderRadius: 24,
  overflow: 'hidden',
  ...(!HAS_GLASS && {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: TOKENS.primary, // fallback solid
  }),
  ...Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
    },
    android: { elevation: 4 },
  }),
},
listPillGlass: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  paddingHorizontal: 14,
  paddingVertical: 10,
  borderRadius: 24,
},
```

Note: Since `StyleSheet.create` is static, we can't use `HAS_GLASS` inside it. Instead, apply `backgroundColor` conditionally inline:

```tsx
<Pressable
  style={[
    styles.listPill,
    !HAS_GLASS && { backgroundColor: tokens.primary },
  ]}
  onPress={handleShowListPanel}
>
```

And keep `listPill` without backgroundColor:

```tsx
listPill: {
  position: 'absolute',
  top: 56,
  right: 16,
  zIndex: 20,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  paddingHorizontal: 14,
  paddingVertical: 10,
  borderRadius: 24,
  overflow: 'hidden',
  ...Platform.select({ ... }),
},
```

When `HAS_GLASS` is true, wrap children in `GlassView`. When false, apply solid `backgroundColor` inline.

**Step 3: Test**

On iOS 26 simulator: pill should have glass effect with green tint floating over map.
On older iOS / Android: pill should look the same as before (solid green).

**Step 4: Commit**

```bash
git add "mobile/app/(tabs)/map.tsx"
git commit -m "feat(mobile): glass effect on floating list pill (iOS 26)"
```

---

### Task 4: Glass location banner on map

**Files:**
- Modify: `mobile/app/(tabs)/map.tsx` (same file as Task 3)

**Step 1: Wrap location banner in GlassView**

Replace the location banner (lines 344-360):

```tsx
{permissionGranted === false && (
  <View
    style={[
      styles.locationBanner,
      !HAS_GLASS && { backgroundColor: tokens.surface, borderColor: tokens.border },
    ]}
  >
    {HAS_GLASS ? (
      <GlassView glassEffectStyle="regular" style={styles.locationBannerGlass}>
        <View style={styles.locationBannerRow}>
          <MapPin size={18} color={Colors.semantic.warning} />
          <Text style={[styles.locationBannerText, { color: tokens.textSecondary }]}>
            Permita acesso à localização para ver lojas perto de você
          </Text>
        </View>
      </GlassView>
    ) : (
      <View style={styles.locationBannerRow}>
        <MapPin size={18} color={Colors.semantic.warning} />
        <Text style={[styles.locationBannerText, { color: tokens.textSecondary }]}>
          Permita acesso à localização para ver lojas perto de você
        </Text>
      </View>
    )}
  </View>
)}
```

Add style:

```tsx
locationBannerGlass: {
  borderRadius: 12,
  padding: 16,
},
```

Remove `backgroundColor` and `borderColor` from `locationBanner` base style (keep only position/layout), apply them conditionally for non-glass fallback.

**Step 2: Test and commit**

```bash
git add "mobile/app/(tabs)/map.tsx"
git commit -m "feat(mobile): glass location banner on map (iOS 26)"
```

---

### Task 5: Glass search bar

**Files:**
- Modify: `mobile/app/(tabs)/search.tsx`

**Step 1: Import GlassView**

```tsx
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

const HAS_GLASS = isLiquidGlassAvailable();
```

**Step 2: Wrap search bar**

Replace the search bar View (lines 99-120). When glass is available, use GlassView as the container instead of the solid View:

```tsx
{/* Search input */}
{HAS_GLASS ? (
  <GlassView
    glassEffectStyle="regular"
    style={styles.searchBar}
  >
    <Search size={18} color={tokens.textHint} />
    <TextInput
      style={[styles.searchInput, { color: tokens.textPrimary }]}
      placeholder="Buscar produto..."
      placeholderTextColor={tokens.textHint}
      value={query}
      onChangeText={setQuery}
      returnKeyType="search"
      autoCorrect={false}
    />
    {query.length > 0 && (
      <Pressable onPress={clearQuery} hitSlop={8}>
        <X size={18} color={tokens.textHint} />
      </Pressable>
    )}
  </GlassView>
) : (
  <View
    style={[
      styles.searchBar,
      { backgroundColor: tokens.surface, borderColor: tokens.border },
    ]}
  >
    <Search size={18} color={tokens.textHint} />
    <TextInput
      style={[styles.searchInput, { color: tokens.textPrimary }]}
      placeholder="Buscar produto..."
      placeholderTextColor={tokens.textHint}
      value={query}
      onChangeText={setQuery}
      returnKeyType="search"
      autoCorrect={false}
    />
    {query.length > 0 && (
      <Pressable onPress={clearQuery} hitSlop={8}>
        <X size={18} color={tokens.textHint} />
      </Pressable>
    )}
  </View>
)}
```

To avoid duplicating the inner content, extract it:

```tsx
const searchInputContent = (
  <>
    <Search size={18} color={tokens.textHint} />
    <TextInput
      style={[styles.searchInput, { color: tokens.textPrimary }]}
      placeholder="Buscar produto..."
      placeholderTextColor={tokens.textHint}
      value={query}
      onChangeText={setQuery}
      returnKeyType="search"
      autoCorrect={false}
    />
    {query.length > 0 && (
      <Pressable onPress={clearQuery} hitSlop={8}>
        <X size={18} color={tokens.textHint} />
      </Pressable>
    )}
  </>
);

// Then in JSX:
{HAS_GLASS ? (
  <GlassView glassEffectStyle="regular" style={styles.searchBar}>
    {searchInputContent}
  </GlassView>
) : (
  <View style={[styles.searchBar, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
    {searchInputContent}
  </View>
)}
```

**Step 3: Test and commit**

```bash
git add "mobile/app/(tabs)/search.tsx"
git commit -m "feat(mobile): glass search bar (iOS 26)"
```

---

### Task 6: Glass sort/filter pills

**Files:**
- Modify: `mobile/app/(tabs)/search.tsx` (same file as Task 5)

**Step 1: Update inactive sort pills to use glass**

In the sort tabs section (lines 123-155), for inactive pills use GlassView:

```tsx
{SORT_TABS.map((tab) => {
  const active = sortMode === tab.mode;
  return (
    <Pressable
      key={tab.mode}
      onPress={() => {
        triggerHaptic();
        setSortMode(tab.mode);
      }}
      style={[
        styles.sortPill,
        active
          ? { backgroundColor: tokens.primary }
          : !HAS_GLASS
            ? { backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border }
            : { overflow: 'hidden' },
      ]}
    >
      {!active && HAS_GLASS ? (
        <GlassView glassEffectStyle="clear" style={styles.sortPillGlass}>
          <Text style={[styles.sortPillText, { color: tokens.textSecondary }]}>
            {tab.label}
          </Text>
        </GlassView>
      ) : (
        <Text
          style={[
            styles.sortPillText,
            { color: active ? '#FFFFFF' : tokens.textSecondary },
          ]}
        >
          {tab.label}
        </Text>
      )}
    </Pressable>
  );
})}
```

Add style:

```tsx
sortPillGlass: {
  paddingHorizontal: 14,
  paddingVertical: 8,
  borderRadius: 20,
},
```

When glass is active on inactive pills, remove padding from `sortPill` and let `sortPillGlass` handle it. When glass is not active, keep current padding.

**Step 2: Test and commit**

```bash
git add "mobile/app/(tabs)/search.tsx"
git commit -m "feat(mobile): glass sort pills on search (iOS 26)"
```

---

### Task 7: Glass store bottom sheet

**Files:**
- Modify: `mobile/components/store-bottom-sheet.tsx`

**Step 1: Import GlassView**

```tsx
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

const HAS_GLASS = isLiquidGlassAvailable();
```

**Step 2: Update BottomSheet background and content**

Set transparent background when glass is available, wrap content in GlassView:

```tsx
<BottomSheet
  ref={ref}
  index={-1}
  snapPoints={snapPoints}
  onChange={handleSheetChanges}
  enablePanDownToClose
  backgroundStyle={{
    borderRadius: 24,
    ...(HAS_GLASS && { backgroundColor: 'transparent' }),
  }}
  handleIndicatorStyle={{ backgroundColor: Colors.text.tertiary }}
>
  {HAS_GLASS ? (
    <GlassView glassEffectStyle="regular" style={{ flex: 1, borderRadius: 24 }}>
      <BottomSheetView className="flex-1 px-5 pb-6">
        {/* ... existing content unchanged ... */}
      </BottomSheetView>
    </GlassView>
  ) : (
    <BottomSheetView className="flex-1 px-5 pb-6">
      {/* ... existing content unchanged ... */}
    </BottomSheetView>
  )}
</BottomSheet>
```

To avoid duplicating the sheet content, extract it into a variable or inner component:

```tsx
const sheetContent = (
  <BottomSheetView className="flex-1 px-5 pb-6">
    {/* Store Header */}
    <View className="flex-row items-center gap-3 mb-4">
      {/* ... all existing content ... */}
    </View>
    {/* ... rest of content ... */}
  </BottomSheetView>
);

// Then:
{HAS_GLASS ? (
  <GlassView glassEffectStyle="regular" style={{ flex: 1, borderRadius: 24 }}>
    {sheetContent}
  </GlassView>
) : (
  sheetContent
)}
```

**Step 3: Test and commit**

```bash
git add mobile/components/store-bottom-sheet.tsx
git commit -m "feat(mobile): glass store bottom sheet (iOS 26)"
```

---

### Task 8: Glass list panel bottom sheet on map

**Files:**
- Modify: `mobile/app/(tabs)/map.tsx` (same file as Tasks 3-4)

**Step 1: Update list panel bottom sheet**

Apply the same pattern as Task 7 to the list panel BottomSheet in map.tsx (around line 491):

```tsx
<BottomSheet
  ref={listBottomSheetRef}
  index={-1}
  snapPoints={listSnapPoints}
  enablePanDownToClose
  backgroundStyle={[
    styles.listSheetBg,
    { backgroundColor: HAS_GLASS ? 'transparent' : tokens.bg },
  ]}
  handleIndicatorStyle={{ backgroundColor: tokens.textHint }}
>
  {HAS_GLASS ? (
    <GlassView glassEffectStyle="regular" style={{ flex: 1, borderRadius: 24 }}>
      <BottomSheetView style={styles.listSheetContent}>
        {/* ... existing header, subtitle, FlatList content ... */}
      </BottomSheetView>
    </GlassView>
  ) : (
    <BottomSheetView style={styles.listSheetContent}>
      {/* ... existing content ... */}
    </BottomSheetView>
  )}
</BottomSheet>
```

Again, extract content into a variable to avoid duplication.

**Step 2: Test and commit**

```bash
git add "mobile/app/(tabs)/map.tsx"
git commit -m "feat(mobile): glass list panel bottom sheet (iOS 26)"
```

---

### Task 9: Snappier animation springs — deal cards

**Files:**
- Modify: `mobile/components/deal-card.tsx`
- Modify: `mobile/components/featured-deals-carousel.tsx`

**Step 1: Update DealCard animation**

In `deal-card.tsx` line 19, change:

```tsx
// Before:
transition={{ type: 'timing', duration: 350, delay: index * 60 }}

// After:
transition={{ type: 'spring', damping: 15, stiffness: 150, delay: index * 50 }}
```

**Step 2: Update CompactDealCard animation**

In `featured-deals-carousel.tsx` line 18, change:

```tsx
// Before:
transition={{ type: 'timing', duration: 350, delay: index * 80 }}

// After:
transition={{ type: 'spring', damping: 15, stiffness: 150, delay: index * 60 }}
```

**Step 3: Test and commit**

Verify cards animate with a snappy spring (slight overshoot, faster settle) instead of linear timing.

```bash
git add mobile/components/deal-card.tsx mobile/components/featured-deals-carousel.tsx
git commit -m "feat(mobile): snappier spring animations for deal cards"
```

---

### Task 10: Snappier springs — social proof and onboarding

**Files:**
- Modify: `mobile/components/social-proof.tsx`
- Modify: `mobile/app/onboarding.tsx`

**Step 1: Update social proof animations**

In `social-proof.tsx`:

Line 16 (stats row):
```tsx
// Before:
transition={{ type: 'timing', duration: 500 }}

// After:
transition={{ type: 'spring', damping: 15, stiffness: 120 }}
```

Line 50 (testimonials):
```tsx
// Before:
transition={{ type: 'timing', duration: 400, delay: index * 100 }}

// After:
transition={{ type: 'spring', damping: 15, stiffness: 130, delay: index * 80 }}
```

**Step 2: Update onboarding entrance animations**

In `onboarding.tsx`, find all `MotiView` `transition` props and update timing-based animations to springs. For entrance animations, use:

```tsx
transition={{ type: 'spring', damping: 15, stiffness: 130, delay: N }}
```

Keep the same delay values to preserve stagger ordering.

**Step 3: Test and commit**

```bash
git add mobile/components/social-proof.tsx mobile/app/onboarding.tsx
git commit -m "feat(mobile): snappier springs for social proof and onboarding"
```

---

### Task 11: Final verification and cleanup

**Step 1: Run TypeScript check**

```bash
cd mobile && npx tsc --noEmit 2>&1 | grep -E "(map\.tsx|search\.tsx|store-bottom-sheet|native-tab-layout|deal-card|carousel|social-proof|onboarding|_layout\.tsx)"
```

Only pre-existing errors should appear. Fix any new errors.

**Step 2: Test on simulator**

- Home: scroll down → tab bar minimizes
- Search: glass search bar, glass inactive sort pills
- Map: glass floating pill, glass location banner (deny location), glass bottom sheets
- Product detail: smooth native transition from search
- Deal cards: snappy spring entrance animations
- Onboarding: snappy entrance animations

**Step 3: Commit any fixes**

```bash
git commit -m "fix(mobile): iOS 26 features cleanup"
```
