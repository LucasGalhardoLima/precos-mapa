import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import type { SFSymbol } from 'sf-symbols-typescript';
import { useTheme } from '../theme/use-theme';

export function NativeTabLayout() {
  const { tokens, tabIcons } = useTheme();

  return (
    <NativeTabs tintColor={tokens.primary}>
      <NativeTabs.Trigger name="index">
        <Icon sf={tabIcons.index as SFSymbol} />
        <Label>Início</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="search">
        <Icon sf={tabIcons.search as SFSymbol} />
        <Label>Busca</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="map">
        <Icon sf={tabIcons.map as SFSymbol} />
        <Label>Mapa</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="list">
        <Icon sf={tabIcons.list as SFSymbol} />
        <Label>Lista</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="account">
        <Icon sf={tabIcons.account as SFSymbol} />
        <Label>Conta</Label>
      </NativeTabs.Trigger>

      {/* Hidden legacy routes */}
      <NativeTabs.Trigger name="favorites" hidden />
      <NativeTabs.Trigger name="alerts" hidden />
      <NativeTabs.Trigger name="profile" hidden />
    </NativeTabs>
  );
}
