import { z } from 'zod';

/** Promotion form validation (business users creating/editing promotions) */
export const promotionSchema = z.object({
  product_id: z.string().uuid('ID do produto invalido'),
  original_price: z.number().positive('Preco original deve ser positivo'),
  promo_price: z.number().positive('Preco promocional deve ser positivo'),
  start_date: z.string().datetime('Data de inicio invalida'),
  end_date: z.string().datetime('Data de fim invalida'),
}).refine(
  (data) => data.promo_price < data.original_price,
  { message: 'Preco promocional deve ser menor que o preco original', path: ['promo_price'] }
).refine(
  (data) => new Date(data.end_date) > new Date(data.start_date),
  { message: 'Data de fim deve ser posterior a data de inicio', path: ['end_date'] }
);

export type PromotionFormData = z.infer<typeof promotionSchema>;

/** Store setup form validation (business users creating a store) */
export const storeSetupSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  address: z.string().min(5, 'Endereco deve ter pelo menos 5 caracteres'),
  city: z.string().min(2, 'Cidade obrigatoria'),
  state: z.string().length(2, 'Estado deve ter 2 letras (ex: SP)'),
  latitude: z.number().min(-90).max(90, 'Latitude invalida'),
  longitude: z.number().min(-180).max(180, 'Longitude invalida'),
});

export type StoreSetupFormData = z.infer<typeof storeSetupSchema>;

/** Alert creation validation */
export const alertSchema = z.object({
  product_id: z.string().uuid('ID do produto invalido'),
  target_price: z.number().positive('Preco alvo deve ser positivo').optional(),
  radius_km: z.number().int().min(1, 'Raio minimo: 1 km').max(50, 'Raio maximo: 50 km'),
});

export type AlertFormData = z.infer<typeof alertSchema>;

/** Profile update validation */
export const profileUpdateSchema = z.object({
  display_name: z.string().min(1, 'Nome obrigatorio').optional(),
  city: z.string().optional(),
  state: z.string().length(2, 'Estado deve ter 2 letras').optional(),
  search_radius_km: z.number().int().min(1).max(50).optional(),
});

export type ProfileUpdateData = z.infer<typeof profileUpdateSchema>;
