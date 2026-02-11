import { testimonials, socialProofStats } from "@/data/testimonials";

export function useSocialProof() {
  return {
    stats: socialProofStats,
    testimonials,
  };
}
