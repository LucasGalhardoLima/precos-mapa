import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { toast } from 'burnt';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ListTemplate {
  id: string;
  emoji: string;
  name: string;
  itemCount: number;
  itemLabel: string;
  bgColor: string;
}

interface ListTemplateCardProps {
  template: ListTemplate;
}

// ---------------------------------------------------------------------------
// Data (matching mockup)
// ---------------------------------------------------------------------------

export const LIST_TEMPLATES: ListTemplate[] = [
  {
    id: 'cesta-basica',
    emoji: '🛒',
    name: 'Cesta básica essencial',
    itemCount: 15,
    itemLabel: 'Arroz, feijão, óleo, açúcar...',
    bgColor: '#dcfce7',
  },
  {
    id: 'cafe-da-manha',
    emoji: '🍳',
    name: 'Café da manhã',
    itemCount: 8,
    itemLabel: 'Pão, leite, café, manteiga...',
    bgColor: '#fef3c7',
  },
  {
    id: 'limpeza',
    emoji: '🧹',
    name: 'Limpeza do mês',
    itemCount: 12,
    itemLabel: 'Detergente, sabão, amaciante...',
    bgColor: '#e0f2fe',
  },
  {
    id: 'higiene',
    emoji: '🧴',
    name: 'Higiene pessoal',
    itemCount: 10,
    itemLabel: 'Shampoo, sabonete, pasta...',
    bgColor: '#ede9fe',
  },
];

// ---------------------------------------------------------------------------
// Component — vertical row card (matches mockup)
// ---------------------------------------------------------------------------

export function ListTemplateCard({ template }: ListTemplateCardProps) {
  const handlePress = () => {
    toast({ title: 'Em breve!' });
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [pressed && { opacity: 0.7 }]}
    >
      <View style={styles.card}>
        <View style={[styles.iconWrap, { backgroundColor: template.bgColor }]}>
          <Text style={styles.emoji}>{template.emoji}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{template.name}</Text>
          <Text style={styles.desc} numberOfLines={1}>
            {template.itemCount} itens · {template.itemLabel}
          </Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e8edf2',
    padding: 14,
    marginBottom: 8,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 18,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Inter_500Medium',
    color: '#1A1A2E',
  },
  desc: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  arrow: {
    fontSize: 14,
    color: '#94A3B8',
  },
});
