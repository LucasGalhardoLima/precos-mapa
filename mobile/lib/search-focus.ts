import type { TextInput } from 'react-native';

// Imperative bridge so app/scan.tsx's "Digitar o nome em vez disso" can
// focus the root's search field after router.back() — app/index.tsx stays
// mounted underneath /scan (pushed, not replaced), so no navigation param or
// new app state is needed, just a place for the still-alive TextInput's ref
// to live where a sibling screen can reach it.
export const searchFieldRef: { current: TextInput | null } = { current: null };
