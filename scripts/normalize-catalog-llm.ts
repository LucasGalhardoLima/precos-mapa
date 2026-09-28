/**
 * Catalog normalization, phase C — LLM pass over the fresh-cohort products
 * that no rule assigned (normalized_by IS NULL), via the Message Batches API
 * (claude-haiku-4-5, 50 products per request, strict JSON, closed category list).
 *
 * Two steps, so nothing reaches the database before it has been looked at:
 *
 *   --sample   Draws the audit sample (default: 200 unassigned products for the
 *              LLM + 100 already assigned by savegnago_tree, from the fresh
 *              cohort, reproducible from --seed), runs the 200 through the
 *              batch, validates every answer, and writes a local results file
 *              plus the audit CSV. Reads the DB and calls the API; writes
 *              nothing to the DB.
 *   --ingest <results.json>
 *              Loads a results file into product_normalization_staging (never
 *              into products). --dry-run prints what it would insert.
 *
 * Usage (Node 20+):
 *   npx tsx --env-file=.env.local scripts/normalize-catalog-llm.ts --sample [--llm 200] [--tree 100] [--seed 1]
 *   npx tsx --env-file=.env.local scripts/normalize-catalog-llm.ts --ingest scripts/.scrape-normalize-<run>.json --dry-run
 *   npx tsx --env-file=.env.local scripts/normalize-catalog-llm.ts --ingest scripts/.scrape-normalize-<run>.json
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, and
 * ANTHROPIC_WORKSPACE_ID when the key is organization-level (not workspace-scoped).
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BATCH_SIZE, NORMALIZATION_MODEL, batchCostUsd, buildSystemPrompt, buildUserMessage, responseSchema,
  seededShuffle, validateBatchResponse,
  type Candidate, type Category, type Proposal,
} from "../src/lib/catalog-normalization";
import type { SizeUnit } from "../src/lib/parse-product-size";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};
const flag = (name: string) => process.argv.includes(name);

const POLL_MS = 30_000;
const PAGE = 1000;

interface FreshProduct {
  id: string;
  name: string;
  ean: string | null;
  size_value: number | null;
  size_unit: SizeUnit | null;
  category_l2: string | null;
  brand_norm: string | null;
  base_name: string | null;
  normalized_by: string | null;
  markets: string[];
}

interface SampleRow {
  origin: "savegnago_tree" | "llm";
  product: FreshProduct;
  /** LLM rows only. */
  proposal: Proposal | null;
}

interface ResultsFile {
  run_id: string;
  seed: number;
  model: string;
  batch_id: string;
  usage: { input_tokens: number; output_tokens: number };
  cost_usd: number;
  failed_requests: number;
  rows: SampleRow[];
}

async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("product_categories")
    .select("id, name, description, categories(name)")
    .order("department_id")
    .order("sort_order");
  if (error) throw new Error(`product_categories: ${error.message}`);
  return (data ?? []).map((r) => {
    const dep = r.categories as unknown as { name: string } | { name: string }[] | null;
    return { id: r.id, name: r.name, description: r.description, department: (Array.isArray(dep) ? dep[0]?.name : dep?.name) ?? "" };
  });
}

async function fetchFreshProducts(): Promise<FreshProduct[]> {
  const rows: FreshProduct[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.rpc("normalization_fresh_products").range(from, from + PAGE - 1);
    if (error) throw new Error(`normalization_fresh_products: ${error.message}`);
    rows.push(...(data as FreshProduct[]));
    if (data.length < PAGE) break;
  }
  return rows;
}

const toCandidate = (p: FreshProduct): Candidate => ({
  id: p.id, name: p.name, ean: p.ean, sizeValue: p.size_value, sizeUnit: p.size_unit, markets: p.markets,
});

async function runBatch(candidates: Candidate[], categories: Category[]) {
  // An organization-level key (not scoped to a workspace) must say which workspace the
  // request belongs to; that is also what makes the workspace's spend limit apply.
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
  const client = new Anthropic(workspaceId ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } } : {});
  const system = buildSystemPrompt(categories);
  const schema = responseSchema(categories);
  const slugs = new Set(categories.map((c) => c.id));

  const groups: Candidate[][] = [];
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) groups.push(candidates.slice(i, i + BATCH_SIZE));

  const batch = await client.messages.batches.create({
    requests: groups.map((group, n) => ({
      custom_id: `b${n}`,
      params: {
        model: NORMALIZATION_MODEL,
        max_tokens: 8000,
        temperature: 0,
        system,
        output_config: { format: { type: "json_schema", schema } },
        messages: [{ role: "user", content: buildUserMessage(group) }],
      },
    })),
  });
  console.log(`Batch ${batch.id} submitted: ${groups.length} requests, ${candidates.length} products.`);

  // shortcut: one process submits and polls until the batch ends (Batches finish
  // within 24h, usually well under 1h; a killed process loses the wait, not the
  // batch — it can still be read by id). upgrade: split submit/collect into two
  // workflow steps if the daily job's wait ever nears the Actions timeout.
  let status = batch;
  while (status.processing_status !== "ended") {
    await new Promise((r) => setTimeout(r, POLL_MS));
    status = await client.messages.batches.retrieve(batch.id);
    console.log(`  ${status.processing_status}: ${JSON.stringify(status.request_counts)}`);
  }

  // shortcut: a failed/expired batch request is not retried — its products get
  // invalid_reason "batch_request_failed" and stay unassigned until the next run.
  // upgrade: resubmit failed custom_ids once before giving up (matters for the daily job).
  const proposals: Proposal[][] = groups.map((g) =>
    g.map(() => ({ category_l2: null, brand_norm: null, base_name: null, size_value: null, size_unit: null, confidence: null, invalid_reason: "batch_request_failed" })),
  );
  const usage = { input_tokens: 0, output_tokens: 0 };
  let failed = 0;
  for await (const entry of await client.messages.batches.results(batch.id)) {
    const n = Number(entry.custom_id.slice(1));
    if (entry.result.type !== "succeeded") {
      failed++;
      console.warn(`  [${entry.custom_id}] ${entry.result.type}`);
      continue;
    }
    const message = entry.result.message;
    usage.input_tokens += message.usage.input_tokens;
    usage.output_tokens += message.usage.output_tokens;
    const text = message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    proposals[n] = message.stop_reason === "end_turn" ? validateBatchResponse(text, groups[n], slugs)
      : groups[n].map(() => ({ category_l2: null, brand_norm: null, base_name: null, size_value: null, size_unit: null, confidence: null, invalid_reason: `stop_reason_${message.stop_reason}` }));
  }
  return { batchId: batch.id, proposals: proposals.flat(), usage, failed };
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function writeAuditCsv(file: string, rows: SampleRow[], categories: Category[], seed: number) {
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const header = [
    "origem", "produto_id", "ean", "nome_original", "mercados", "categoria_proposta", "categoria_nome",
    "marca", "nome_base", "tamanho_proposto", "tamanho_origem", "confianca", "motivo_invalido", "categoria_ok", "tamanho_ok",
  ];
  const lines = seededShuffle(rows, seed).map((r) => {
    const p = r.product;
    const proposal = r.proposal;
    const category = r.origin === "llm" ? proposal!.category_l2 : p.category_l2;
    // Size comes from the parser when the product already had one; otherwise from the LLM.
    const size = p.size_unit
      ? { text: `${p.size_value} ${p.size_unit}`, source: "parser" }
      : proposal?.size_unit ? { text: `${proposal.size_value} ${proposal.size_unit}`, source: "llm" } : { text: "", source: "nenhum" };
    return [
      r.origin, p.id, p.ean, p.name, p.markets.join("; "), category, category ? names.get(category) : "",
      r.origin === "llm" ? proposal!.brand_norm : "", r.origin === "llm" ? proposal!.base_name : "",
      size.text, size.source, r.origin === "llm" ? proposal!.confidence : "", r.origin === "llm" ? proposal!.invalid_reason : "", "", "",
    ].map(csvCell).join(",");
  });
  writeFileSync(file, [header.join(","), ...lines].join("\n") + "\n");
}

async function sample() {
  const llmN = Number(arg("--llm") ?? 200);
  const treeN = Number(arg("--tree") ?? 100);
  const seed = Number(arg("--seed") ?? Math.floor(Math.random() * 1e6));
  const runId = `sample-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}-s${seed}`;

  const [categories, fresh] = await Promise.all([fetchCategories(), fetchFreshProducts()]);
  const unassigned = fresh.filter((p) => p.normalized_by === null);
  const tree = fresh.filter((p) => p.normalized_by === "savegnago_tree");
  console.log(`Fresh cohort: ${fresh.length} · unassigned ${unassigned.length} · savegnago_tree ${tree.length} · ${categories.length} categories · seed ${seed}`);

  const llmProducts = seededShuffle(unassigned, seed).slice(0, llmN);
  const treeProducts = seededShuffle(tree, seed + 1).slice(0, treeN);

  const { batchId, proposals, usage, failed } = await runBatch(llmProducts.map(toCandidate), categories);
  const rows: SampleRow[] = [
    ...llmProducts.map((product, i): SampleRow => ({ origin: "llm", product, proposal: proposals[i] })),
    ...treeProducts.map((product): SampleRow => ({ origin: "savegnago_tree", product, proposal: null })),
  ];

  const results: ResultsFile = {
    run_id: runId, seed, model: NORMALIZATION_MODEL, batch_id: batchId, usage, cost_usd: batchCostUsd(usage), failed_requests: failed, rows,
  };
  const jsonFile = resolve(process.cwd(), `scripts/.scrape-normalize-${runId}.json`);
  const csvFile = resolve(process.cwd(), "docs/poup-normalizacao-auditoria-amostra.csv");
  writeFileSync(jsonFile, JSON.stringify(results));
  writeAuditCsv(csvFile, rows, categories, seed);

  const llmRows = rows.filter((r) => r.origin === "llm").map((r) => r.proposal!);
  console.log("\nResults file:", jsonFile, "\nAudit CSV:   ", csvFile);
  console.log(`Usage: ${usage.input_tokens} in / ${usage.output_tokens} out tokens · cost US$ ${results.cost_usd.toFixed(4)} · failed requests ${failed}`);
  console.log(`LLM rows: ${llmRows.length} · category set ${llmRows.filter((p) => p.category_l2).length} · size set ${llmRows.filter((p) => p.size_unit).length} · with invalid_reason ${llmRows.filter((p) => p.invalid_reason).length}`);
}

async function ingest(file: string) {
  const results: ResultsFile = JSON.parse(readFileSync(file, "utf8"));
  const rows = results.rows.filter((r) => r.origin === "llm").map((r) => ({
    run_id: results.run_id, product_id: r.product.id, model: results.model, batch_id: results.batch_id,
    category_l2: r.proposal!.category_l2, brand_norm: r.proposal!.brand_norm, base_name: r.proposal!.base_name,
    size_value: r.proposal!.size_value, size_unit: r.proposal!.size_unit, confidence: r.proposal!.confidence,
    invalid_reason: r.proposal!.invalid_reason,
  }));
  console.log(`${flag("--dry-run") ? "DRY RUN — would upsert" : "Upserting"} ${rows.length} rows into product_normalization_staging (run ${results.run_id}).`);
  if (flag("--dry-run")) return;
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from("product_normalization_staging").upsert(rows.slice(i, i + 500), { onConflict: "run_id,product_id" });
    if (error) throw new Error(`staging upsert: ${error.message}`);
  }
  console.log("Done. products was not touched.");
}

async function main() {
  const ingestFile = arg("--ingest");
  if (flag("--sample")) await sample();
  else if (ingestFile) await ingest(ingestFile);
  else {
    console.error("Usage: --sample [--llm N] [--tree N] [--seed N]  |  --ingest <results.json> [--dry-run]");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
