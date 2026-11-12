jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

import {
  AJUSTES_TETO,
  trackedHeader,
  verTodosLabel,
  visibleItems,
  hasMoreItems,
  undoText,
  trackedListStatus,
  trackedItemName,
  insertAt,
  removeAt,
  resolveHereStore,
  hereSubtitle,
  cityLabel,
  resolveNotificationUi,
  toPermission,
} from '../ajustes';
import type { NearbyStore } from '@/hooks/use-stores';

const store = (chainLabel: string, distanceKm: number | null): NearbyStore => ({ storeId: chainLabel, chainLabel, storeName: chainLabel, distanceKm });

describe('teto 4 + ver todos', () => {
  const six = ['a', 'b', 'c', 'd', 'e', 'f'];

  it('caps at 4 collapsed and shows all expanded', () => {
    expect(AJUSTES_TETO).toBe(4);
    expect(visibleItems(six, false)).toEqual(['a', 'b', 'c', 'd']);
    expect(visibleItems(six, true)).toEqual(six);
  });

  it('offers "ver todos" only above the cap and only while collapsed', () => {
    expect(hasMoreItems(4, false)).toBe(false);
    expect(hasMoreItems(5, false)).toBe(true);
    expect(hasMoreItems(5, true)).toBe(false);
  });

  it('labels follow the count, never hand-written', () => {
    expect(trackedHeader(6)).toBe('ITENS ACOMPANHADOS · 6');
    expect(verTodosLabel(6)).toBe('ver todos os 6');
    expect(undoText('Arroz Tio João tipo 1 · 5 kg')).toBe('Arroz Tio João tipo 1 · 5 kg removido');
  });
});

describe('trackedListStatus', () => {
  it('never reads a failed or pending fetch as empty', () => {
    expect(trackedListStatus(true, false, 0)).toBe('loading');
    expect(trackedListStatus(false, true, 0)).toBe('error');
    expect(trackedListStatus(false, false, 0)).toBe('empty');
    expect(trackedListStatus(false, false, 2)).toBe('items');
  });
});

describe('remove / restore', () => {
  it('restores a removed row to its original slot', () => {
    const list = ['a', 'b', 'c'];
    expect(insertAt(removeAt(list, 1), 'b', 1)).toEqual(list);
  });

  it('clamps the slot when the list shrank meanwhile', () => {
    expect(insertAt(['a'], 'z', 5)).toEqual(['a', 'z']);
    expect(insertAt(['a'], 'z', -3)).toEqual(['z', 'a']);
  });

  it('joins name and size only when the catalog has one', () => {
    expect(trackedItemName('Feijão Camil', '1 kg')).toBe('Feijão Camil · 1 kg');
    expect(trackedItemName('Feijão Camil', null)).toBe('Feijão Camil');
  });
});

describe('localização', () => {
  const stores = [store('Savegnago', 2.4), store('Tenda', 1.8), store('Jaú Serve', null)];

  it('picks the nearest chain by GPS', () => {
    expect(resolveHereStore(stores, null)).toEqual({ chainLabel: 'Tenda', distanceKm: 1.8 });
  });

  it('a chain picked in "trocar" wins over GPS, with its own distance', () => {
    expect(resolveHereStore(stores, 'Savegnago')).toEqual({ chainLabel: 'Savegnago', distanceKm: 2.4 });
  });

  it('ignores a preferred chain that is not among the stores', () => {
    expect(resolveHereStore(stores, 'Inexistente')).toEqual({ chainLabel: 'Tenda', distanceKm: 1.8 });
  });

  it('is null (line omitted) with no preference and no distances', () => {
    expect(resolveHereStore([store('Tenda', null)], null)).toBeNull();
    expect(resolveHereStore([], null)).toBeNull();
  });

  it('formats the subtitle with a comma decimal, and without a distance when unknown', () => {
    expect(hereSubtitle({ chainLabel: 'Tenda', distanceKm: 1.8 })).toBe('mais perto: Tenda · 1,8 km');
    expect(hereSubtitle({ chainLabel: 'Jaú Serve', distanceKm: null })).toBe('mais perto: Jaú Serve');
    expect(hereSubtitle(null)).toBeNull();
  });

  it('never shows the hardcoded fallback city as the real one', () => {
    expect(cityLabel(false, 'Matao')).toBe('Matão');
    expect(cityLabel(true, 'Matão')).toBe('Matão');
    expect(cityLabel(true, 'Araraquara')).toBe('Araraquara');
  });
});

describe('notificações', () => {
  it('denied in the system locks the switch, whatever the user chose', () => {
    expect(resolveNotificationUi('denied', true)).toEqual({ kind: 'blocked' });
    expect(resolveNotificationUi('denied', false)).toEqual({ kind: 'blocked' });
  });

  it('granted follows the user choice', () => {
    expect(resolveNotificationUi('granted', true)).toEqual({ kind: 'on' });
    expect(resolveNotificationUi('granted', false)).toEqual({ kind: 'off' });
  });

  it('undetermined reads as off even if the stored choice is on', () => {
    expect(resolveNotificationUi('undetermined', true)).toEqual({ kind: 'off' });
  });

  it('maps expo statuses', () => {
    expect(toPermission('granted')).toBe('granted');
    expect(toPermission('denied')).toBe('denied');
    expect(toPermission('undetermined')).toBe('undetermined');
    expect(toPermission('provisional')).toBe('undetermined');
  });
});
