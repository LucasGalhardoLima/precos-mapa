import { View, Text } from 'react-native';
import { useTheme } from '../../theme/use-theme';

export default function ListScreen() {
  const { tokens } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.bg }}>
      <Text style={{ color: tokens.textPrimary, fontSize: 18 }}>Lista</Text>
    </View>
  );
}
