/**
 * Typed Supabase mock helper for tests.
 *
 * Usage:
 *   const { client, mockFrom, mockAuth, mockRpc } = createSupabaseMock();
 *   mockFrom('promotions').select.mockResolvedValueOnce({ data: [...], error: null });
 */

type MockChain = {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  eq: jest.Mock;
  neq: jest.Mock;
  gt: jest.Mock;
  gte: jest.Mock;
  lt: jest.Mock;
  lte: jest.Mock;
  ilike: jest.Mock;
  in: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  range: jest.Mock;
  single: jest.Mock;
  maybeSingle: jest.Mock;
};

type MockAuth = {
  getSession: jest.Mock;
  signInWithIdToken: jest.Mock;
  signOut: jest.Mock;
  onAuthStateChange: jest.Mock;
};

function createMockChain(): MockChain {
  const chain: MockChain = {} as MockChain;
  const methods = [
    'select', 'insert', 'update', 'delete',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'ilike', 'in', 'order', 'limit', 'range',
    'single', 'maybeSingle',
  ] as const;

  for (const method of methods) {
    chain[method] = jest.fn().mockReturnValue(chain);
  }

  return chain;
}

export function createSupabaseMock() {
  const tableChains = new Map<string, MockChain>();

  const mockFrom = (table: string): MockChain => {
    if (!tableChains.has(table)) {
      tableChains.set(table, createMockChain());
    }
    return tableChains.get(table)!;
  };

  const mockAuth: MockAuth = {
    getSession: jest.fn().mockResolvedValue({
      data: { session: null },
      error: null,
    }),
    signInWithIdToken: jest.fn().mockResolvedValue({
      data: {
        session: {
          user: { id: 'test-user-id', email: 'test@example.com' },
          access_token: 'mock-access-token',
        },
      },
      error: null,
    }),
    signOut: jest.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: jest.fn((callback) => ({
      data: {
        subscription: { unsubscribe: jest.fn() },
      },
    })),
  };

  const mockRpc = jest.fn().mockResolvedValue({ data: [], error: null });

  const mockChannel = jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
  }));

  const client = {
    from: jest.fn((table: string) => mockFrom(table)),
    auth: mockAuth,
    rpc: mockRpc,
    channel: mockChannel,
    removeChannel: jest.fn(),
  };

  return {
    client,
    mockFrom,
    mockAuth,
    mockRpc,
    mockChannel,
    /** Reset all mocks */
    resetAll: () => {
      tableChains.clear();
      mockAuth.getSession.mockClear();
      mockAuth.signInWithIdToken.mockClear();
      mockAuth.signOut.mockClear();
      mockAuth.onAuthStateChange.mockClear();
      mockRpc.mockClear();
      mockChannel.mockClear();
      client.from.mockClear();
      client.removeChannel.mockClear();
    },
  };
}
