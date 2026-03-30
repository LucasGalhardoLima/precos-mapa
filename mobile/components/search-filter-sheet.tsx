import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { BottomSheetDefaultBackdropProps } from '@gorhom/bottom-sheet/lib/typescript/components/bottomSheetBackdrop/types';

import { useTheme } from '@/theme/use-theme';
import type { Store } from '@/types';

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

export interface SearchFilters {
  maxDistanceKm: number | null; // null = any
  maxPrice: number | null;      // null = any
  storeId: string | null;       // null = all
}

export const DEFAULT_FILTERS: SearchFilters = {
  maxDistanceKm: null,
  maxPrice: null,
  storeId: null,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SearchFilterSheetProps {
  filters: SearchFilters;
  onApply: (filters: SearchFilters) => void;
  stores: Store[];
}

// ---------------------------------------------------------------------------
// Filter options
// ---------------------------------------------------------------------------

const DISTANCE_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'Até 2 km', value: 2 },
  { label: 'Até 5 km', value: 5 },
  { label: 'Até 10 km', value: 10 },
  { label: 'Qualquer', value: null },
];

const PRICE_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'Até R$ 5', value: 5 },
  { label: 'Até R$ 15', value: 15 },
  { label: 'Até R$ 30', value: 30 },
  { label: 'Qualquer', value: null },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SearchFilterSheet = React.forwardRef<BottomSheet, SearchFilterSheetProps>(
  function SearchFilterSheet({ filters, onApply, stores }, ref) {
    const { tokens } = useTheme();
    const snapPoints = useMemo(() => ['55%'], []);

    // Local draft state (applied on "Aplicar filtros")
    const [draft, setDraft] = useState<SearchFilters>(filters);

    // Reset draft when sheet opens
    const handleChange = useCallback(
      (index: number) => {
        if (index === 0) setDraft(filters);
      },
      [filters],
    );

    const renderBackdrop = useCallback(
      (props: BottomSheetDefaultBackdropProps) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.35} />
      ),
      [],
    );

    const handleApply = useCallback(() => {
      onApply(draft);
      if (ref && 'current' in ref && ref.current) {
        ref.current.close();
      }
    }, [draft, onApply, ref]);

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onChange={handleChange}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={styles.handle}
        backgroundStyle={[styles.sheetBg, { backgroundColor: tokens.surface }]}
      >
        <View style={styles.sheetContent}>
          <Text style={[styles.sheetTitle, { color: tokens.textPrimary }]}>
            Filtrar resultados
          </Text>

          {/* Distance */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: COLORS.textMuted }]}>
              Distância máxima
            </Text>
            <View style={styles.optionRow}>
              {DISTANCE_OPTIONS.map((opt) => {
                const active = draft.maxDistanceKm === opt.value;
                return (
                  <Pressable
                    key={opt.label}
                    onPress={() => setDraft((d) => ({ ...d, maxDistanceKm: opt.value }))}
                    style={[
                      styles.optionChip,
                      active
                        ? { backgroundColor: 'rgba(13,148,136,0.08)', borderColor: tokens.primary }
                        : { borderColor: COLORS.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        { color: active ? tokens.primary : COLORS.textSecondary },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Price range */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: COLORS.textMuted }]}>
              Faixa de preço
            </Text>
            <View style={styles.optionRow}>
              {PRICE_OPTIONS.map((opt) => {
                const active = draft.maxPrice === opt.value;
                return (
                  <Pressable
                    key={opt.label}
                    onPress={() => setDraft((d) => ({ ...d, maxPrice: opt.value }))}
                    style={[
                      styles.optionChip,
                      active
                        ? { backgroundColor: 'rgba(13,148,136,0.08)', borderColor: tokens.primary }
                        : { borderColor: COLORS.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        { color: active ? tokens.primary : COLORS.textSecondary },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Store */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: COLORS.textMuted }]}>
              Mercado
            </Text>
            <View style={styles.optionRow}>
              <Pressable
                onPress={() => setDraft((d) => ({ ...d, storeId: null }))}
                style={[
                  styles.optionChip,
                  draft.storeId === null
                    ? { backgroundColor: 'rgba(13,148,136,0.08)', borderColor: tokens.primary }
                    : { borderColor: COLORS.border },
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    { color: draft.storeId === null ? tokens.primary : COLORS.textSecondary },
                  ]}
                >
                  Todos
                </Text>
              </Pressable>
              {stores.slice(0, 5).map((store) => {
                const active = draft.storeId === store.id;
                return (
                  <Pressable
                    key={store.id}
                    onPress={() => setDraft((d) => ({ ...d, storeId: store.id }))}
                    style={[
                      styles.optionChip,
                      active
                        ? { backgroundColor: 'rgba(13,148,136,0.08)', borderColor: tokens.primary }
                        : { borderColor: COLORS.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        { color: active ? tokens.primary : COLORS.textSecondary },
                      ]}
                    >
                      {store.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Apply button */}
          <Pressable
            onPress={handleApply}
            style={[styles.applyButton, { backgroundColor: tokens.primary }]}
          >
            <Text style={styles.applyButtonText}>Aplicar filtros</Text>
          </Pressable>
        </View>
      </BottomSheet>
    );
  },
);

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const COLORS = {
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
  },
  sheetBg: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 20,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
  },
  optionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  applyButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
