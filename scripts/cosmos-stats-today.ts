import { createClient } from '@supabase/supabase-js';

async function main() {
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const startOfDay = new Date();
startOfDay.setHours(0, 0, 0, 0);
const iso = startOfDay.toISOString();

const [
  { count: createdToday },
  { count: updatedToday },
  { count: createdWithPrice },
  { count: updatedWithPriceToday },
  { count: totalProducts },
  { count: totalWithPrice },
  { count: pdfImportsToday },
  { count: pdfImportsCompleted },
  { count: storePricesCreatedToday },
  { count: storePricesUpdatedToday },
  { data: pdfImports },
] = await Promise.all([
  supabase.from('products').select('*', { count: 'exact', head: true }).gte('created_at', iso),
  supabase.from('products').select('*', { count: 'exact', head: true }).gte('updated_at', iso),
  supabase.from('products').select('*', { count: 'exact', head: true }).gte('created_at', iso).not('reference_price', 'is', null),
  supabase.from('products').select('*', { count: 'exact', head: true }).gte('updated_at', iso).not('reference_price', 'is', null),
  supabase.from('products').select('*', { count: 'exact', head: true }),
  supabase.from('products').select('*', { count: 'exact', head: true }).not('reference_price', 'is', null),
  supabase.from('pdf_imports').select('*', { count: 'exact', head: true }).gte('created_at', iso),
  supabase.from('pdf_imports').select('*', { count: 'exact', head: true }).gte('created_at', iso).eq('status', 'completed'),
  supabase.from('store_prices').select('*', { count: 'exact', head: true }).gte('created_at', iso),
  supabase.from('store_prices').select('*', { count: 'exact', head: true }).gte('updated_at', iso),
  supabase.from('pdf_imports').select('id, filename, status, ofertas_count, processed_at, store_id').gte('created_at', iso).order('created_at', { ascending: false }),
]);

const distinctProductsTodayQuery = await supabase
  .from('store_prices')
  .select('product_id')
  .gte('updated_at', iso);
const distinctProducts = new Set((distinctProductsTodayQuery.data ?? []).map((r) => r.product_id));

console.log(`Today (since ${iso}):`);
console.log(`  Products created:        ${createdToday}`);
console.log(`  Products updated:        ${updatedToday}`);
console.log(`  Products w/ price (new): ${createdWithPrice}`);
console.log(`  Products w/ price (upd): ${updatedWithPriceToday}`);
console.log();
console.log(`PDF imports today:`);
console.log(`  Total:                   ${pdfImportsToday}`);
console.log(`  Completed:               ${pdfImportsCompleted}`);
console.log(`  store_prices created:    ${storePricesCreatedToday}`);
console.log(`  store_prices touched:    ${storePricesUpdatedToday}`);
console.log(`  Distinct products:       ${distinctProducts.size}`);
console.log();
console.log(`Per-import breakdown:`);
for (const imp of pdfImports ?? []) {
  console.log(`  [${imp.status}] ${imp.filename} — ${imp.ofertas_count ?? 0} ofertas (store=${imp.store_id?.slice(0, 8)})`);
}
console.log();
console.log(`Catalog totals:`);
console.log(`  Products:                ${totalProducts}`);
console.log(`  Products w/ price:       ${totalWithPrice}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
