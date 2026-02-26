// Re-export from shared package (specific path to avoid barrel import)
export {
  promotionSchema,
  storeSetupSchema,
  alertSchema,
  profileUpdateSchema,
} from '@precomapa/shared/lib/schemas';
export type {
  PromotionFormData,
  StoreSetupFormData,
  AlertFormData,
  ProfileUpdateData,
} from '@precomapa/shared/lib/schemas';
