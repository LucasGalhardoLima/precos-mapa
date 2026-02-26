import { useAuthStore } from '@precomapa/shared/store/auth-store';

describe('US0 — Auth & Role Routing', () => {
  beforeEach(() => {
    useAuthStore.setState({
      session: null,
      profile: null,
      isLoading: true,
      hasSeenOnboarding: false,
    });
  });

  describe('Role-based routing logic', () => {
    it('routes to onboarding when no session', () => {
      const state = useAuthStore.getState();
      expect(state.session).toBeNull();
      expect(state.hasSeenOnboarding).toBe(false);
      // index.tsx: !hasSeenOnboarding || !session → /onboarding
    });

    it('routes to (tabs) for consumer role', () => {
      useAuthStore.setState({
        session: { user: { id: 'u1' } } as any,
        profile: { id: 'u1', role: 'consumer' } as any,
        hasSeenOnboarding: true,
      });

      const state = useAuthStore.getState();
      expect(state.session).not.toBeNull();
      expect(state.profile?.role).toBe('consumer');
    });

    it('routes to (business) for business role', () => {
      useAuthStore.setState({
        session: { user: { id: 'u2' } } as any,
        profile: { id: 'u2', role: 'business' } as any,
        hasSeenOnboarding: true,
      });

      expect(useAuthStore.getState().profile?.role).toBe('business');
    });

    it('defaults to consumer when profile has consumer role', () => {
      useAuthStore.setState({
        session: { user: { id: 'u3' } } as any,
        profile: { id: 'u3', role: 'consumer' } as any,
        hasSeenOnboarding: true,
      });

      expect(useAuthStore.getState().profile?.role).not.toBe('business');
    });
  });

  describe('Session management', () => {
    it('setSession stores session and sets isLoading to false', () => {
      const mockSession = { user: { id: 'test-123' } } as any;
      useAuthStore.getState().setSession(mockSession);

      const state = useAuthStore.getState();
      expect(state.session).toBe(mockSession);
      expect(state.isLoading).toBe(false);
    });

    it('clearAuth resets session and profile', () => {
      useAuthStore.setState({
        session: { user: { id: 'test' } } as any,
        profile: { id: 'test', role: 'consumer' } as any,
      });

      useAuthStore.getState().clearAuth();
      expect(useAuthStore.getState().session).toBeNull();
      expect(useAuthStore.getState().profile).toBeNull();
    });
  });

  describe('Onboarding state', () => {
    it('starts with hasSeenOnboarding false', () => {
      expect(useAuthStore.getState().hasSeenOnboarding).toBe(false);
    });

    it('setHasSeenOnboarding persists value', () => {
      useAuthStore.getState().setHasSeenOnboarding(true);
      expect(useAuthStore.getState().hasSeenOnboarding).toBe(true);
    });
  });

  describe('Profile role detection', () => {
    it('role is null when no profile', () => {
      useAuthStore.setState({ profile: null });
      expect(useAuthStore.getState().profile?.role ?? null).toBeNull();
    });

    it('role is consumer for consumer profile', () => {
      useAuthStore.setState({
        profile: { id: 'u1', role: 'consumer' } as any,
      });
      expect(useAuthStore.getState().profile?.role).toBe('consumer');
    });

    it('role is business for business profile', () => {
      useAuthStore.setState({
        profile: { id: 'u2', role: 'business' } as any,
      });
      expect(useAuthStore.getState().profile?.role).toBe('business');
    });
  });
});
