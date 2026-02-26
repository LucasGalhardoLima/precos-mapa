import { createSupabaseMock } from '../helpers/supabase-mock';

describe('Supabase mock helper', () => {
  it('creates client with from, auth, rpc, and channel', () => {
    const { client } = createSupabaseMock();
    expect(client.from).toBeDefined();
    expect(client.auth).toBeDefined();
    expect(client.rpc).toBeDefined();
    expect(client.channel).toBeDefined();
    expect(client.removeChannel).toBeDefined();
  });

  it('returns typed chain for any table', () => {
    const { mockFrom } = createSupabaseMock();
    const chain = mockFrom('promotions');
    expect(chain.select).toBeDefined();
    expect(chain.insert).toBeDefined();
    expect(chain.update).toBeDefined();
    expect(chain.delete).toBeDefined();
    expect(chain.eq).toBeDefined();
    expect(chain.order).toBeDefined();
    expect(chain.single).toBeDefined();
  });

  it('chain methods are fluent (return themselves)', () => {
    const { mockFrom } = createSupabaseMock();
    const chain = mockFrom('stores');
    const result = chain.select('*').eq('is_active', true).order('name');
    expect(result).toBe(chain);
  });

  it('returns same chain for same table name', () => {
    const { mockFrom } = createSupabaseMock();
    const first = mockFrom('products');
    const second = mockFrom('products');
    expect(first).toBe(second);
  });

  it('returns different chains for different tables', () => {
    const { mockFrom } = createSupabaseMock();
    const products = mockFrom('products');
    const stores = mockFrom('stores');
    expect(products).not.toBe(stores);
  });
});
