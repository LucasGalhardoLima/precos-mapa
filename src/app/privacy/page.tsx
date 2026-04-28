import type { Metadata } from "next";
import { Shield } from "lucide-react";

const PRIVACY_SECTIONS = [
  {
    title: "1. Dados Coletados",
    body: "Coletamos seu nome, e-mail, localização aproximada (quando autorizada), produtos favoritos, alertas de preço e histórico de buscas. Dados de pagamento são processados diretamente pela Apple/Google (consumidores) ou Stripe (lojistas), sem armazenamento em nossos servidores.",
  },
  {
    title: "2. Finalidade do Tratamento",
    body: "Seus dados são utilizados para: exibir ofertas próximas a você, enviar alertas de preço, otimizar listas de compras, personalizar sua experiência e gerar estatísticas anônimas para lojistas.",
  },
  {
    title: "3. Base Legal",
    body: "O tratamento dos seus dados é baseado no consentimento (LGPD Art. 7, I) para funcionalidades opcionais e na execução do contrato (LGPD Art. 7, V) para funcionalidades essenciais do serviço.",
  },
  {
    title: "4. Compartilhamento de Dados",
    body: "Seus dados pessoais não são vendidos a terceiros. Compartilhamos dados anônimos e agregados com lojistas parceiros para fins estatísticos. Utilizamos serviços de infraestrutura (Supabase, RevenueCat) que processam dados conforme suas próprias políticas de privacidade.",
  },
  {
    title: "5. Retenção de Dados",
    body: "Dados de conta são mantidos enquanto sua conta estiver ativa. Históricos de preço são retidos por até 90 dias. Após exclusão da conta, seus dados pessoais são removidos em até 30 dias.",
  },
  {
    title: "6. Direitos do Titular",
    body: "Você pode: acessar seus dados, solicitar correção, solicitar exclusão da conta, exportar seus dados em formato JSON e revogar consentimento a qualquer momento. Todas essas ações estão disponíveis na tela de Configurações do aplicativo.",
  },
  {
    title: "7. Medidas de Segurança",
    body: "Utilizamos criptografia em trânsito (TLS/SSL), autenticação segura via Google/Apple Sign-In e controle de acesso por Row Level Security (RLS) no banco de dados. Seus dados são armazenados em servidores com certificação SOC 2.",
  },
  {
    title: "8. Contato do DPO",
    body: "Para dúvidas sobre privacidade, entre em contato com nosso Encarregado de Dados (DPO) pelo e-mail: privacidade@poup.com.br",
  },
];

export const metadata: Metadata = {
  title: "Política de Privacidade | Poup",
  description: "Política de privacidade oficial da Poup para App Store e Play Store.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-5 py-12 sm:px-6 sm:py-16">
      <header className="mb-8 rounded-3xl border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary-deep)]">
          <Shield className="h-5 w-5" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">
          Política de Privacidade
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
          Este documento descreve como a Poup coleta, utiliza e protege dados pessoais de usuários.
        </p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">
          Última atualização: 12 de fevereiro de 2026
        </p>
      </header>

      <section className="rounded-3xl border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <div className="space-y-6">
          {PRIVACY_SECTIONS.map((section) => (
            <article key={section.title}>
              <h2 className="text-base font-semibold text-[var(--color-ink)]">{section.title}</h2>
              <p className="mt-2 text-sm leading-7 text-[var(--color-muted)]">{section.body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
