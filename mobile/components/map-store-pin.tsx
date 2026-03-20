import { View, Text, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import type { StoreWithPromotions } from '@/types';

export type PinRank = 'green' | 'yellow' | 'red';

const RANK_COLORS: Record<PinRank, string> = {
  green: '#16A34A',
  yellow: '#F59E0B',
  red: '#EF4444',
};

const MEDAL_EMOJIS = ['🥇', '🥈', '🥉'];

interface MapStorePinProps {
  storeData: StoreWithPromotions;
  rank: PinRank;
  /** 1-based position in sorted list (1 = cheapest). 0 means unranked. */
  position: number;
  onPress: () => void;
}

export function MapStorePin({
  storeData,
  rank,
  position,
  onPress,
}: MapStorePinProps) {
  const { store } = storeData;
  const color = RANK_COLORS[rank];
  const medalEmoji = position >= 1 && position <= 3 ? MEDAL_EMOJIS[position - 1] : null;
  // Show abbreviated name: first word if short, or first word + initial of second
  const words = store.name.split(' ');
  const displayName = words.length === 1
    ? words[0].substring(0, 6)
    : words[0].length <= 5
      ? words[0]
      : words[0].substring(0, 5);

  return (
    <Marker
      coordinate={{ latitude: store.latitude, longitude: store.longitude }}
      onPress={onPress}
      tracksViewChanges={false}
    >
      <View style={styles.container}>
        {/* Pin bubble */}
        <View style={[styles.pin, { backgroundColor: color }]}>
          {medalEmoji !== null && (
            <Text style={styles.medal}>{medalEmoji}</Text>
          )}
          <Text style={styles.initials}>{displayName}</Text>
        </View>

        {/* Downward triangle pointer */}
        <View style={[styles.arrow, { borderTopColor: color }]} />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  pin: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 2,
    minWidth: 38,
    justifyContent: 'center',
    // Subtle shadow so pins read against the map
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  medal: {
    fontSize: 11,
    lineHeight: 14,
  },
  initials: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
