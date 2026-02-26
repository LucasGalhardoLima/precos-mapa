import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '../types';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  hasSeenOnboarding: boolean;

  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  clearAuth: () => void;
  setHasSeenOnboarding: (value: boolean) => void;
}

const ONBOARDING_KEY = 'hasSeenOnboarding';

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  isLoading: true,
  hasSeenOnboarding: false,

  setSession: (session) => set({ session, isLoading: false }),
  setProfile: (profile) => set({ profile }),
  clearAuth: () => set({ session: null, profile: null }),

  setHasSeenOnboarding: (value) => {
    SecureStore.setItemAsync(ONBOARDING_KEY, JSON.stringify(value));
    set({ hasSeenOnboarding: value });
  },
}));

// Hydrate persisted state on app start
SecureStore.getItemAsync(ONBOARDING_KEY).then((value) => {
  if (value !== null) {
    useAuthStore.setState({ hasSeenOnboarding: JSON.parse(value) });
  }
});
