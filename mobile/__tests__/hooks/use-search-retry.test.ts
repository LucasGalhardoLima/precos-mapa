// "Sem conexão" appeared once in 3 Maestro runs with the network fine: a single
// failed RPC (dropped request, 5xx, statement timeout) went straight to the
// offline state, and a rejected rpc() promise left isSearching stuck on true.
// runSearch must retry once silently and never throw.
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));

import { runSearch } from '@/hooks/use-search';

const ROW = {
  product_id: 'p1',
  product_name: 'Arroz 5 kg',
  brand: null,
  image_url: null,
  has_active_price: true,
  cheapest_price: 24.9,
  prices: [{ store_id: 's1', store_name: 'Tenda', price: 24.9, last_price_date: new Date().toISOString() }],
};
const netErr = { data: null, error: { message: 'TypeError: Network request failed' } };
const ok = { data: [ROW], error: null };

// Debounce is not involved; only the retry delay, so advance past it.
async function run(call: jest.Mock, isCancelled?: () => boolean) {
  const p = runSearch(call, isCancelled ? { isCancelled } : undefined);
  await jest.advanceTimersByTimeAsync(2000);
  return p;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('runSearch — transient RPC failure', () => {
  it('retries once silently: failure then success yields results and no error', async () => {
    const call = jest.fn().mockResolvedValueOnce(netErr).mockResolvedValueOnce(ok);
    const out = await run(call);
    expect(call).toHaveBeenCalledTimes(2);
    expect(out.error).toBeNull();
    expect(out.results).toHaveLength(1);
  });

  it('surfaces the error only after the retry also fails (exactly 2 calls)', async () => {
    const call = jest.fn().mockResolvedValue(netErr);
    const out = await run(call);
    expect(call).toHaveBeenCalledTimes(2);
    expect(out.error).not.toBeNull();
  });

  it('a rejected call becomes an error outcome instead of throwing', async () => {
    const call = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    const out = await run(call);
    expect(out.error).not.toBeNull();
  });

  it('does not retry (or report) a search that was cancelled meanwhile', async () => {
    const call = jest.fn().mockResolvedValue(netErr);
    await run(call, () => true);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('does not retry on success', async () => {
    const call = jest.fn().mockResolvedValue(ok);
    const out = await run(call);
    expect(call).toHaveBeenCalledTimes(1);
    expect(out.results).toHaveLength(1);
  });
});
