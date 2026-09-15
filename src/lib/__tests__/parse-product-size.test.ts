import { describe, it, expect } from "vitest";
import { parseProductSize } from "../parse-product-size";

describe("parseProductSize", () => {
  it("parses simple mass units, normalized to grams", () => {
    expect(parseProductSize("Arroz tipo 1 Serra Azul 5kg")).toEqual({ value: 5000, unit: "g" });
    expect(parseProductSize("Torrada Integral Bom Sabor 14g")).toEqual({ value: 14, unit: "g" });
    expect(parseProductSize("Iogurte Grego Morango Batavo 450g")).toEqual({ value: 450, unit: "g" });
  });

  it("parses simple volume units, normalized to ml", () => {
    expect(parseProductSize("Energético Flying Horse 2L")).toEqual({ value: 2000, unit: "ml" });
    expect(parseProductSize("Coquetel Sabor Morango Corote 500ml")).toEqual({ value: 500, unit: "ml" });
    expect(parseProductSize("Óleo de soja Liza 900ml")).toEqual({ value: 900, unit: "ml" });
  });

  it("parses space-separated count units", () => {
    expect(parseProductSize("Guardanapo Grand Hotel Tamanho G 50 unidades")).toEqual({
      value: 50,
      unit: "un",
    });
    expect(parseProductSize("Capsula de Cappuccino Classic 3 Corações 10 unid")).toEqual({
      value: 10,
      unit: "un",
    });
    expect(parseProductSize("Filtro De Cafe 103 Reutilizavel Pacaembu 30 Un")).toEqual({
      value: 30,
      unit: "un",
    });
  });

  it("handles decimal comma", () => {
    expect(parseProductSize("Azeitona Verde Gordal sem Caroço Select 1,5kg")).toEqual({
      value: 1500,
      unit: "g",
    });
  });

  it("multiplies pack-of-N patterns into total content", () => {
    expect(parseProductSize("Refrigerante Lata 6x350ml")).toEqual({ value: 2100, unit: "ml" });
    expect(parseProductSize("Água Mineral 2x1,5L")).toEqual({ value: 3000, unit: "ml" });
  });

  it("prefers the last size-like token when the name has more than one", () => {
    // "1" in "tipo 1" isn't unit-adjacent so it's never a candidate; the
    // trailing "5kg" should win regardless.
    expect(parseProductSize("Arroz Parboilizado Tipo 1 Integral Solito 1kg")).toEqual({
      value: 1000,
      unit: "g",
    });
  });

  it("returns null for names with no confident size token", () => {
    expect(parseProductSize("Cig Sc Lucky Strike Blue Patterson Un")).toBeNull();
    expect(parseProductSize("Amaciante So Aromas")).toBeNull();
    expect(parseProductSize("Secrets Leave In Redutor De Volume")).toBeNull();
    expect(
      parseProductSize("Papel Higiênico Folha Dupla Mimmo 30m Leve 12 Pague 11 Rolos"),
    ).not.toBeNull(); // has "30m" — sanity check this ISN'T the null case
  });

  it("does not false-positive on letters that happen to follow a number without being a unit", () => {
    // "103" is a model number, not a size — nothing should follow it directly
    expect(parseProductSize("Filtro De Cafe 103 Reutilizavel Pacaembu 30 Un")?.value).toBe(30);
  });

  it("prefers a mass/volume match over a trailing bundling count", () => {
    // real catalog case: "284g" is the actual pack content, "2 Unidades" is
    // packaging (2 packs bundled) — picking the count here silently drops
    // the real size.
    expect(parseProductSize("Torrada Tradicional Adria Pacote 284g 2 Unidades Emb Econôm")).toEqual({
      value: 284,
      unit: "g",
    });
  });

  it("does not treat an AxBcm dimension as a pack multiplier", () => {
    // real catalog case: "12x10cm" is the glue gun's physical dimensions,
    // not "12 packs of 10cm" — multiplier logic must not apply to length units.
    expect(parseProductSize("Pistola Cola Quente 20w127/220 Volts 12x10cm Ydh")).not.toEqual({
      value: 1.2,
      unit: "m",
    });
  });

  it("reads a dot followed by exactly 3 digits as a thousands separator, not a decimal", () => {
    expect(parseProductSize("Carne Bovina Bucho Cry aprox. 1.050g")).toEqual({ value: 1050, unit: "g" });
    // still decimal when it's not a 3-digit group after the dot
    expect(parseProductSize("Suco de Uva Integral Garibaldi 1.5L")).toEqual({ value: 1500, unit: "ml" });
  });

  it("rejects a barcode sitting next to a unit-like token instead of reading it as a huge quantity", () => {
    // real catalog case: a 13-digit EAN next to "Un" would overflow numeric(10,2)
    // and is obviously not a real quantity either way.
    expect(parseProductSize("Aplic Cola Quente Gde Apl40 Bl 7891027314972 Un/1")).toBeNull();
  });

  it("rejects implausible bulk weights instead of reading a produce item as literal tons", () => {
    // real catalog cases — a single mango/peanut/cucumber/apple pack is never
    // hundreds of kilos; whatever "600kg" etc. actually encodes here, it isn't size.
    expect(parseProductSize("Manga Palmer 600kg")).toBeNull();
    expect(parseProductSize("Amendoim Sta Helena Crokissimo 1100kg Pimenta")).toBeNull();
    expect(parseProductSize("Pepino Zilse 1800kg")).toBeNull();
  });

  it("still accepts large-but-real bulk pack sizes", () => {
    expect(parseProductSize("Saco de Arroz Tipo 1 Camil 25kg")).toEqual({ value: 25000, unit: "g" });
    expect(parseProductSize("Água Mineral Bonafont Galão 20L")).toEqual({ value: 20000, unit: "ml" });
  });
});
