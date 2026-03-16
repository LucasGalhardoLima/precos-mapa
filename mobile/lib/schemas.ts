// Re-export from shared package (specific path to avoid barrel import)
export {
  promotionSchema,
  storeSetupSchema,
  alertSchema,
  profileUpdateSchema,
} from '@poup/shared/lib/schemas';
export type {
  PromotionFormData,
  StoreSetupFormData,
  AlertFormData,
  ProfileUpdateData,
} from '@poup/shared/lib/schemas';
