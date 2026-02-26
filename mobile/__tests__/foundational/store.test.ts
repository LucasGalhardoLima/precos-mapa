import { useAuthStore } from '@precomapa/shared/store/auth-store';
import { useFilterStore } from '../../store/app-store';

describe('Auth store (shared)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      session: null,
      profile: null,
      isLoading: true,
      hasSeenOnboarding: false,
    });
  });

  it('starts with null session and loading true', () => {
    const state = useAuthStore.getState();
    expect(state.session).toBeNull();
    expect(state.profile).toBeNull();
    expect(state.isLoading).toBe(true);
  });

  it('setSession stores session and sets isLoading to false', () => {
    const mockSession = { user: { id: 'test-123' } } as any;
    useAuthStore.getState().setSession(mockSession);

    const state = useAuthStore.getState();
    expect(state.session).toBe(mockSession);
    expect(state.isLoading).toBe(false);
  });

  it('setProfile stores profile', () => {
    const mockProfile = { id: 'test-123', role: 'consumer' as const } as any;
    useAuthStore.getState().setProfile(mockProfile);
    expect(useAuthStore.getState().profile).toBe(mockProfile);
  });

  it('clearAuth resets session and profile', () => {
    useAuthStore.setState({
      session: { user: { id: 'test' } } as any,
      profile: { id: 'test', role: 'consumer' } as any,
    });

    useAuthStore.getState().clearAuth();

    const state = useAuthStore.getState();
    expect(state.session).toBeNull();
    expect(state.profile).toBeNull();
  });
});

describe('Filter store', () => {
  beforeEach(() => {
    useFilterStore.setState({
      selectedCategoryId: null,
      sortMode: 'cheapest',
      searchQuery: '',
    });
  });

  it('setSortMode updates sort mode', () => {
    useFilterStore.getState().setSortMode('nearest');
    expect(useFilterStore.getState().sortMode).toBe('nearest');
  });

  it('setSearchQuery updates search query', () => {
    useFilterStore.getState().setSearchQuery('arroz');
    expect(useFilterStore.getState().searchQuery).toBe('arroz');
  });

  it('setSelectedCategoryId updates category', () => {
    useFilterStore.getState().setSelectedCategoryId('cat_bebidas');
    expect(useFilterStore.getState().selectedCategoryId).toBe('cat_bebidas');

    useFilterStore.getState().setSelectedCategoryId(null);
    expect(useFilterStore.getState().selectedCategoryId).toBeNull();
  });
});
