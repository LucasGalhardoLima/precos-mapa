import { SectionHeader } from "@/features/panel/components/section-header";
import { ImporterWorkbench } from "@/features/market-importer/importer-workbench";

export default function ImportadorIaPage() {
  return (
    <div className="space-y-5">
      <SectionHeader
        title="Importador IA"
        subtitle="Pipeline de extração com URL/PDF, revisão humana e publicação simulada nas ofertas do mercado ativo."
      />
      <ImporterWorkbench />
    </div>
  );
}
