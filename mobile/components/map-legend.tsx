import { View, Text, StyleSheet, Platform } from 'react-native';

/**
 * MapLegend — floating card (top-left) showing color-coded price ranking key.
 */
export function MapLegend() {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Ranking de preço</Text>

      <View style={styles.row}>
        <View style={[styles.dot, styles.dotGreen]} />
        <Text style={styles.label}>Barato</Text>
      </View>

      <View style={styles.row}>
        <View style={[styles.dot, styles.dotYellow]} />
        <Text style={styles.label}>Médio</Text>
      </View>

      <View style={styles.row}>
        <View style={[styles.dot, styles.dotRed]} />
        <Text style={styles.label}>Caro</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
    }),
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    color: '#134E4A',
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotGreen: {
    backgroundColor: '#16A34A',
  },
  dotYellow: {
    backgroundColor: '#F59E0B',
  },
  dotRed: {
    backgroundColor: '#EF4444',
  },
  label: {
    fontSize: 12,
    color: '#4A5568',
    fontWeight: '500',
  },
});
