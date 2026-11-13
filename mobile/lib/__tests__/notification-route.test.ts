import { productIdFromPayload, routeForNotification } from '@/lib/notification-route';

const ID = '3f2b8c1e-9a4d-4e7b-8c1a-2d3e4f5a6b7c';
const exists = (yes: boolean) => jest.fn().mockResolvedValue(yes);

describe('productIdFromPayload', () => {
  it('reads productId from the push payload', () => {
    expect(productIdFromPayload({ productId: ID })).toBe(ID);
  });

  it.each([undefined, null, {}, { productId: '' }, { productId: 42 }, { productId: 'not-a-uuid' }, 'x'])('null for %p', (data) => {
    expect(productIdFromPayload(data)).toBeNull();
  });
});

describe('routeForNotification', () => {
  it('opens the Resposta of an existing product', async () => {
    const check = exists(true);
    await expect(routeForNotification({ productId: ID }, check)).resolves.toBe(`/product/${ID}`);
    expect(check).toHaveBeenCalledWith(ID);
  });

  it('stays on Raiz (null) when the product no longer exists', async () => {
    await expect(routeForNotification({ productId: ID }, exists(false))).resolves.toBeNull();
  });

  it('stays on Raiz without even looking up when the payload has no productId', async () => {
    const check = exists(true);
    await expect(routeForNotification({ promotionId: 'x' }, check)).resolves.toBeNull();
    expect(check).not.toHaveBeenCalled();
  });

  it('stays on Raiz when the lookup throws (offline), without surfacing an error', async () => {
    await expect(routeForNotification({ productId: ID }, jest.fn().mockRejectedValue(new Error('offline')))).resolves.toBeNull();
  });
});
