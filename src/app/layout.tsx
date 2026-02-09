import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PreçoMapa | Painel Inteligente",
  description:
    "Produto único com RBAC para gestão de ofertas, importador IA de encartes e visão global da plataforma.",
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
