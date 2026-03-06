import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { useTheme } from '../theme/use-theme';

export function NativeTabLayout() {
  const { tokens, tabIcons } = useTheme();

  return (
    <NativeTabs tintColor={tokens.primary}>
      <NativeTabs.Trigger name="index">
        <Icon sf={tabIcons.index} />
        <Label>Início</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="search">
        <Icon sf={tabIcons.search} />
        <Label>Busca</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="map">
        <Icon sf={tabIcons.map} />
        <Label>Mapa</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="list">
        <Icon sf={tabIcons.list} />
        <Label>Lista</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="account">
        <Icon sf={tabIcons.account} />
        <Label>Conta</Label>
      </NativeTabs.Trigger>

      {/* Hidden legacy routes */}
      <NativeTabs.Trigger name="favorites" hidden />
      <NativeTabs.Trigger name="alerts" hidden />
      <NativeTabs.Trigger name="profile" hidden />
    </NativeTabs>
  );
}
