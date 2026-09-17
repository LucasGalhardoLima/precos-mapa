import { Text } from 'react-native';
import { colors, typography } from '../constants/tokens';

interface ProvenanceProps {
  children: string;
}

// e.g. "preço de hoje, 03:00 · Jaú Serve" — 13/500, secondary color.
export function Provenance({ children }: ProvenanceProps) {
  return <Text style={{ ...typography.provenance, color: colors.secondary }}>{children}</Text>;
}
