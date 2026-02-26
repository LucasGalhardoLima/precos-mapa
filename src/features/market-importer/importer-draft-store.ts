"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { EditableProduct, ImporterPayload } from "@/features/market-importer/importer-workbench";

export interface ImporterDraft {
  products: EditableProduct[];
  originalProducts?: EditableProduct[];
  rawPayload: ImporterPayload | null;
  selectedMarketId: string;
  savedAt: number;
  pdfQueue?: string[];
  currentPdfIndex?: number;
  totalPdfs?: number;
}

interface ImporterDraftStore {
  draft: ImporterDraft | null;
  saveDraft: (data: ImporterDraft) => void;
  clearDraft: () => void;
}

const STORAGE_KEY = "precomapa_importer_draft_v1";

function stripImages(payload: ImporterPayload | null): ImporterPayload | null {
  if (!payload) return null;
  if (!payload.meta) return payload;
  const { images: _images, imageUrl: _imageUrl, ...restMeta } = payload.meta;
  return { ...payload, meta: restMeta };
}

const useImporterDraftStoreBase = create<ImporterDraftStore>()(
  persist(
    (set) => ({
      draft: null,
      saveDraft: (data: ImporterDraft) =>
        set({ draft: { ...data, rawPayload: stripImages(data.rawPayload) } }),
      clearDraft: () => set({ draft: null }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ draft: state.draft }),
    },
  ),
);

export function useImporterDraftStore(): ImporterDraftStore {
  return useImporterDraftStoreBase();
}
