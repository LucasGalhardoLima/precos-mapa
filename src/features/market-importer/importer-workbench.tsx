"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileUp, Globe2, Loader2, ScanLine, Sparkles, Trash2 } from "lucide-react";
import { useOffersStore } from "@/features/offers/offers-store";
import { usePanelSession } from "@/features/panel/panel-session-context";
import { formatCurrency } from "@/features/shared/format";
import { EncarteResponse, ProductSchema } from "@/lib/schemas";

type ImporterStep = "input" | "processing" | "review";

interface ImportMeta {
  isMock?: boolean;
  source?: string;
  imageUrl?: string;
  images?: string[];
}

interface ImporterPayload extends EncarteResponse {
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

interface EditableProduct {
  id: string;
  name: string;
  price: number;
  unit: "kg" | "un" | "l" | "g" | "ml" | "pack";
  validity: string | null;
  market_origin?: string;
}

function toEditableProducts(payload: EncarteResponse): EditableProduct[] {
  return payload.products.map((entry, index) => ({
    id: `${index}-${entry.name}`,
    name: entry.name,
    price: entry.price,
    unit: entry.unit,
    validity: entry.validity,
    market_origin: entry.market_origin,
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
      const validated = ProductSchema.array().safeParse(maybeData.products);
      if (validated.success) {
        return {
          type: "done",
          data: {
            products: validated.data,
            meta: maybeData.meta,
          },
        };
      }
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

export function ImporterWorkbench() {
  const session = usePanelSession();
  const { publishImportedOffers } = useOffersStore();

  const [step, setStep] = useState<ImporterStep>("input");
  const [url, setUrl] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [rawPayload, setRawPayload] = useState<ImporterPayload | null>(null);
  const [products, setProducts] = useState<EditableProduct[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

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
        setProducts(toEditableProducts(chunk.data));
        appendLog("Extração concluída e pronta para revisão.");
        setStep("review");
      }
    }
  }

  async function runUrlImport() {
    if (!url) {
      setFeedback("Informe uma URL para iniciar a análise.");
      return;
    }

    setFeedback(null);
    setStep("processing");
    setLogs([logWithTimestamp(`Iniciando análise da URL: ${url}`)]);

    try {
      const response = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
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

  function updateProduct(index: number, patch: Partial<EditableProduct>) {
    setProducts((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function removeProduct(index: number) {
    setProducts((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  function publishToMarket() {
    const payload: EncarteResponse = {
      products: products.map((item) => ({
        name: item.name,
        price: item.price,
        unit: item.unit,
        validity: item.validity,
        market_origin: item.market_origin,
      })),
    };

    const total = publishImportedOffers(session.currentMarketId, payload);
    setFeedback(`${total} ofertas publicadas no mercado ativo.`);
  }

  return (
    <div className="space-y-5">
      {step === "input" ? (
        <section className="grid gap-4 rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)] lg:grid-cols-[1.3fr_0.7fr]">
          <article>
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">1. Entrada do encarte</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Cole uma URL de encarte ou envie PDF. O pipeline usa crawler real com fallback mock para garantir a demo.
            </p>

            <div className="mt-4 flex flex-col gap-3 md:flex-row">
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
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">2. Revisão visual</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              {rawPayload?.meta?.isMock ? "Dados em modo mock para apresentação." : "Dados extraídos em tempo real."}
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
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">3. Ajustar e publicar</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">Valide os dados antes de publicar no mercado ativo.</p>

            <div className="mt-4 max-h-[430px] space-y-2 overflow-y-auto pr-1">
              {products.map((product, index) => (
                <div key={product.id} className="grid gap-2 rounded-xl border border-[var(--color-line)] p-3">
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

                  <div className="grid gap-2 md:grid-cols-3">
                    <input
                      type="number"
                      step="0.01"
                      value={product.price}
                      onChange={(event) => updateProduct(index, { price: Number(event.target.value) })}
                      className="rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none"
                    />
                    <select
                      value={product.unit}
                      onChange={(event) =>
                        updateProduct(index, {
                          unit: event.target.value as EditableProduct["unit"],
                        })
                      }
                      className="rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none"
                    >
                      <option value="un">un</option>
                      <option value="kg">kg</option>
                      <option value="l">l</option>
                      <option value="g">g</option>
                      <option value="ml">ml</option>
                      <option value="pack">pack</option>
                    </select>
                    <input
                      type="date"
                      value={product.validity ?? ""}
                      onChange={(event) => updateProduct(index, { validity: event.target.value || null })}
                      className="rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none"
                    />
                  </div>

                  <p className="text-xs text-[var(--color-muted)]">Preço final: {formatCurrency(product.price)}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--color-surface)] p-3">
              <p className="text-sm text-[var(--color-muted)]">{products.length} itens prontos para publicação</p>
              <button
                type="button"
                onClick={publishToMarket}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)]"
              >
                <Sparkles className="h-4 w-4" />
                Publicar no mercado ativo
              </button>
            </div>
          </article>
        </section>
      ) : null}

      {feedback ? (
        <div className="rounded-xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm text-[var(--color-primary-deep)]">
          {feedback}
          {feedback.includes("publicadas") ? (
            <Link href="/painel/ofertas" className="ml-2 inline-flex items-center gap-1 font-semibold text-[var(--color-primary)]">
              Ver Minhas Ofertas
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
