import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Burnt from 'burnt';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ListTemplate {
  id: string;
  emoji: string;
  name: string;
  itemCount: number;
  itemLabel: string;
}

interface ListTemplateCardProps {
  template: ListTemplate;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

export const LIST_TEMPLATES: ListTemplate[] = [
  {
    id: 'cesta-basica',
    emoji: '🛒',
    name: 'Cesta Básica',
    itemCount: 15,
    itemLabel: 'itens essenciais',
  },
  {
    id: 'churrasco',
    emoji: '🥩',
    name: 'Churrasco',
    itemCount: 12,
    itemLabel: 'itens',
  },
  {
    id: 'cafe-da-manha',
    emoji: '☕',
    name: 'Café da Manhã',
    itemCount: 8,
    itemLabel: 'itens',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ListTemplateCard({ template }: ListTemplateCardProps) {
  const handlePress = () => {
    Burnt.toast({ title: 'Em breve!' });
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <Text style={styles.emoji}>{template.emoji}</Text>
      <Text style={styles.name} numberOfLines={1}>
        {template.name}
      </Text>
      <Text style={styles.count} numberOfLines={1}>
        {template.itemCount} {template.itemLabel}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    width: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  cardPressed: {
    opacity: 0.7,
  },
  emoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: '#134E4A',
    textAlign: 'center',
  },
  count: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
