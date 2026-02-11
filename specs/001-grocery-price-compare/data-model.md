# Data Model: Grocery Price Comparison — Consumer App Demo

**Feature**: `001-grocery-price-compare`
**Date**: 2026-02-10

## Entities

### Product

Represents a grocery item that can have promotions across stores.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | yes | Unique identifier (e.g., `prod_001`) |
| name | string | yes | Display name (pt-BR), e.g., "Detergente 500ml" |
| category | CategoryId | yes | Category reference for browsing tabs |
| brand | string | no | Brand name, e.g., "Ype", "Pilao" |
| referencePrice | number | yes | Average/typical price in BRL for "abaixo do normal" calculation |
| imageUrl | string | no | Product image URL (optional for demo) |

### Promotion

A time-bound price offer for a product at a specific store.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | yes | Unique identifier (e.g., `promo_001`) |
| productId | string | yes | References Product.id |
| storeId | string | yes | References Store.id |
| originalPrice | number | yes | Original/list price in BRL |
| promoPrice | number | yes | Promotional price in BRL |
| startDate | string (ISO) | yes | Promotion start date |
| endDate | string (ISO) | yes | Promotion end date |
| status | `"active" \| "expired"` | yes | Current status |
| verified | boolean | yes | Whether the promotion is confirmed/verified |
| source | `"manual" \| "importador_ia" \| "crawler"` | yes | How the promotion was created |

**Computed fields** (derived at render time, not stored):

| Field | Derivation |
|-------|------------|
| discountPercent | `Math.round((1 - promoPrice / originalPrice) * 100)` |
| belowNormalPercent | `Math.round((1 - promoPrice / product.referencePrice) * 100)` |
| gamificationMessage | Based on discountPercent thresholds (see Messages section) |
| isExpiringSoon | `endDate` is within 24 hours |

### Store

A physical supermarket location.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | yes | Unique identifier (e.g., `store_001`) |
| name | string | yes | Store name, e.g., "Carol Supermercado" |
| chain | string | no | Chain/brand name if part of a network |
| address | string | yes | Full address (pt-BR) |
| city | string | yes | City name |
| state | string | yes | State abbreviation (e.g., "SP") |
| latitude | number | yes | Geo-coordinate latitude |
| longitude | number | yes | Geo-coordinate longitude |
| logoInitial | string | yes | Single character for avatar fallback (e.g., "C") |
| logoColor | string | yes | Brand color hex for avatar background |
| plan | `"free" \| "pro" \| "enterprise"` | yes | Subscription tier |
| activeOfferCount | number | yes | Number of currently active promotions |

### Category

Product categories used for browsing tabs.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | yes | Unique identifier (e.g., `cat_bebidas`) |
| name | string | yes | Display name (pt-BR), e.g., "Bebidas" |
| icon | string | yes | Lucide icon name, e.g., "coffee", "sparkles" |
| sortOrder | number | yes | Display order in category tabs |

### Testimonial

User testimonial for the onboarding social proof section.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | yes | Unique identifier |
| userName | string | yes | Display name |
| text | string | yes | Testimonial content (pt-BR) |
| savingsAmount | number | yes | Amount saved in BRL (e.g., 120) |

### SocialProofStats

Platform-level stats for the onboarding screen (singleton).

| Field | Type | Description |
|-------|------|-------------|
| userCount | string | Formatted count, e.g., "+3.200" |
| cityName | string | Target city, e.g., "Matao" |
| avgMonthlySavings | string | Formatted, e.g., "R$ 47" |

## Relationships

```text
Category 1 ←→ N Product
Product   1 ←→ N Promotion
Store     1 ←→ N Promotion
```

- A Product belongs to exactly one Category.
- A Promotion links exactly one Product to exactly one Store.
- A Store can have multiple Promotions across different Products.
- A Product can have Promotions at multiple Stores simultaneously.

## State Transitions

### Promotion Lifecycle

```text
active → expired    (when endDate passes current date)
```

For the demo, all mock promotions are set to `active` with future
end dates. The UI checks `endDate` for the "Acaba hoje" filter.

## Mock Data Categories

| Category ID | Name | Icon | Example Products |
|-------------|------|------|------------------|
| cat_todos | Todos | package | (meta: shows all) |
| cat_bebidas | Bebidas | coffee | Coca-Cola, Suco, Cerveja, Leite |
| cat_limpeza | Limpeza | sparkles | Detergente, Sabao, Desinfetante |
| cat_alimentos | Alimentos | wheat | Arroz, Feijao, Macarrao, Oleo |
| cat_hortifruti | Hortifruti | apple | Banana, Tomate, Batata, Cebola |
| cat_padaria | Padaria | croissant | Pao, Bolo, Biscoito |
| cat_higiene | Higiene | heart | Sabonete, Shampoo, Pasta de dente |

## Mock Data Volume

| Entity | Count | Notes |
|--------|-------|-------|
| Stores | 4 | Carol, Mais Barato, Bom Dia, Santa Fe |
| Categories | 7 | Including "Todos" meta-category |
| Products | ~20 | Spread across 6 real categories |
| Promotions | ~25-30 | Multiple stores per popular product |
| Testimonials | 3 | Maria Silva, Carlos Santos, Ana Costa |

## Gamification Messages

Derived from `discountPercent`:

| Threshold | Message |
|-----------|---------|
| >= 40% | "Voce evitou pagar caro!" (with emoji) |
| >= 25% | "Boa economia!" |
| >= 10% | "Vale a pena conferir" |
| < 10% | (no message shown) |

## Demo Store Coordinates (Matao/SP region)

| Store | Latitude | Longitude |
|-------|----------|-----------|
| Carol Supermercado | -21.6033 | -48.3658 |
| Mais Barato Araraquara | -21.7946 | -48.1756 |
| Bom Dia Ribeirao | -21.1704 | -47.8103 |
| Santa Fe Sao Carlos | -22.0174 | -47.8908 |
