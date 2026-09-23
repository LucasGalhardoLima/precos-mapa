// mobile/__tests__/hooks/chains.test.ts

import { chainLabelForStore, MATAO_CHAIN_LABELS, MATAO_CHAIN_COUNT } from '@/lib/chains';

describe('chainLabelForStore', () => {
  it('matches every real branch name shape seen live (2026-09-23)', () => {
    expect(chainLabelForStore('Amarelinha Loja 21 Flamboyant')).toBe('Amarelinha');
    expect(chainLabelForStore('Amarelinha Loja 17')).toBe('Amarelinha');
    expect(chainLabelForStore('Tenda Atacado - Matão')).toBe('Tenda');
    expect(chainLabelForStore('Savegnago')).toBe('Savegnago');
    expect(chainLabelForStore('Jaú Serve')).toBe('Jaú Serve');
  });

  it('returns null for a store outside the 4 known chains', () => {
    expect(chainLabelForStore('Mercadinho do Zé')).toBeNull();
  });

  it('the labels list has exactly the 4 documented chains', () => {
    expect(MATAO_CHAIN_LABELS).toEqual(['Savegnago', 'Jaú Serve', 'Tenda', 'Amarelinha']);
    expect(MATAO_CHAIN_COUNT).toBe(4);
  });
});
