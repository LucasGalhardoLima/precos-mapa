import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PrecoMapa | Inteligencia Regional de Precos",
  description:
    "Plataforma independente de inteligencia de precos do varejo. Indice regional, comparacao de precos e dados abertos para consumidores, lojistas e imprensa.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
