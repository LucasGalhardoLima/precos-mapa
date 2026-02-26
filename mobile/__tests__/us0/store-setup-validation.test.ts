import { storeSetupSchema } from '../../lib/schemas';

describe('US0 — Store Setup Validation', () => {
  const validStore = {
    name: 'Carol Supermercado',
    address: 'Rua Sao Paulo, 1234',
    city: 'Matao',
    state: 'SP',
    latitude: -21.6033,
    longitude: -48.3658,
  };

  it('accepts valid store setup data', () => {
    const result = storeSetupSchema.safeParse(validStore);
    expect(result.success).toBe(true);
  });

  it('rejects missing store name', () => {
    const { name, ...rest } = validStore;
    const result = storeSetupSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects store name shorter than 2 chars', () => {
    const result = storeSetupSchema.safeParse({ ...validStore, name: 'A' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid state code (must be 2 chars)', () => {
    const result = storeSetupSchema.safeParse({ ...validStore, state: 'São Paulo' });
    expect(result.success).toBe(false);
  });

  it('rejects latitude out of range', () => {
    const result = storeSetupSchema.safeParse({ ...validStore, latitude: 100 });
    expect(result.success).toBe(false);
  });

  it('rejects longitude out of range', () => {
    const result = storeSetupSchema.safeParse({ ...validStore, longitude: 200 });
    expect(result.success).toBe(false);
  });

  it('accepts valid Brazilian coordinates', () => {
    const result = storeSetupSchema.safeParse({
      ...validStore,
      latitude: -23.5505,
      longitude: -46.6333,
    });
    expect(result.success).toBe(true);
  });
});
