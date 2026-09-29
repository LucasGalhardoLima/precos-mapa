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

  it("gives no size for 'X g N unidades' with no marker, instead of guessing per item or total", () => {
    // real catalog case: 284 g may be the whole pack or each of the 2 units, and the name
    // does not say which. It used to return 284 g (per item); the PM decision is no size.
    expect(parseProductSize("Torrada Tradicional Adria Pacote 284g 2 Unidades Emb Econôm")).toBeNull();
    expect(parseProductSize("Sabonete Dove 90g 6 Unidades")).toBeNull();
  });

  it("still reads a lone mass/volume, and a count of 1 does not make it ambiguous", () => {
    expect(parseProductSize("Torrada Tradicional Adria Pacote 284g")).toEqual({ value: 284, unit: "g" });
    expect(parseProductSize("Sabonete Dove 90g 1 Unidade")).toEqual({ value: 90, unit: "g" });
  });

  it("does not treat an AxBcm dimension as a pack multiplier", () => {
    // real catalog case: "12x10cm" is the glue gun's physical dimensions,
    // not "12 packs of 10cm" — multiplier logic must not apply to length units.
    expect(parseProductSize("Pistola Cola Quente 20w127/220 Volts 12x10cm Ydh")).not.toEqual({
      value: 1.2,
      unit: "m",
    });
  });

  describe("physical dimensions are not a pack size", () => {
    it.each([
      ["Kit Colcha King Burdays 280x260cm 3 Peças"], // was read as 2.6 m
      ["Capa de Colchão Solteiro Sortido Homeland 1,88m x 0,88m x 30cm"], // was 0.3 m
      ["Grelha Inox Utimil Moeda 37x48cm para Churrasco"],
      ["Sacola Preta 23,5x31,5cm"],
      ["Sacola Retornável Vinho CáPraLá 300x200x150mm"],
      ["Toalha de Banho 70x140cm"],
      ["Tapete 2,00m x 1,50m"],
      ["Pistola Cola Quente 12x10cm"],
    ])("%s -> null", (name) => {
      expect(parseProductSize(name)).toBeNull();
    });

    it("still reads a real size next to the dimensions", () => {
      expect(parseProductSize("Toalha de Banho 70x140cm Pacote 500g")).toEqual({ value: 500, unit: "g" });
    });

    it("keeps rolls x length and mass/volume multipacks as before", () => {
      expect(parseProductSize("Papel Higiênico Folha Dupla 12X30M")).toEqual({ value: 30, unit: "m" });
      expect(parseProductSize("Papel Higiênico Neve 4x30m")).toEqual({ value: 30, unit: "m" });
      expect(parseProductSize("Refrigerante Lata 6x350ml")).toEqual({ value: 2100, unit: "ml" });
    });
  });

  describe("audit findings (lines of docs/poup-normalizacao-auditoria-preaudit.csv)", () => {
    it("line 0 / 207: NxM and 'A x B x C' dimensions give no size", () => {
      expect(parseProductSize("Kit Colcha King Burdays 280x260cm 3 Peças")).toBeNull();
      expect(parseProductSize("Capa de Colchão Solteiro Sortido Homeland 1,88m x 0,88m x 30cm")).toBeNull();
    });

    it("line 64: a bare cm/m dimension outside length-sold goods is not a size", () => {
      expect(parseProductSize("Tampa de Vidro Temperado para Panela Uni Lar 24cm")).toBeNull();
      expect(parseProductSize("Prato para Vaso Redondo Preto Bella Fiore 22cm")).toBeNull();
      // and the count next to it is still read
      expect(parseProductSize("Prato Descartável Bompack Amarelo 15cm Com 10 Unidades")).toEqual({ value: 10, unit: "un" });
      expect(parseProductSize("Rodo Plástico Select 60cm 1 Unidade")).toEqual({ value: 1, unit: "un" });
    });

    it("keeps lengths for goods sold by length (film, paper, dental floss, bags)", () => {
      expect(parseProductSize("Filme PVC Biodegradável Facilita & Pronto Eco Pacote 30m")).toEqual({ value: 30, unit: "m" });
      expect(parseProductSize("Fio Dental Colgate 50m")).toEqual({ value: 50, unit: "m" });
    });

    it("line 150: 'N unidades de X g' is the pack total", () => {
      expect(parseProductSize("Biscoito BelVita Leite E Aveia Multipack 75g com 3 Unidades de 25g")).toEqual({ value: 75, unit: "g" });
      expect(parseProductSize("Suco Pacote com 6 Unidades de 200ml")).toEqual({ value: 1200, unit: "ml" });
    });

    it("line 163: after a single-serve noun the trailing count multiplies", () => {
      expect(parseProductSize("Maionese Tradicional Predilecta Sachê 7g 144 Unidades")).toEqual({ value: 1008, unit: "g" });
    });

    it("the single-serve noun may be followed by a brand before the size", () => {
      expect(parseProductSize("Molho Barbecue Sachê Predilecta 7g 144 Unidades")).toEqual({ value: 1008, unit: "g" });
    });

    it("line 199: an explicit total wins over the per-unit 'X g cada'", () => {
      expect(
        parseProductSize("Iogurte Parcialmente Desnatado Morango Chambinho Nestlé Bandeja 510g 6 Unidades 85g Cada"),
      ).toEqual({ value: 510, unit: "g" });
      expect(
        parseProductSize("Pack Sabonete Barra Perfumado Rosas Brancas e Avelã Flor de Ypê Envoltório 340g 4 Unidades 85g Cada"),
      ).toEqual({ value: 340, unit: "g" });
    });

    it("line 294: 'suporta até X kg' is a capacity, not a size", () => {
      expect(parseProductSize("Gancho Pequeno Branco com Tira Adesiva Suporta até 0,5kg Scotch C/4 Unidades")).toEqual({ value: 4, unit: "un" });
    });

    it("without an explicit total, 'N Unidades X g Cada' is N x X", () => {
      expect(parseProductSize("Pack Cerveja Pilsen Skol Lata 12 Unidades 350ml Cada")).toEqual({ value: 4200, unit: "ml" });
      expect(parseProductSize("Pack Creme Dental Extra Fresh Oral-B Caixa 3 Unidades 70g Cada Família")).toEqual({ value: 210, unit: "g" });
    });

    it("keeps width x length for goods sold by length (film, tape, foil)", () => {
      expect(parseProductSize("Filme PVC Bompack 28cm x 15m")).toEqual({ value: 15, unit: "m" });
      expect(parseProductSize("Fita Isolante FOXLUX Preta 10m x 19mm")).toEqual({ value: 10, unit: "m" });
      expect(parseProductSize("Papel alumínio Bompack 30cm x 4m")).toEqual({ value: 4, unit: "m" });
    });

    it("keeps the length of aluminium foil and elastic, sold by the metre", () => {
      expect(parseProductSize("Folha de Alumínio Wyda R30 7,5m")).toEqual({ value: 7.5, unit: "m" });
      expect(parseProductSize("Folha De Alumínio Paraná 45Cm C/ 4M")).toEqual({ value: 4, unit: "m" });
      expect(parseProductSize("Elastico Real 10mm 10m Nº14")).toEqual({ value: 10, unit: "m" });
      // an aluminium pan is not sold by length
      expect(parseProductSize("Panela de Alumínio Tramontina 24cm")).toBeNull();
    });

    it("does not read the abbreviation '350m' (ml) as 350 metres", () => {
      expect(parseProductSize("Refrig Sprite 350m")).toBeNull();
    });

    it("'com N unidades' and 'c/N' are multipack markers: N x X", () => {
      expect(parseProductSize("Cerveja Brahma lata 350ml com 18 unidades")).toEqual({ value: 6300, unit: "ml" });
      expect(parseProductSize("Detergente líquido Ypê 500ml com 6 unidades")).toEqual({ value: 3000, unit: "ml" });
      expect(parseProductSize("Creme Dental Colgate 70g C/3")).toEqual({ value: 210, unit: "g" });
      expect(parseProductSize("Sabonete Dove 90g c/ 6 un")).toEqual({ value: 540, unit: "g" });
    });

    it("'com 2 divisões' is not a pack marker", () => {
      expect(parseProductSize("Marmita Térmica 1,4L com 2 divisões")).toEqual({ value: 1400, unit: "ml" });
    });

    it("counted goods (utilidades-limpeza, descartaveis, utensilios) are sized by the piece count", () => {
      const cases: [string, string, number][] = [
        ["Saco de Lixo Kid Roll 30l Rolo C/20 Unidades", "utilidades-limpeza", 20],
        ["Copo para Brigadeiro Cristal Valves Festas 50ml C/10 Unidades", "descartaveis", 10],
        ["Pote e Tampa Cristal Descartável Strawplast 10un 180ml", "descartaveis", 10],
        ["Jogo Taça Vidro Kayra 480ml Com 6 Unidades", "utensilios", 6],
      ];
      for (const [name, categoryL2, n] of cases) {
        expect(parseProductSize(name, { categoryL2 }), name).toEqual({ value: n, unit: "un" });
      }
    });

    it("without a counted-goods category the same names fall back to N x X or no size", () => {
      expect(parseProductSize("Copo para Brigadeiro Cristal Valves Festas 50ml C/10 Unidades")).toEqual({ value: 500, unit: "ml" });
      expect(parseProductSize("Pote e Tampa Cristal Descartável Strawplast 10un 180ml")).toBeNull();
      expect(parseProductSize("Copo Estela 460ml C/6", { categoryL2: "cerveja" })).toEqual({ value: 2760, unit: "ml" });
    });

    it("'Pacote 284g 2 Unidades' has no clear marker: no size (unlike sachê/stick, cada, N x)", () => {
      expect(parseProductSize("Pacote 284g 2 Unidades")).toBeNull();
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
