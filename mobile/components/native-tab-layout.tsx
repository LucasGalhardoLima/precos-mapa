import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';

export function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf="house.fill" />
        <Label>Início</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="search">
        <Icon sf="magnifyingglass" />
        <Label>Busca</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="map">
        <Icon sf="mappin" />
        <Label>Mapa</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="list">
        <Icon sf="checklist" />
        <Label>Lista</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="account">
        <Icon sf="person.fill" />
        <Label>Conta</Label>
      </NativeTabs.Trigger>

      {/* Hidden legacy routes */}
      <NativeTabs.Trigger name="favorites" hidden />
      <NativeTabs.Trigger name="alerts" hidden />
      <NativeTabs.Trigger name="profile" hidden />
    </NativeTabs>
  );
}
