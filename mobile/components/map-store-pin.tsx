import { View, Text, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import type { StoreWithPromotions } from '@/types';

export type PinRank = 'green' | 'yellow' | 'red';

// Pin colors based on offer availability (matching mockup)
const PIN_TEAL = '#0D9488';
const PIN_GOLD = '#F59E0B';
const PIN_GRAY = '#94A3B8';

interface MapStorePinProps {
  storeData: StoreWithPromotions;
  rank: PinRank;
  position: number;
  /** Whether this pin is the currently selected store */
  selected?: boolean;
  /** Whether another store is selected (dim this pin) */
  dimmed?: boolean;
  onPress: () => void;
}

function pinColorForOffers(count: number): string {
  if (count >= 10) return PIN_TEAL;
  if (count > 0) return PIN_GOLD;
  return PIN_GRAY;
}

export function MapStorePin({
  storeData,
  selected = false,
  dimmed = false,
  onPress,
}: MapStorePinProps) {
  const { store, activePromotionCount } = storeData;
  const color = pinColorForOffers(activePromotionCount);

  return (
    <Marker
      coordinate={{ latitude: store.latitude, longitude: store.longitude }}
      onPress={onPress}
      tracksViewChanges={false}
    >
      <View style={[styles.container, dimmed && styles.dimmed]}>
        {/* Pin circle with offer count */}
        <View
          style={[
            styles.pinBody,
            { backgroundColor: color },
            selected && styles.pinSelected,
          ]}
        >
          <Text style={styles.pinCount}>{activePromotionCount}</Text>
        </View>

        {/* Downward triangle pointer */}
        <View style={[styles.arrow, { borderTopColor: color }]} />

        {/* Store name label (shown always for selected, only when not dimmed otherwise) */}
        {!dimmed && (
          <View style={styles.labelBg}>
            <Text style={styles.labelText} numberOfLines={1}>
              {store.name}
            </Text>
          </View>
        )}
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  dimmed: {
    opacity: 0.4,
  },
  pinBody: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  pinSelected: {
    borderWidth: 3,
    borderColor: '#5EEAD4',
    shadowColor: '#0D9488',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  pinCount: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'Inter_500Medium',
  },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  labelBg: {
    marginTop: 2,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    maxWidth: 100,
  },
  labelText: {
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'Inter_500Medium',
    color: '#1A1A2E',
    textAlign: 'center',
  },
});
