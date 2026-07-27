import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { extractSize, isBrandCompatible, toTitleCase } from './find-or-create-product.ts';

Deno.test('extractSize - extracts common Brazilian grocery size tokens', () => {
  assertEquals(extractSize('Coca-Cola 350ml'), '350ml');
  assertEquals(extractSize('Arroz 5kg'), '5kg');
  assertEquals(extractSize('Leite 1,5l'), '1,5l');
  assertEquals(extractSize('Ovos 12un'), '12un');
});

Deno.test('extractSize - returns null when no size token is present', () => {
  assertEquals(extractSize('Banana Prata'), null);
  assertEquals(extractSize(''), null);
});

Deno.test('isBrandCompatible - rejects clearly different brands', () => {
  assertEquals(isBrandCompatible('Ypê', 'Omo'), false);
});

Deno.test('isBrandCompatible - accepts matching brands ignoring case/whitespace', () => {
  assertEquals(isBrandCompatible('ypê', ' Ypê '), true);
});

Deno.test('isBrandCompatible - treats either side missing as compatible', () => {
  assertEquals(isBrandCompatible(null, 'Premium'), true);
  assertEquals(isBrandCompatible('Phenix', undefined), true);
});

Deno.test('toTitleCase - title-cases words but preserves known grocery acronyms', () => {
  assertEquals(toTitleCase('AGUA MIN LEVISSIMA 1,5L SG'), 'Agua Min Levissima 1,5l Sg');
  assertEquals(toTitleCase('LEITE UHT INTEGRAL'), 'Leite UHT Integral');
});
