export interface MobileOffer {
  id: string;
  name: string;
  market: string;
  marketDistanceKm: number;
  price: number;
  previousPrice: number;
  validUntil: string;
  category: string;
  isFavorite?: boolean;
}

export interface MobileMarket {
  id: string;
  name: string;
  distanceKm: number;
  city: string;
  pinTop: number;
  pinLeft: number;
}

export interface MobileAlert {
  id: string;
  title: string;
  category: string;
  maxPrice: number;
  enabled: boolean;
}

export const mobileOffers: MobileOffer[] = [
  {
    id: "mof-1",
    name: "Detergente 500ml",
    market: "Carol Supermercado",
    marketDistanceKm: 1.2,
    price: 1.99,
    previousPrice: 3.5,
    validUntil: "2026-02-28",
    category: "Limpeza",
    isFavorite: true,
  },
  {
    id: "mof-2",
    name: "Arroz Tio João 5kg",
    market: "Mais Barato Araraquara",
    marketDistanceKm: 3.8,
    price: 24.99,
    previousPrice: 29.9,
    validUntil: "2026-02-21",
    category: "Mercearia",
  },
  {
    id: "mof-3",
    name: "Leite Integral 1L",
    market: "Carol Supermercado",
    marketDistanceKm: 1.2,
    price: 4.29,
    previousPrice: 5.19,
    validUntil: "2026-02-18",
    category: "Laticínios",
    isFavorite: true,
  },
  {
    id: "mof-4",
    name: "Banana Prata kg",
    market: "Mais Barato Araraquara",
    marketDistanceKm: 3.8,
    price: 3.49,
    previousPrice: 5.99,
    validUntil: "2026-02-20",
    category: "Hortifruti",
  },
];

export const mobileMarkets: MobileMarket[] = [
  {
    id: "mmk-1",
    name: "Carol Supermercado",
    distanceKm: 1.2,
    city: "Matão/SP",
    pinTop: 28,
    pinLeft: 34,
  },
  {
    id: "mmk-2",
    name: "Mais Barato",
    distanceKm: 3.8,
    city: "Matão/SP",
    pinTop: 54,
    pinLeft: 61,
  },
  {
    id: "mmk-3",
    name: "Bom Dia",
    distanceKm: 5.5,
    city: "Matão/SP",
    pinTop: 66,
    pinLeft: 24,
  },
];

export const mobileAlerts: MobileAlert[] = [
  {
    id: "alt-1",
    title: "Arroz até R$ 25,99",
    category: "Mercearia",
    maxPrice: 25.99,
    enabled: true,
  },
  {
    id: "alt-2",
    title: "Leite até R$ 4,49",
    category: "Laticínios",
    maxPrice: 4.49,
    enabled: true,
  },
  {
    id: "alt-3",
    title: "Detergente até R$ 2,20",
    category: "Limpeza",
    maxPrice: 2.2,
    enabled: false,
  },
];
