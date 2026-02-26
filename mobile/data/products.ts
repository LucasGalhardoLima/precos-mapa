import type { Product } from "@/types";

export const products: Product[] = [
  // Bebidas
  { id: "prod_001", name: "Coca-Cola 2L", category: "cat_bebidas", brand: "Coca-Cola", referencePrice: 10.99 },
  { id: "prod_002", name: "Suco Del Valle 1L", category: "cat_bebidas", brand: "Del Valle", referencePrice: 7.49 },
  { id: "prod_003", name: "Cerveja Skol 350ml", category: "cat_bebidas", brand: "Skol", referencePrice: 3.99 },
  { id: "prod_004", name: "Leite Integral 1L", category: "cat_bebidas", brand: "Parmalat", referencePrice: 5.99 },

  // Limpeza
  { id: "prod_005", name: "Detergente Ype 500ml", category: "cat_limpeza", brand: "Ype", referencePrice: 2.99 },
  { id: "prod_006", name: "Sabao em Po Omo 1kg", category: "cat_limpeza", brand: "Omo", referencePrice: 15.99 },
  { id: "prod_007", name: "Desinfetante Pinho Sol 500ml", category: "cat_limpeza", brand: "Pinho Sol", referencePrice: 6.49 },

  // Alimentos
  { id: "prod_008", name: "Arroz Tio Joao 5kg", category: "cat_alimentos", brand: "Tio Joao", referencePrice: 27.99 },
  { id: "prod_009", name: "Feijao Carioca 1kg", category: "cat_alimentos", brand: "Camil", referencePrice: 8.99 },
  { id: "prod_010", name: "Macarrao Renata 500g", category: "cat_alimentos", brand: "Renata", referencePrice: 4.49 },
  { id: "prod_011", name: "Oleo de Soja Liza 900ml", category: "cat_alimentos", brand: "Liza", referencePrice: 7.99 },

  // Hortifruti
  { id: "prod_012", name: "Banana Prata 1kg", category: "cat_hortifruti", referencePrice: 5.99 },
  { id: "prod_013", name: "Tomate Italiano 1kg", category: "cat_hortifruti", referencePrice: 8.49 },
  { id: "prod_014", name: "Batata Lavada 1kg", category: "cat_hortifruti", referencePrice: 6.99 },
  { id: "prod_015", name: "Cebola 1kg", category: "cat_hortifruti", referencePrice: 4.99 },

  // Padaria
  { id: "prod_016", name: "Pao Frances 1kg", category: "cat_padaria", referencePrice: 14.99 },
  { id: "prod_017", name: "Bolo de Chocolate", category: "cat_padaria", referencePrice: 18.99 },
  { id: "prod_018", name: "Biscoito Maizena 200g", category: "cat_padaria", brand: "Vitarella", referencePrice: 3.99 },

  // Higiene
  { id: "prod_019", name: "Sabonete Dove 90g", category: "cat_higiene", brand: "Dove", referencePrice: 4.49 },
  { id: "prod_020", name: "Shampoo Pantene 400ml", category: "cat_higiene", brand: "Pantene", referencePrice: 19.99 },
  { id: "prod_021", name: "Pasta de Dente Colgate 90g", category: "cat_higiene", brand: "Colgate", referencePrice: 5.99 },
];
