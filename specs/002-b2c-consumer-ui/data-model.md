# Data Model: POUP B2C Consumer UI

**Branch**: `002-b2c-consumer-ui` | **Date**: 2026-03-02

## Overview

This feature is primarily a UI layer redesign. The existing Supabase schema (profiles, stores, products, promotions, categories, favorites, price_alerts, shopping_lists, shopping_list_items, reference_prices, price_snapshots) is reused without modification. This document defines the **client-side data entities** consumed by the new UI components.

## Existing Entities (No Changes)

These entities already exist in Supabase and are consumed via existing hooks:

| Entity | Table | Used By |
|--------|-------|---------|
| Profile | `profiles` | Auth store, Account screen |
| Store | `stores` | Search results, Map markers, Ranking |
| Product | `products` | Deal cards, Search, Detail screen |
| Promotion | `promotions` | Deal cards, Search results, Price comparison |
| Category | `categories` | Filter chips, Product detail |
| Favorite | `favorites` | Account preferences |
| Price Alert | `price_alerts` | Product detail, Account preferences |
| Shopping List | `shopping_lists` | List screen, Economy summary |
| Shopping List Item | `shopping_list_items` | List screen, Map grouping |
| Reference Price | `reference_prices` | Economy summary calculation |
| Price Snapshot | `price_snapshots` | Price history chart |

## New Client-Side Entities

### ThemePreference (local only — AsyncStorage)

Persisted locally on device, not synced to Supabase.

| Field | Type | Description |
|-------|------|-------------|
| palette | `'encarte' \| 'fintech'` | Active visual palette |

**Default**: `'encarte'`
**Persistence**: Zustand `persist` middleware with AsyncStorage adapter
**No server sync**: Theme is a device-level preference, not a user account setting

### PaletteTokens (runtime — in-memory)

Computed from the active palette. Not persisted.

| Field | Type | Description |
|-------|------|-------------|
| name | `'encarte' \| 'fintech'` | Palette identifier |
| bg | `string` | Background color hex |
| surface | `string` | Card/surface color hex |
| textPrimary | `string` | Primary text color hex |
| textSecondary | `string` | Secondary text color hex |
| textHint | `string` | Hint/metadata text color hex |
| primary | `string` | Primary brand color hex |
| primaryLight | `string` | Light primary variant hex |
| header | `string` | Header background color hex |
| headerText | `string` | Header text color hex |
| border | `string` | Border/rule color hex |
| discountRed | `string` | Discount badge color hex |
| discountRedActive | `string` | Active discount CTA hex |
| discountRedSoft | `string` | Discount background hex |
| gold | `string` | Achievement/Plus color hex |
| goldBright | `string` | Large achievement badge hex |
| goldLight | `string` | Plus section background hex |
| dark | `string` | Economy card/header dark hex |
| darkSurface | `string` | Dark card surface hex |
| mist | `string` | Data context tint hex |

### EconomySummary (computed — per render)

Aggregated from existing entities. Not persisted.

| Field | Type | Description |
|-------|------|-------------|
| totalSavings | `number` | Potential savings in BRL |
| cheapestStore | `{ id: string; name: string }` | Best store reference |
| mode | `'list' \| 'deals'` | Calculation mode used |
| itemCount | `number` | Number of items (list mode) or deals (deals mode) |

### StoreRanking (computed — per render)

| Field | Type | Description |
|-------|------|-------------|
| stores | `StoreRankEntry[]` | Top 3 stores |
| city | `string` | City label for display |
| basketLabel | `string` | "lista base" or similar |

#### StoreRankEntry

| Field | Type | Description |
|-------|------|-------------|
| id | `string` | Store ID |
| name | `string` | Store name |
| totalPrice | `number` | Total basket price at this store |
| savingsPercent | `number` | Savings vs highest-priced store |
| rank | `1 \| 2 \| 3` | Position in ranking |

### SearchResult (computed — per search)

Enriched from promotions query. Not persisted.

| Field | Type | Description |
|-------|------|-------------|
| store | `{ id: string; name: string; distance: number; isOpen: boolean }` | Store info |
| promoPrice | `number` | Current promotional price |
| originalPrice | `number` | Original/reference price |
| discountPercent | `number` | Discount percentage |
| isBestPrice | `boolean` | Whether this is the cheapest store |
| isLocked | `boolean` | Whether this result is Plus-gated (4th+ for free users) |

### MapStoreGroup (computed — per render)

Derived from shopping list + store data for map display.

| Field | Type | Description |
|-------|------|-------------|
| store | `{ id: string; name: string; lat: number; lng: number }` | Store location |
| items | `{ productName: string; price: number }[]` | List items available at this store |
| subtotal | `number` | Total price for items at this store |
| isCheapest | `boolean` | Whether this store has the lowest subtotal |

## Entity Relationships (Client-Side)

```text
ThemePreference ──[drives]──► PaletteTokens ──[consumed by]──► All Components

ShoppingList ──[items]──► ShoppingListItem ──[product]──► Product
                                                              │
EconomySummary ◄──[computed from]── ShoppingListItem + Promotions + ReferencePrice
                                                              │
StoreRanking ◄──[computed from]── Stores + Promotions ────────┘
                                                              │
SearchResult ◄──[computed from]── Promotions + Stores ────────┘
                                                              │
MapStoreGroup ◄──[computed from]── ShoppingListItem + Stores + Promotions
```

## State Transitions

### Theme Palette

```text
encarte ──[togglePalette()]──► fintech
fintech ──[togglePalette()]──► encarte
```
Immediate, no loading state. All components re-render with new tokens.

### Search Results (Plus Gating)

```text
Results loaded → For free users:
  - Results 1-3: visible (isLocked: false)
  - Results 4+:  locked (isLocked: true)

User subscribes to Plus → All results: visible (isLocked: false)
```

### Shopping List Item

```text
pending ──[tap checkmark]──► checked (strikethrough/dimmed)
checked ──[tap checkmark]──► pending (restored)
any ────[swipe/delete]─────► removed
```
