import { z } from 'zod';

export const ProductSchema = z.object({
  name: z.string().describe("Nome do produto formatado (ex: 'Arroz Tio João')"),
  price: z.number().describe("Preço numérico do produto (ex: 29.90)"),
  unit: z.enum(["kg", "un", "l", "g", "ml", "pack"]).describe("Unidade de medida padronizada"),
  validity: z.string().nullable().describe("Data de validade da promoção no formato YYYY-MM-DD. Se não houver, null."),
  market_origin: z.string().optional().describe("Nome do supermercado de origem (ex: Savegnago)")
});


export const EncarteSchema = z.object({
  products: z.array(ProductSchema)
});

export type EncarteResponse = z.infer<typeof EncarteSchema>;
