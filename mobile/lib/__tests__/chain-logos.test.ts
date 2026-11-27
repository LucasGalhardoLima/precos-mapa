import { CHAIN_LOGOS } from '../../constants/chain-logos';
import { MATAO_CHAINS, chainLabelForStore } from '../chains';

describe('CHAIN_LOGOS', () => {
  it('has a logo for every one of the 4 chains, and for nothing else', () => {
    expect(Object.keys(CHAIN_LOGOS).sort()).toEqual(MATAO_CHAINS.map((c) => c.label).sort());
  });

  it.each(Object.entries(CHAIN_LOGOS))('%s has a 4-number viewBox and path data', (_label, shape) => {
    expect(shape.viewBox).toMatch(/^0 0 \d+ \d+$/);
    expect(shape.d.startsWith('M ')).toBe(true);
    expect(shape.d.length).toBeGreaterThan(500);
  });

  it('resolves real branch names to a chain that has a logo', () => {
    for (const name of ['Savegnago', 'Jaú Serve', 'Tenda Atacado - Matão', 'Amarelinha Loja 21 Flamboyant']) {
      const label = chainLabelForStore(name);
      expect(label).not.toBeNull();
      expect(CHAIN_LOGOS[label as string]).toBeDefined();
    }
  });

  it('has no logo for a name outside the 4 chains', () => {
    expect(chainLabelForStore('Mercado do Zé')).toBeNull();
  });
});
