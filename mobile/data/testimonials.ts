import type { Testimonial, SocialProofStats } from "@/types";

export const testimonials: Testimonial[] = [
  {
    id: "test_001",
    userName: "Maria Silva",
    text: "Economizei muito no mes passado so seguindo as ofertas do PrecoMapa! Recomendo para todas as maes.",
    savingsAmount: 120,
  },
  {
    id: "test_002",
    userName: "Carlos Santos",
    text: "Antes eu ia em 3 mercados diferentes. Agora vejo tudo pelo app e ja sei onde comprar mais barato.",
    savingsAmount: 85,
  },
  {
    id: "test_003",
    userName: "Ana Costa",
    text: "O melhor app para quem quer economizar no supermercado. As ofertas sao sempre atualizadas!",
    savingsAmount: 200,
  },
];

export const socialProofStats: SocialProofStats = {
  userCount: "+3.200",
  cityName: "Matao",
  avgMonthlySavings: "R$ 47",
};
