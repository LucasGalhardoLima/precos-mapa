import type { Product } from "@/types";

const now = new Date().toISOString();

export const products: Product[] = [
  // Bebidas
  { id: "prod_001", name: "Coca-Cola 2L", category_id: "cat_bebidas", brand: "Coca-Cola", reference_price: 10.99, image_url: null, created_at: now, updated_at: now },
  { id: "prod_002", name: "Suco Del Valle 1L", category_id: "cat_bebidas", brand: "Del Valle", reference_price: 7.49, image_url: null, created_at: now, updated_at: now },
  { id: "prod_003", name: "Cerveja Skol 350ml", category_id: "cat_bebidas", brand: "Skol", reference_price: 3.99, image_url: null, created_at: now, updated_at: now },
  { id: "prod_004", name: "Leite Integral 1L", category_id: "cat_bebidas", brand: "Parmalat", reference_price: 5.99, image_url: null, created_at: now, updated_at: now },

  // Limpeza
  { id: "prod_005", name: "Detergente Ype 500ml", category_id: "cat_limpeza", brand: "Ype", reference_price: 2.99, image_url: null, created_at: now, updated_at: now },
  { id: "prod_006", name: "Sabao em Po Omo 1kg", category_id: "cat_limpeza", brand: "Omo", reference_price: 15.99, image_url: null, created_at: now, updated_at: now },
  { id: "prod_007", name: "Desinfetante Pinho Sol 500ml", category_id: "cat_limpeza", brand: "Pinho Sol", reference_price: 6.49, image_url: null, created_at: now, updated_at: now },

  // Alimentos
  { id: "prod_008", name: "Arroz Tio Joao 5kg", category_id: "cat_alimentos", brand: "Tio Joao", reference_price: 27.99, image_url: null, created_at: now, updated_at: now },
  { id: "prod_009", name: "Feijao Carioca 1kg", category_id: "cat_alimentos", brand: "Camil", reference_price: 8.99, image_url: null, created_at: now, updated_at: now },
  { id: "prod_010", name: "Macarrao Renata 500g", category_id: "cat_alimentos", brand: "Renata", reference_price: 4.49, image_url: null, created_at: now, updated_at: now },
  { id: "prod_011", name: "Oleo de Soja Liza 900ml", category_id: "cat_alimentos", brand: "Liza", reference_price: 7.99, image_url: null, created_at: now, updated_at: now },

  // Hortifruti
  { id: "prod_012", name: "Banana Prata 1kg", category_id: "cat_hortifruti", brand: null, reference_price: 5.99, image_url: null, created_at: now, updated_at: now },
  { id: "prod_013", name: "Tomate Italiano 1kg", category_id: "cat_hortifruti", brand: null, reference_price: 8.49, image_url: null, created_at: now, updated_at: now },
  { id: "prod_014", name: "Batata Lavada 1kg", category_id: "cat_hortifruti", brand: null, reference_price: 6.99, image_url: null, created_at: now, updated_at: now },
  { id: "prod_015", name: "Cebola 1kg", category_id: "cat_hortifruti", brand: null, reference_price: 4.99, image_url: null, created_at: now, updated_at: now },

  // Padaria
  { id: "prod_016", name: "Pao Frances 1kg", category_id: "cat_padaria", brand: null, reference_price: 14.99, image_url: null, created_at: now, updated_at: now },
  { id: "prod_017", name: "Bolo de Chocolate", category_id: "cat_padaria", brand: null, reference_price: 18.99, image_url: null, created_at: now, updated_at: now },
  { id: "prod_018", name: "Biscoito Maizena 200g", category_id: "cat_padaria", brand: "Vitarella", reference_price: 3.99, image_url: null, created_at: now, updated_at: now },

  // Higiene
  { id: "prod_019", name: "Sabonete Dove 90g", category_id: "cat_higiene", brand: "Dove", reference_price: 4.49, image_url: null, created_at: now, updated_at: now },
  { id: "prod_020", name: "Shampoo Pantene 400ml", category_id: "cat_higiene", brand: "Pantene", reference_price: 19.99, image_url: null, created_at: now, updated_at: now },
  { id: "prod_021", name: "Pasta de Dente Colgate 90g", category_id: "cat_higiene", brand: "Colgate", reference_price: 5.99, image_url: null, created_at: now, updated_at: now },
];
