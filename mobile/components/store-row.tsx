import { View, Text, Pressable, StyleSheet, type GestureResponderEvent } from 'react-native';
import { colors, fontFamily, radii, borderWidth, spacing, tabularNums } from '../constants/tokens';
import { formatBRL } from '../hooks/use-search';

interface StoreRowProps {
  storeName: string;
  distanceKm: number | null;
  price: number;
  isWinner: boolean;
  isHere: boolean;
  freshnessLabel: string | null; // "há N dias" or null (last round)
  onSwap?: (e: GestureResponderEvent) => void; // "trocar ›" — only meaningful when isHere
  // 3d ("sem preço hoje"): "tudo em cinza: título, linhas com 'há N dias',
  // nenhum vencedor, nenhum selo" — no badges even if isWinner/isHere are
  // true, name/price drop to secondary gray, border never colors.
  muted?: boolean;
}

// One line of the ONDE block (Resposta, artifact 3a–3d). Distinct from
// ListRow: this needs a per-row border color (winner=brand, here=ink,
// default=border) and two different badge shapes — a standalone pill
// ("menor preço") vs. a combined here+winner pill ("◉ você está aqui ·
// menor preço") — which ListRow's single fixed-style subtitle can't express.
export function StoreRow({ storeName, distanceKm, price, isWinner, isHere, freshnessLabel, onSwap, muted }: StoreRowProps) {
  const borderColor = muted ? colors.border : isWinner ? colors.brand : isHere ? colors.ink : colors.border;

  return (
    <View style={[styles.row, { borderColor }]}>
      <View style={styles.textColumn}>
        <Text style={[styles.name, muted && styles.mutedText]}>
          {storeName}
          {distanceKm != null ? <Text style={styles.distance}> · {distanceKm.toFixed(1).replace('.', ',')} km</Text> : null}
        </Text>
        {muted ? (
          freshnessLabel ? <Text style={styles.freshness}>{freshnessLabel}</Text> : null
        ) : isHere && isWinner ? (
          <View style={styles.hereWinnerBadge}>
            <Text style={styles.hereWinnerBadgeText}>◉ você está aqui · menor preço</Text>
          </View>
        ) : isHere ? (
          // A row of siblings, not a Pressable nested inside the Text: a View
          // inside Text drops the parent's font size and sits off its baseline
          // ("trocar ›" came out bigger and higher than the words before it).
          <View style={styles.hereLine}>
            <Text style={styles.hereText}>você está aqui ·</Text>
            <Pressable onPress={onSwap} hitSlop={8}>
              <Text style={styles.swapLink}>trocar ›</Text>
            </Pressable>
          </View>
        ) : isWinner ? (
          <View style={styles.winnerBadge}>
            <Text style={styles.winnerBadgeText}>menor preço</Text>
          </View>
        ) : freshnessLabel ? (
          <Text style={styles.freshness}>{freshnessLabel}</Text>
        ) : null}
      </View>
      <Text style={[styles.price, isWinner && !muted && styles.priceWinner, muted && styles.mutedText]}>{formatBRL(price)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    backgroundColor: '#fff',
    borderWidth,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    color: colors.ink,
  },
  distance: {
    fontFamily: fontFamily.medium,
    color: colors.secondary,
  },
  freshness: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: colors.secondary,
    marginTop: 4,
  },
  hereLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 4,
  },
  hereText: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: colors.secondary,
  },
  swapLink: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: colors.brandInk,
  },
  winnerBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: colors.brandTint,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  winnerBadgeText: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    color: colors.brandInk,
  },
  hereWinnerBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: colors.brandTint,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  hereWinnerBadgeText: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    color: colors.brandInk,
  },
  price: {
    fontFamily: fontFamily.extrabold,
    fontSize: 18,
    color: colors.ink,
    ...tabularNums,
  },
  priceWinner: {
    color: colors.brandInk,
  },
  mutedText: {
    color: colors.secondary,
  },
});
