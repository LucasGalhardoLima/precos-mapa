import { Text } from 'react-native';
import { colors, typography } from '../constants/tokens';

interface BlockLabelProps {
  children: string;
}

// e.g. "ONDE", "ITENS" — 13/700 caps, letter-spacing .08em, secondary color.
export function BlockLabel({ children }: BlockLabelProps) {
  return <Text style={{ ...typography.label, color: colors.secondary }}>{children}</Text>;
}
