import { useEffect, useCallback } from 'react';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth-store';
import type { UserRole, Profile } from '../types';

export function useAuth() {
  const { session, profile, isLoading, setSession, setProfile, clearAuth } = useAuthStore();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession?.user) {
        fetchProfile(currentSession.user.id);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        if (newSession?.user) {
          fetchProfile(newSession.user.id);
        } else {
          clearAuth();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      setProfile(data as Profile);
    }
  }, [setProfile]);

  const signInWithGoogle = useCallback(async () => {
    await GoogleSignin.hasPlayServices();
    const result = await GoogleSignin.signIn();
    const idToken = result.data?.idToken;
    if (!idToken) throw new Error('Google Sign-In falhou: sem ID token');

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) throw error;
    return data;
  }, []);

  const signInWithApple = useCallback(async () => {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error('Apple Sign-In falhou: sem identity token');
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });

    if (error) throw error;

    // Apple only provides name on first sign-in — cache it immediately
    if (credential.fullName?.givenName && data.session?.user) {
      const displayName = [
        credential.fullName.givenName,
        credential.fullName.familyName,
      ].filter(Boolean).join(' ');

      await supabase
        .from('profiles')
        .update({ display_name: displayName })
        .eq('id', data.session.user.id);
    }

    return data;
  }, []);

  const setRole = useCallback(async (role: UserRole) => {
    if (!session?.user) throw new Error('Nao autenticado');

    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', session.user.id);

    if (error) throw error;
    await fetchProfile(session.user.id);
  }, [session, fetchProfile]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    clearAuth();
  }, [clearAuth]);

  return {
    user: session?.user ?? null,
    profile,
    session,
    isLoading,
    isAuthenticated: !!session,
    role: profile?.role ?? null,
    signInWithGoogle,
    signInWithApple,
    signInWithEmail,
    setRole,
    signOut,
  };
}
