"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle, ChevronDown, FileText, FileUp, Globe2, Loader2, Plus, RotateCcw, ScanLine, Sparkles, Store, Trash2, X } from "lucide-react";
import { useImporterDraftStore } from "@/features/market-importer/importer-draft-store";
import { formatCurrency } from "@/features/shared/format";
import { EncarteResponse, normalizeEncartePayload, normalizeCategory } from "@/lib/schemas";
import { createStoreAction } from "@/app/painel/(protected)/importador-ia/create-store-action";
import { publishImportAction } from "@/app/painel/(protected)/importador-ia/publish-action";

type ImporterStep = "input" | "processing" | "review" | "queue_continue";

export interface ImportMeta {
  source?: string;
  error?: string;
  imageUrl?: string;
  images?: string[];
  pendingPdfUrls?: string[];
  currentPdfName?: string;
  currentPdfIndex?: number;
  totalPdfs?: number;
}

export interface ImporterPayload extends EncarteResponse {
  meta?: ImportMeta;
}

interface ProgressChunk {
  type: "progress";
  message: string;
}

interface DoneChunk {
  type: "done";
  data: ImporterPayload;
}

interface ErrorChunk {
  type: "error";
  message: string;
}

type StreamChunk = ProgressChunk | DoneChunk | ErrorChunk;

export interface EditableProduct {
  id: string;
  name: string;
  price: number;
  original_price?: number;
  unit: "kg" | "un" | "l" | "g" | "ml" | "pack";
  validity: string | null;
  market_origin?: string;
  category_id?: string;
  is_manual?: boolean;
}

interface MarketOption {
  id: string;
  name: string;
  city: string;
  state: string;
}

interface ImporterWorkbenchProps {
  markets: MarketOption[];
  defaultMarketId: string;
}

const SUPERMARKET_PICKS = [
  { label: "Savegnago Matão", url: "https://www.savegnago.com.br/jornal-de-ofertas/matao" },
  { label: "Jaú Serve Matão", url: "https://jauservesupermercados.com.br/tabloides/cidades/matao/" },
] as const;

const CATEGORY_OPTIONS = [
  { id: "cat_alimentos", label: "Alimentos" },
  { id: "cat_bebidas", label: "Bebidas" },
  { id: "cat_limpeza", label: "Limpeza" },
  { id: "cat_hortifruti", label: "Hortifruti" },
  { id: "cat_padaria", label: "Padaria" },
  { id: "cat_higiene", label: "Higiene" },
] as const;

function toEditableProducts(payload: EncarteResponse): EditableProduct[] {
  return payload.products.map((entry, index) => ({
    id: `${index}-${entry.name}`,
    name: entry.name,
    price: entry.price,
    ...(entry.original_price ? { original_price: entry.original_price } : {}),
    unit: entry.unit,
    validity: entry.validity,
    market_origin: entry.market_origin,
    category_id: entry.category ? normalizeCategory(entry.category) : "cat_alimentos",
  }));
}

function parseChunk(line: string): StreamChunk | null {
  try {
    const raw = JSON.parse(line) as unknown;
    if (!raw || typeof raw !== "object") {
      return null;
    }

    const payload = raw as Partial<StreamChunk>;
    if (payload.type === "progress" && typeof payload.message === "string") {
      return payload as ProgressChunk;
    }

    if (payload.type === "error" && typeof payload.message === "string") {
      return payload as ErrorChunk;
    }

    if (payload.type === "done" && payload.data) {
      const maybeData = payload.data as ImporterPayload;
      const normalized = normalizeEncartePayload(maybeData);
      return {
        type: "done",
        data: {
          products: normalized.products,
          meta: maybeData.meta,
        },
      };
    }

    return null;
  } catch {
    return null;
  }
}

function logWithTimestamp(message: string): string {
  const now = new Date();
  const stamp = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
  return `[${stamp}] ${message}`;
}

function detectMarketOrigin(items: EditableProduct[]): string | null {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.market_origin) {
      const key = item.market_origin.trim();
      if (key) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  if (counts.size === 0) return null;
  let best = "";
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best || null;
}

const CREATE_NEW_VALUE = "__create_new__";

export function ImporterWorkbench({ markets, defaultMarketId }: ImporterWorkbenchProps) {
  const { draft, saveDraft, clearDraft } = useImporterDraftStore();

  const [step, setStep] = useState<ImporterStep>("input");
  const [url, setUrl] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [rawPayload, setRawPayload] = useState<ImporterPayload | null>(null);
  const [products, setProducts] = useState<EditableProduct[]>([]);
  const [originalProducts, setOriginalProducts] = useState<EditableProduct[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // PDF queue state
  const [pdfQueue, setPdfQueue] = useState<string[]>([]);
  const [currentPdfIndex, setCurrentPdfIndex] = useState(1);
  const [totalPdfs, setTotalPdfs] = useState(1);
  const [currentPdfName, setCurrentPdfName] = useState<string | null>(null);
  const [lastPublishCount, setLastPublishCount] = useState(0);

  // Accuracy tracking: compare current products against original AI extraction
  const accuracyData = useMemo(() => {
    if (originalProducts.length === 0) return null;

    const TRACKED_FIELDS: (keyof EditableProduct)[] = ["name", "price", "unit", "validity", "original_price"];
    const originalMap = new Map(originalProducts.map((p) => [p.id, p]));

    // Count unchanged fields for AI products still present
    let unchangedFields = 0;
    let totalAiPresent = 0;
    for (const product of products) {
      if (product.is_manual) continue;
      const original = originalMap.get(product.id);
      if (!original) continue;
      totalAiPresent++;
      for (const field of TRACKED_FIELDS) {
        if (String(product[field] ?? "") === String(original[field] ?? "")) {
          unchangedFields++;
        }
      }
    }

    // Deleted AI products: were in original but not in current (and not manual)
    const currentAiIds = new Set(products.filter((p) => !p.is_manual).map((p) => p.id));
    const deletedProducts = originalProducts.filter((p) => !currentAiIds.has(p.id));

    const manualProducts = products.filter((p) => p.is_manual);
    const totalFields =
      totalAiPresent * TRACKED_FIELDS.length +
      deletedProducts.length * TRACKED_FIELDS.length +
      manualProducts.length * TRACKED_FIELDS.length;

    const accuracyPercent = totalFields > 0 ? Math.round((unchangedFields / totalFields) * 100) : 100;

    return {
      accuracyPercent,
      totalAiProducts: originalProducts.length,
      totalManualProducts: manualProducts.length,
      totalDeletedProducts: deletedProducts.length,
    };
  }, [products, originalProducts]);

  // Market selector state
  const [localMarkets, setLocalMarkets] = useState<MarketOption[]>(markets);
  const [selectedMarketId, setSelectedMarketId] = useState(defaultMarketId || markets[0]?.id || "");

  // Show draft banner on mount if a draft exists
  useEffect(() => {
    if (draft && step === "input") {
      setShowDraftBanner(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function restoreDraft() {
    if (!draft) return;
    setProducts(draft.products);
    setOriginalProducts(draft.originalProducts ?? draft.products);
    setRawPayload(draft.rawPayload);
    setSelectedMarketId(draft.selectedMarketId);
    setPdfQueue(draft.pdfQueue ?? []);
    setCurrentPdfIndex(draft.currentPdfIndex ?? 1);
    setTotalPdfs(draft.totalPdfs ?? 1);
    setStep("review");
    setShowDraftBanner(false);
  }

  function discardDraft() {
    clearDraft();
    setShowDraftBanner(false);
  }
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newMarketName, setNewMarketName] = useState("");
  const [newMarketCity, setNewMarketCity] = useState("");
  const [newMarketState, setNewMarketState] = useState("SP");
  const [newMarketAddress, setNewMarketAddress] = useState("");
  const [creatingStore, setCreatingStore] = useState(false);
  const [detectedOrigin, setDetectedOrigin] = useState<string | null>(null);

  const images = useMemo(() => {
    if (!rawPayload?.meta) {
      return [];
    }
    if (rawPayload.meta.images && rawPayload.meta.images.length > 0) {
      return rawPayload.meta.images;
    }
    if (rawPayload.meta.imageUrl) {
      return [rawPayload.meta.imageUrl];
    }
    return [];
  }, [rawPayload]);

  const selectedMarketLabel = useMemo(() => {
    const market = localMarkets.find((m) => m.id === selectedMarketId);
    return market ? `${market.name} — ${market.city}/${market.state}` : "Selecione um mercado";
  }, [localMarkets, selectedMarketId]);

  // Auto-detect market from extraction results
  const autoDetectMarket = useCallback(
    (items: EditableProduct[]) => {
      const origin = detectMarketOrigin(items);
      if (!origin) {
        setDetectedOrigin(null);
        return;
      }

      const originLower = origin.toLowerCase();
      const match = localMarkets.find((m) => m.name.toLowerCase().includes(originLower) || originLower.includes(m.name.toLowerCase()));
      if (match) {
        setSelectedMarketId(match.id);
        setDetectedOrigin(null);
      } else {
        setDetectedOrigin(origin);
      }
    },
    [localMarkets],
  );

  // Run auto-detect when entering review step
  useEffect(() => {
    if (step === "review" && products.length > 0) {
      autoDetectMarket(products);
    }
  }, [step, products, autoDetectMarket]);

  function appendLog(message: string) {
    setLogs((prev) => [...prev, logWithTimestamp(message)]);
  }

  async function processStream(response: Response) {
    if (!response.body) {
      throw new Error("Resposta sem stream.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const result = await reader.read();
      if (result.done) {
        break;
      }

      buffer += decoder.decode(result.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }
        const chunk = parseChunk(line);
        if (!chunk) {
          continue;
        }

        if (chunk.type === "progress") {
          appendLog(chunk.message);
          continue;
        }

        if (chunk.type === "error") {
          throw new Error(chunk.message);
        }

        setRawPayload(chunk.data);
        const editableProducts = toEditableProducts(chunk.data);
        setProducts(editableProducts);
        setOriginalProducts(editableProducts);

        // Extract PDF queue info from meta
        const meta = chunk.data.meta;
        let queueForDraft: string[] = [];
        let indexForDraft = currentPdfIndex;
        let totalForDraft = totalPdfs;

        if (meta?.totalPdfs && meta.totalPdfs > 1) {
          // Initial multi-PDF crawl
          queueForDraft = meta.pendingPdfUrls ?? [];
          indexForDraft = meta.currentPdfIndex ?? 1;
          totalForDraft = meta.totalPdfs;
          setPdfQueue(queueForDraft);
          setCurrentPdfIndex(indexForDraft);
          setTotalPdfs(totalForDraft);
          setCurrentPdfName(meta.currentPdfName ?? null);
        } else if (pdfQueue.length > 0) {
          // Subsequent queued PDF processed as direct URL — keep existing queue state
          queueForDraft = pdfQueue;
          indexForDraft = currentPdfIndex;
          totalForDraft = totalPdfs;
          setCurrentPdfName(meta?.currentPdfName ?? null);
        } else {
          // Single PDF or screenshot — no queue
          setPdfQueue([]);
          setCurrentPdfIndex(1);
          setTotalPdfs(1);
          setCurrentPdfName(null);
        }

        saveDraft({
          products: editableProducts,
          originalProducts: editableProducts,
          rawPayload: chunk.data,
          selectedMarketId,
          savedAt: Date.now(),
          pdfQueue: queueForDraft,
          currentPdfIndex: indexForDraft,
          totalPdfs: totalForDraft,
        });
        appendLog(
          `Concluído: ${chunk.data.products.length} itens extraídos (${chunk.data.meta?.source ?? "desconhecido"}).`,
        );
        appendLog("Extração concluída e pronta para revisão.");
        setStep("review");
      }
    }
  }

  async function startCrawl(targetUrl: string) {
    setFeedback(null);
    setStep("processing");
    setLogs([logWithTimestamp(`Iniciando análise da URL: ${targetUrl}`)]);

    try {
      const response = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
      });

      if (!response.ok) {
        throw new Error("Falha ao iniciar crawler.");
      }

      await processStream(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha inesperada no crawler.";
      setFeedback(message);
      appendLog(`Erro: ${message}`);
      setStep("input");
    }
  }

  async function runUrlImport() {
    if (!url) {
      setFeedback("Informe uma URL para iniciar a análise.");
      return;
    }
    await startCrawl(url);
  }

  async function runPdfImport(file: File) {
    setFeedback(null);
    setStep("processing");
    setLogs([logWithTimestamp(`Upload iniciado: ${file.name}`)]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Falha ao processar PDF.");
      }

      await processStream(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha inesperada no upload.";
      setFeedback(message);
      appendLog(`Erro: ${message}`);
      setStep("input");
    }
  }

  function makeDraft(overrides: Partial<{ products: EditableProduct[]; selectedMarketId: string }> = {}) {
    return {
      products: overrides.products ?? products,
      originalProducts,
      rawPayload,
      selectedMarketId: overrides.selectedMarketId ?? selectedMarketId,
      savedAt: Date.now(),
      pdfQueue,
      currentPdfIndex,
      totalPdfs,
    };
  }

  function updateProduct(index: number, patch: Partial<EditableProduct>) {
    const updated = products.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item));
    setProducts(updated);
    saveDraft(makeDraft({ products: updated }));
  }

  function removeProduct(index: number) {
    const updated = products.filter((_, itemIndex) => itemIndex !== index);
    setProducts(updated);
    saveDraft(makeDraft({ products: updated }));
  }

  function addProduct() {
    const newProduct: EditableProduct = {
      id: `manual-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      name: "",
      price: 0,
      unit: "un",
      validity: null,
      is_manual: true,
    };
    const updated = [...products, newProduct];
    setProducts(updated);
    saveDraft(makeDraft({ products: updated }));
  }

  async function handleCreateStore() {
    if (!newMarketName.trim()) {
      setFeedback("Nome do mercado é obrigatório.");
      return;
    }

    setCreatingStore(true);
    setFeedback(null);

    const result = await createStoreAction({
      name: newMarketName,
      city: newMarketCity,
      state: newMarketState,
      address: newMarketAddress,
    });

    setCreatingStore(false);

    if (result.error) {
      setFeedback(result.error);
      return;
    }

    if (result.data) {
      setLocalMarkets((prev) => [...prev, result.data!]);
      setSelectedMarketId(result.data.id);
      setShowCreateForm(false);
      setDetectedOrigin(null);
      setNewMarketName("");
      setNewMarketCity("");
      setNewMarketState("SP");
      setNewMarketAddress("");
      setFeedback(`Mercado "${result.data.name}" criado com sucesso.`);
    }
  }

  function handleDetectedOriginCreate() {
    if (detectedOrigin) {
      setNewMarketName(detectedOrigin);
      setShowCreateForm(true);
      setDetectedOrigin(null);
    }
  }

  function handleMarketSelect(value: string) {
    if (value === CREATE_NEW_VALUE) {
      setShowCreateForm(true);
    } else {
      setSelectedMarketId(value);
      setShowCreateForm(false);
      if (step === "review") {
        saveDraft(makeDraft({ selectedMarketId: value }));
      }
    }
  }

  async function publishToMarket() {
    if (!selectedMarketId) {
      setFeedback("Selecione um mercado antes de publicar.");
      return;
    }

    setPublishing(true);
    setFeedback(null);

    const result = await publishImportAction({
      storeId: selectedMarketId,
      products: products.map((item) => ({
        name: item.name,
        price: item.price,
        ...(item.original_price ? { original_price: item.original_price } : {}),
        unit: item.unit,
        validity: item.validity,
        category_id: item.category_id ?? "cat_alimentos",
      })),
      accuracyData: accuracyData ?? undefined,
    });

    setPublishing(false);

    if (result.count === 0 && result.error) {
      setFeedback(result.error);
      return;
    }

    if (pdfQueue.length > 0) {
      setLastPublishCount(result.count);
      clearDraft();
      setStep("queue_continue");
      return;
    }

    clearDraft();
    const market = localMarkets.find((m) => m.id === selectedMarketId);
    const msg = `${result.count} ofertas publicadas no mercado "${market?.name ?? selectedMarketId}".`;
    setFeedback(result.error ? `${msg} (${result.error})` : msg);
  }

  async function continueToNextPdf() {
    if (pdfQueue.length === 0) return;
    const nextUrl = pdfQueue[0];
    const remaining = pdfQueue.slice(1);
    const nextIndex = currentPdfIndex + 1;
    setPdfQueue(remaining);
    setCurrentPdfIndex(nextIndex);
    setProducts([]);
    setOriginalProducts([]);
    setRawPayload(null);
    setFeedback(null);
    await startCrawl(nextUrl);
  }

  function finishImport() {
    setPdfQueue([]);
    setCurrentPdfIndex(1);
    setTotalPdfs(1);
    setCurrentPdfName(null);
    setLastPublishCount(0);
    setProducts([]);
    setOriginalProducts([]);
    setRawPayload(null);
    clearDraft();
    setFeedback(null);
    setStep("input");
  }

  return (
    <div className="space-y-5">
      {showDraftBanner && draft ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-indigo-900">Rascunho salvo</p>
            <p className="mt-0.5 text-xs text-indigo-700">
              {new Date(draft.savedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              {" — "}
              {draft.products.length} {draft.products.length === 1 ? "produto" : "produtos"}. Continuar revisão?
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={restoreDraft}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)]"
            >
              <RotateCcw className="h-4 w-4" />
              Continuar
            </button>
            <button
              type="button"
              onClick={discardDraft}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
            >
              <X className="h-4 w-4" />
              Descartar
            </button>
          </div>
        </section>
      ) : null}

      {step === "input" ? (
        <section className="grid gap-4 rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)] lg:grid-cols-[1.3fr_0.7fr]">
          <article>
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">1. Entrada do encarte</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Cole uma URL de encarte ou envie PDF. O pipeline usa IA para extrair ofertas automaticamente.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {SUPERMARKET_PICKS.map((pick) => (
                <button
                  key={pick.url}
                  type="button"
                  onClick={() => setUrl(pick.url)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    url === pick.url
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                      : "border-[var(--color-line)] bg-white text-[var(--color-ink)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                  }`}
                >
                  {pick.label}
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Globe2 className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[var(--color-muted)]" />
                <input
                  type="url"
                  placeholder="https://mercado.com.br/ofertas"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  className="w-full rounded-xl border border-[var(--color-line)] px-10 py-3 text-sm focus:border-[var(--color-primary)] focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={runUrlImport}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)]"
              >
                <ScanLine className="h-4 w-4" />
                Analisar URL
              </button>
            </div>
          </article>

          <article className="rounded-xl border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] p-4">
            <h3 className="text-sm font-semibold text-[var(--color-ink)]">Upload de PDF</h3>
            <p className="mt-1 text-xs text-[var(--color-muted)]">Ideal para encartes em lote com várias páginas.</p>
            <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm font-medium text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary-deep)]">
              <FileUp className="h-4 w-4" />
              Selecionar PDF
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void runPdfImport(file);
                  }
                  event.target.value = "";
                }}
              />
            </label>
          </article>
        </section>
      ) : null}

      {step === "processing" ? (
        <section className="rounded-2xl border border-[var(--color-line)] bg-[#0f172a] p-5 text-white shadow-[var(--shadow-soft)]">
          <div className="mb-4 flex items-center gap-2 text-sm text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Processando encarte em tempo real
          </div>
          <div className="max-h-[320px] space-y-1 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-4 font-mono text-xs text-emerald-300">
            {logs.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </section>
      ) : null}

      {step === "review" ? (
        <section className="grid gap-4 xl:grid-cols-2">
          <article className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-[var(--color-ink)]">2. Revisão visual</h2>
              {totalPdfs > 1 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                  <FileText className="h-3 w-3" />
                  PDF {currentPdfIndex} de {totalPdfs}{currentPdfName ? `: ${currentPdfName}` : ""}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Dados extraídos em tempo real. Revise antes de publicar.
            </p>
            <div className="mt-4 max-h-[520px] space-y-4 overflow-y-auto rounded-xl bg-[var(--color-surface)] p-3">
              {images.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)]">Sem prévia de imagem disponível.</p>
              ) : (
                images.map((image, index) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={`${image}-${index}`} src={image} alt={`Página ${index + 1}`} className="w-full rounded-lg border border-[var(--color-line)]" />
                ))
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--color-ink)]">3. Ajustar e publicar</h2>
              {accuracyData ? (
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full ${
                      accuracyData.accuracyPercent >= 90
                        ? "bg-emerald-500"
                        : accuracyData.accuracyPercent >= 70
                          ? "bg-amber-500"
                          : "bg-rose-500"
                    }`}
                  />
                  <span className="text-xs font-medium text-[var(--color-ink)]">
                    Precisao IA: {accuracyData.accuracyPercent}%
                  </span>
                </div>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Valide os dados e selecione o mercado de destino.
              {accuracyData && accuracyData.totalManualProducts > 0 ? (
                <span className="ml-1 text-amber-600">
                  {accuracyData.totalManualProducts} produto(s) adicionado(s) manualmente.
                </span>
              ) : accuracyData && accuracyData.accuracyPercent < 100 ? (
                <span className="ml-1 text-[var(--color-muted)]"> Campos editados pelo usuario.</span>
              ) : null}
            </p>

            <div className="mt-4 max-h-[430px] space-y-2 overflow-y-auto pr-1">
              {products.map((product, index) => (
                <div
                  key={product.id}
                  className={`grid gap-2 rounded-xl border p-3 ${
                    product.is_manual ? "border-amber-300 bg-amber-50/50" : "border-[var(--color-line)]"
                  }`}
                >
                  {product.is_manual ? (
                    <span className="inline-flex w-fit items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                      <Plus className="h-3 w-3" />
                      Adicionado manualmente
                    </span>
                  ) : null}
                  <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                    <input
                      value={product.name}
                      onChange={(event) => updateProduct(index, { name: event.target.value })}
                      className="rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeProduct(index)}
                      className="inline-flex items-center justify-center rounded-lg border border-rose-200 px-2 py-2 text-rose-600 transition hover:bg-rose-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid gap-2 md:grid-cols-5">
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]">Preço original (de)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="—"
                        value={product.original_price ?? ""}
                        onChange={(event) => {
                          const val = event.target.value;
                          updateProduct(index, { original_price: val ? Number(val) : undefined });
                        }}
                        className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]">Preço promo (por)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={product.price}
                        onChange={(event) => updateProduct(index, { price: Number(event.target.value) })}
                        className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]">Unidade</label>
                      <select
                        value={product.unit}
                        onChange={(event) =>
                          updateProduct(index, {
                            unit: event.target.value as EditableProduct["unit"],
                          })
                        }
                        className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none"
                      >
                        <option value="un">un</option>
                        <option value="kg">kg</option>
                        <option value="l">l</option>
                        <option value="g">g</option>
                        <option value="ml">ml</option>
                        <option value="pack">pack</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]">Validade</label>
                      <input
                        type="date"
                        value={product.validity ?? ""}
                        onChange={(event) => updateProduct(index, { validity: event.target.value || null })}
                        className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]">Categoria</label>
                      <select
                        value={product.category_id ?? "cat_alimentos"}
                        onChange={(event) => updateProduct(index, { category_id: event.target.value })}
                        className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none"
                      >
                        {CATEGORY_OPTIONS.map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <p className="text-xs text-[var(--color-muted)]">
                    {product.original_price && product.original_price > product.price
                      ? `De ${formatCurrency(product.original_price)} por ${formatCurrency(product.price)} (−${Math.round(((product.original_price - product.price) / product.original_price) * 100)}%)`
                      : `Preço final: ${formatCurrency(product.price)}`}
                  </p>
                </div>
              ))}
            </div>

            {/* Add product button */}
            <button
              type="button"
              onClick={addProduct}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--color-line)] px-4 py-3 text-sm font-medium text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            >
              <Plus className="h-4 w-4" />
              Adicionar produto
            </button>

            {/* Market selector */}
            <div className="mt-4 space-y-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3">
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--color-ink)]">
                  <Store className="h-3.5 w-3.5" />
                  Publicar no mercado:
                </label>
                <div className="relative">
                  <select
                    value={showCreateForm ? CREATE_NEW_VALUE : selectedMarketId}
                    onChange={(event) => handleMarketSelect(event.target.value)}
                    className="w-full appearance-none rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 pr-8 text-sm focus:border-[var(--color-primary)] focus:outline-none"
                  >
                    {localMarkets.map((market) => (
                      <option key={market.id} value={market.id}>
                        {market.name} — {market.city}/{market.state}
                      </option>
                    ))}
                    <option value={CREATE_NEW_VALUE}>+ Adicionar novo mercado...</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-3 h-4 w-4 text-[var(--color-muted)]" />
                </div>
              </div>

              {/* Detected origin suggestion chip */}
              {detectedOrigin ? (
                <button
                  type="button"
                  onClick={handleDetectedOriginCreate}
                  className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700 transition hover:bg-indigo-100"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Mercado detectado: &quot;{detectedOrigin}&quot; — Criar?
                </button>
              ) : null}

              {/* Inline create form */}
              {showCreateForm ? (
                <div className="space-y-2 rounded-lg border border-[var(--color-line)] bg-white p-3">
                  <p className="text-xs font-semibold text-[var(--color-ink)]">Novo mercado</p>
                  <input
                    type="text"
                    placeholder="Nome do mercado"
                    value={newMarketName}
                    onChange={(event) => setNewMarketName(event.target.value)}
                    className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Endereco (Rua, numero, bairro)"
                    value={newMarketAddress}
                    onChange={(event) => setNewMarketAddress(event.target.value)}
                    className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Cidade"
                      value={newMarketCity}
                      onChange={(event) => setNewMarketCity(event.target.value)}
                      className="rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="UF (ex: SP)"
                      value={newMarketState}
                      onChange={(event) => setNewMarketState(event.target.value)}
                      maxLength={2}
                      className="rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm uppercase focus:border-[var(--color-primary)] focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleCreateStore()}
                      disabled={creatingStore}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[var(--color-primary-deep)] disabled:opacity-50"
                    >
                      {creatingStore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      Criar
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="rounded-lg border border-[var(--color-line)] px-3 py-2 text-xs text-[var(--color-muted)] transition hover:bg-[var(--color-surface)]"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-between">
                <p className="text-sm text-[var(--color-muted)]">{products.length} itens prontos para publicação</p>
                <button
                  type="button"
                  onClick={() => void publishToMarket()}
                  disabled={!selectedMarketId || showCreateForm || publishing}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] disabled:opacity-50"
                >
                  {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {publishing ? "Publicando..." : `Publicar em ${selectedMarketLabel}`}
                </button>
              </div>
            </div>
          </article>
        </section>
      ) : null}

      {step === "queue_continue" ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-[var(--shadow-soft)]">
          <div className="flex items-start gap-3">
            <CheckCircle className="mt-0.5 h-6 w-6 flex-shrink-0 text-emerald-600" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-emerald-900">
                {lastPublishCount} ofertas publicadas!
              </h2>
              <p className="mt-1 text-sm text-emerald-700">
                PDF {currentPdfIndex} de {totalPdfs} concluído{currentPdfName ? `: ${currentPdfName}` : ""}.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void continueToNextPdf()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)]"
                >
                  <ArrowRight className="h-4 w-4" />
                  Continuar para PDF {currentPdfIndex + 1} de {totalPdfs}
                </button>

                <button
                  type="button"
                  onClick={finishImport}
                  className="text-sm font-medium text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
                >
                  Encerrar importação
                </button>

                <Link
                  href={`/painel/ofertas?store=${selectedMarketId}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary)] transition hover:text-[var(--color-primary-deep)]"
                >
                  Ver Minhas Ofertas
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {feedback ? (
        <div className="rounded-xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm text-[var(--color-primary-deep)]">
          {feedback}
          {feedback.includes("publicadas") ? (
            <Link href={`/painel/ofertas?store=${selectedMarketId}`} className="ml-2 inline-flex items-center gap-1 font-semibold text-[var(--color-primary)]">
              Ver Minhas Ofertas
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
