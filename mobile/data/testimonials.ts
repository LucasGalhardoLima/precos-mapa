import type { Testimonial, SocialProofStats } from "@/types";

export const testimonials: Testimonial[] = [
  {
    id: "test_001",
    user_name: "Maria Silva",
    text: "Economizei muito no mes passado so seguindo as ofertas do PrecoMapa! Recomendo para todas as maes.",
    savings_amount: 120,
    sort_order: 0,
  },
  {
    id: "test_002",
    user_name: "Carlos Santos",
    text: "Antes eu ia em 3 mercados diferentes. Agora vejo tudo pelo app e ja sei onde comprar mais barato.",
    savings_amount: 85,
    sort_order: 1,
  },
  {
    id: "test_003",
    user_name: "Ana Costa",
    text: "O melhor app para quem quer economizar no supermercado. As ofertas sao sempre atualizadas!",
    savings_amount: 200,
    sort_order: 2,
  },
];

export const socialProofStats: SocialProofStats = {
  userCount: "+3.200",
  cityName: "Matao",
  avgMonthlySavings: "R$ 47",
};
