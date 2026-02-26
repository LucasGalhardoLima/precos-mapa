export const DEMO_USER_LOCATION = {
  latitude: -21.6033,
  longitude: -48.3658,
} as const;

export function getGamificationMessage(discountPercent: number): string | null {
  if (discountPercent >= 40) return "🔥 Voce evitou pagar caro!";
  if (discountPercent >= 25) return "💰 Boa economia!";
  if (discountPercent >= 10) return "👍 Vale a pena conferir";
  return null;
}
