import { createSupabaseMock } from './supabase-mock';

describe('Test infrastructure smoke test', () => {
  it('creates a Supabase mock with typed chain', () => {
    const { client, mockFrom } = createSupabaseMock();
    expect(client.from).toBeDefined();
    expect(client.auth.getSession).toBeDefined();
    expect(client.rpc).toBeDefined();

    const chain = mockFrom('promotions');
    expect(chain.select).toBeDefined();
    expect(chain.eq).toBeDefined();
    expect(chain.order).toBeDefined();
  });

  it('mock chain methods return themselves for chaining', () => {
    const { mockFrom } = createSupabaseMock();
    const chain = mockFrom('stores');
    const result = chain.select('*').eq('is_active', true).order('name');
    expect(result).toBe(chain);
  });

  it('mock auth returns expected shape', async () => {
    const { mockAuth } = createSupabaseMock();
    const session = await mockAuth.getSession();
    expect(session).toEqual({ data: { session: null }, error: null });
  });

  it('resetAll clears all mocks', () => {
    const mock = createSupabaseMock();
    mock.client.from('test');
    mock.mockRpc('test_fn');
    mock.resetAll();
    expect(mock.client.from).not.toHaveBeenCalled();
    expect(mock.mockRpc).not.toHaveBeenCalled();
  });
});
