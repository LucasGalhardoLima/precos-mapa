import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Switch, Linking, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { colors, fontFamily, typography, spacing, radii, targets, borderWidth } from '../constants/tokens';
import { BackLink } from '../components/back-link';
import { BlockLabel } from '../components/block-label';
import { ListRow } from '../components/list-row';
import { EmptyCard } from '../components/empty-card';
import { TextLink } from '../components/text-link';
import { StorePickerSheet } from '../components/store-picker-sheet';
import { useAnalytics } from '../hooks/use-analytics';
import { useLocation } from '../hooks/use-location';
import { useStores } from '../hooks/use-stores';
import { useTrackedList, type TrackedListItem } from '../hooks/use-tracked-list';
import { useNotificationSetting } from '../hooks/use-notification-setting';
import { getPreferredChain, setPreferredChain } from '../lib/preferred-store';
import {
  UNDO_MS,
  trackedHeader,
  verTodosLabel,
  visibleItems,
  hasMoreItems,
  undoText,
  resolveHereStore,
  hereSubtitle,
  cityLabel,
} from '../lib/ajustes';
import { PRIVACY_URL, policyLinkUrl, type PolicyLink } from '../lib/privacy-url';

const FOOTER_LINKS: readonly PolicyLink[] = ['sobre', 'termos', 'privacidade'];

export default function SettingsScreen() {
  const router = useRouter();
  const { track, trackScreen } = useAnalytics();
  const { latitude, longitude, city, hasResolvedLocation } = useLocation({ autoRequest: false });
  const { stores, isLoading: storesLoading } = useStores(latitude, longitude);
  const { items, status, remove, restore, retry } = useTrackedList();
  const { ui: notificationUi, toggle: toggleNotification } = useNotificationSetting();

  const [expanded, setExpanded] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [preferredChain, setPreferredChainState] = useState<string | null>(null);
  // Stack, so a second removal while the bar is up doesn't orphan the first.
  const [undoStack, setUndoStack] = useState<{ item: TrackedListItem; index: number }[]>([]);
  const undo = undoStack[undoStack.length - 1] ?? null;
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    trackScreen('ajustes');
  }, [trackScreen]);

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getPreferredChain().then((chain) => {
        if (!cancelled) setPreferredChainState(chain);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const handleRemove = useCallback(
    async (item: TrackedListItem) => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
      const removed = await remove(item.id);
      if (!removed) return;
      track('settings_item_removed', { productId: item.productId ?? undefined });
      setUndoStack((st) => [...st, removed]);
      undoTimer.current = setTimeout(() => setUndoStack([]), UNDO_MS);
    },
    [remove, track],
  );

  const handleUndo = useCallback(async () => {
    if (!undo) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    const { item, index } = undo;
    const rest = undoStack.slice(0, -1);
    setUndoStack(rest);
    if (rest.length > 0) undoTimer.current = setTimeout(() => setUndoStack([]), UNDO_MS);
    const ok = await restore(item, index);
    if (ok) track('settings_item_restored', { productId: item.productId ?? undefined });
  }, [undo, undoStack, restore, track]);

  const handlePick = useCallback(
    async (chainLabel: string) => {
      await setPreferredChain(chainLabel);
      setPreferredChainState(chainLabel);
      setPickerVisible(false);
      track('settings_location_changed', { metadata: { chain: chainLabel } });
    },
    [track],
  );

  const handleToggle = useCallback(async () => {
    const result = await toggleNotification();
    if (result === 'on') track('settings_notifications_on');
    else if (result === 'off') track('settings_notifications_off');
  }, [toggleNotification, track]);

  const openDeviceSettings = useCallback(() => {
    track('settings_notifications_blocked_link');
    Linking.openSettings();
  }, [track]);

  const openPolicyLink = useCallback(
    (link: PolicyLink) => {
      if (!PRIVACY_URL) return;
      track('settings_link_opened', { metadata: { link } });
      Linking.openURL(policyLinkUrl(PRIVACY_URL, link)).catch(() => {});
    },
    [track],
  );

  const here = resolveHereStore(stores, preferredChain);
  const subtitle = hereSubtitle(here);
  const blocked = notificationUi?.kind === 'blocked';
  const shown = visibleItems(items, expanded);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.backRow}>
        <BackLink onPress={() => router.back()} />
      </View>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <Text style={styles.title}>Ajustes</Text>

        <View style={styles.block}>
          {status === 'items' ? <BlockLabel>{trackedHeader(items.length)}</BlockLabel> : <BlockLabel>ITENS ACOMPANHADOS</BlockLabel>}
          {status === 'items' &&
            shown.map((item) => (
              <ListRow
                key={item.id}
                title={item.name}
                chevron={!!item.productId}
                chevronColor={colors.brand}
                onRemove={() => handleRemove(item)}
                // A generic item with no product pinned has no Resposta to open.
                onPress={
                  item.productId
                    ? () => {
                        track('settings_item_opened', { productId: item.productId! });
                        router.push(`/product/${item.productId}`);
                      }
                    : undefined
                }
              />
            ))}
          {status === 'items' && hasMoreItems(items.length, expanded) && (
            <TextLink
              label={verTodosLabel(items.length)}
              onPress={() => {
                track('settings_see_all_items');
                setExpanded(true);
              }}
            />
          )}
          {status === 'empty' && <EmptyCard>{'Nenhum ainda. Ao ver o preço de um produto, toque em "acompanhar este item".'}</EmptyCard>}
          {/* A failed read is not an empty list: never say "Nenhum ainda" for it. */}
          {status === 'error' && (
            <View>
              <Text style={styles.support}>Não deu para carregar seus itens.</Text>
              <TextLink label="Tentar de novo" onPress={retry} />
            </View>
          )}
        </View>

        <View style={styles.block}>
          <BlockLabel>LOCALIZAÇÃO</BlockLabel>
          <View style={styles.card}>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{cityLabel(hasResolvedLocation, city)}</Text>
              {subtitle ? <Text style={styles.cardSub}>{subtitle}</Text> : null}
            </View>
            <Pressable
              style={styles.trocar}
              accessibilityRole="button"
              onPress={() => {
                track('settings_location_swap_opened');
                setPickerVisible(true);
              }}
            >
              <Text style={styles.trocarLabel}>trocar</Text>
              <ChevronRight size={18} color={colors.brand} strokeWidth={2.4} />
            </Pressable>
          </View>
        </View>

        <View style={styles.block}>
          <BlockLabel>NOTIFICAÇÕES</BlockLabel>
          <View style={styles.card}>
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, blocked && { color: colors.secondary }]}>Avisar quando um item baixar</Text>
              {blocked ? (
                <View style={styles.blockedRow}>
                  <Text style={styles.cardSub}>bloqueado no aparelho · </Text>
                  <Pressable onPress={openDeviceSettings} accessibilityRole="button" style={styles.deviceLink}>
                    <Text style={styles.deviceLinkLabel}>Ajustes do aparelho</Text>
                    <ChevronRight size={14} color={colors.brand} strokeWidth={2.6} />
                  </Pressable>
                </View>
              ) : (
                <Text style={styles.cardSub}>no máximo 1 por dia</Text>
              )}
            </View>
            <Switch
              accessibilityLabel="Avisar quando um item baixar"
              value={notificationUi?.kind === 'on'}
              disabled={blocked || notificationUi === null}
              onValueChange={handleToggle}
              trackColor={{ false: colors.absence, true: colors.brandInk }}
              ios_backgroundColor={colors.absence}
              thumbColor="#fff"
              style={blocked ? styles.switchLocked : undefined}
            />
          </View>
        </View>

        <View style={styles.spacer} />
        {/* Hidden, not dead, while the build has no real policy URL: a link
            that opens a placeholder would be a broken promise. */}
        {PRIVACY_URL ? (
          <View style={styles.footer}>
            {FOOTER_LINKS.map((link, i) => (
              <View key={link} style={styles.footerItem}>
                {i > 0 ? <Text style={styles.footerDot}>·</Text> : null}
                <TextLink label={link} onPress={() => openPolicyLink(link)} />
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {undo && (
        <View style={styles.undoBar}>
          <Text style={styles.undoText}>{undoText(undo.item.name)}</Text>
          <Pressable onPress={handleUndo} accessibilityRole="button" style={styles.undoAction}>
            <Text style={styles.undoActionLabel}>desfazer</Text>
          </Pressable>
        </View>
      )}

      <StorePickerSheet visible={pickerVisible} stores={stores} isLoading={storesLoading} onClose={() => setPickerVisible(false)} onPick={handlePick} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  backRow: { paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  body: { flex: 1 },
  bodyContent: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xl, gap: spacing.xl - 2 },
  title: { ...typography.headlineSm, color: colors.ink },
  block: { gap: spacing.sm },
  support: { ...typography.support, color: colors.secondary },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    backgroundColor: '#fff',
    borderWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  cardText: { flex: 1, minWidth: 0 },
  cardTitle: { fontFamily: fontFamily.semibold, fontSize: 16, color: colors.ink },
  cardSub: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.secondary, marginTop: 2 },
  trocar: { minHeight: targets.touch, flexDirection: 'row', alignItems: 'center', gap: 2 },
  trocarLabel: { fontFamily: fontFamily.semibold, fontSize: 15, color: colors.brandInk },
  blockedRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 2 },
  deviceLink: { flexDirection: 'row', alignItems: 'center', minHeight: targets.touch, marginVertical: -spacing.sm },
  deviceLinkLabel: { fontFamily: fontFamily.semibold, fontSize: 13, color: colors.brandInk },
  switchLocked: { opacity: 0.55 },
  spacer: { flex: 1 },
  footer: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' },
  footerItem: { flexDirection: 'row', alignItems: 'center' },
  footerDot: { fontFamily: fontFamily.semibold, fontSize: 14, color: colors.absence, paddingHorizontal: spacing.xs },
  undoBar: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: spacing.xl,
    minHeight: targets.button,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 2,
    backgroundColor: colors.ink,
    borderRadius: radii.md,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs + 2,
  },
  undoText: { flex: 1, fontFamily: fontFamily.medium, fontSize: 15, color: '#fff' },
  undoAction: { height: targets.touch, paddingHorizontal: spacing.md, justifyContent: 'center' },
  undoActionLabel: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.laser },
});
