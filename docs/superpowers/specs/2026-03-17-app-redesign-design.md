# Poup App Redesign — Design Spec

## Overview

A comprehensive UI redesign of the Poup consumer mobile app (Expo/React Native), covering all five main screens, the tab bar, header, and branding strategy. The redesign focuses on surfacing Poup's core value proposition — cheapest grocery prices — at every touchpoint.

## Brand & Logo Strategy

### In-App Header
- **No logo in the header.** The teal gradient + personalized greeting IS the brand.
- Header layout: greeting text (left) + avatar (right).
- Greeting format: "Boa tarde, Lucas" + subtitle "Veja as melhores ofertas perto de você".
- Avatar: circular, user initial, `rgba(255,255,255,0.2)` background, `2px solid rgba(255,255,255,0.3)` border. Tappable — navigates to Account screen.

### Logo Usage
- **App icon** (App Store / Play Store): full 3D P$UP logo with cart, coin, sparkles on teal background.
- **Splash screen**: full 3D logo centered.
- **In-app**: no logo. The gradient header is the brand presence.

### Logo Assets (preserved for future use)
- 3D coin extracted as transparent PNG: `Downloads/poup-coin-3d-full.png`.
- P(coin)UP wordmark with overlapping coin: mocked in brainstorm session, CSS/SVG implementation available.

## Navigation

### Tab Bar
- **5 tabs**: Início, Busca, Mapa, Lista, Alertas.
- **Icons** (all lucide-react-native): Home, Search, Map, ListChecks, Bell.
- **Alertas badge**: red dot indicator when unread alerts exist (no count).
- **Account**: removed from tab bar. Accessed via header avatar.
- Floating tab bar with active indicator (existing component, updated tab config).

### Account Access
- Tap avatar in header → navigates to Account screen.
- Account screen layout: keep existing design as-is.
- Add back navigation (back arrow or swipe gesture).

## Header

### Gradient
- `linear-gradient(180deg, #115E59 0%, #0D9488 50%, #14B8A6 100%)`.
- Padding: `16px 20px 22px`.

### Layout
```
[Greeting text]                    [Avatar]
  "Boa tarde, Lucas"                  L
  "Veja as melhores ofertas..."
```

### Greeting Logic
- Time-based: "Bom dia" (5–12h), "Boa tarde" (12–18h), "Boa noite" (18–5h).
- User's first name from profile.
- Subtitle: "Veja as melhores ofertas perto de você".

## Screens

### 1. Início (Home)

Designed in previous session. Key sections top-to-bottom:

1. **Header** (gradient + greeting + avatar).
2. **Ranking em Destaque**: top 3 cheapest stores for "lista base" (15 essential items). Cards with medal emoji, store initial avatar, store name, total price. First place gets "Mais barato" amber badge. Gold border on 1st place card.
3. **Category pills**: horizontal scroll. "Todos" (active, teal filled) + dynamic categories (white, outlined).
4. **Ofertas perto de você**: horizontal scroll deal cards. Each card shows product, price, store. Badges: "Menor preço" (green), "-X%" (yellow), "Menor em 30d" (purple).
5. **Mercados perto de você**: store cards with colored initial avatars (no emojis, no real logos). Tags: distance, deal count, open/closed status.

### 2. Alertas

New screen, replaces Account in the tab bar.

#### Empty State
- Bell icon in teal circle (80px).
- Title: "Receba quando o preço cair".
- Subtitle: explains the feature.
- CTA: "Criar primeiro alerta" (teal button, 12px border-radius).
- Below: "Sugestões perto de você" — 3 suggested products based on location. Each with emoji icon, product name, contextual subtitle, "Criar alerta" button (outlined teal, `white-space: nowrap`).

#### Populated State
- Header: "Alertas" title + "+" button (teal, 32px square, rounded 8px).
- **Novidades section**: red dot + "Novidades" label + count badge (red). Triggered alert cards with:
  - Green left border (4px solid #16A34A).
  - Product emoji icon (40px, colored background).
  - Product name, "R$ X,XX no [Store]" in green, badge + timestamp + distance.
  - Badges: "-X%" (green), "Menor em 30d" (purple).
- **Monitorando section**: "Monitorando" label + count badge (gray). Active alert cards:
  - No colored border.
  - Product emoji, name, "Último preço: R$ X,XX · sem variação".
  - Gray dot indicator on the right.
- **Upsell card** (for free tier): dashed teal border, gradient background. "Você está usando X de Y alertas" + "Assine o Poup Plus para alertas ilimitados" + "Ver planos" button.

### 3. Lista (Shopping List)

Store-optimized shopping list — the core differentiator.

#### Empty State
- Pencil/edit icon in teal circle.
- Title: "Monte sua lista de compras".
- Subtitle: "Adicione itens e descubra onde comprar tudo pelo menor preço."
- CTA: "Adicionar itens".
- **Template lists**: horizontal scroll cards. "Cesta Básica" (15 itens), "Churrasco" (12 itens), "Café da Manhã" (8 itens). Each with emoji, name, item count. Outlined border, tappable.

#### Populated State
- Header: "Minha Lista" + item count + "+" button.
- **Optimization summary** (top):
  - **Single store option**: store avatar + "Tudo no [Store]" + distance + item availability + total price. White card, standard border.
  - **Split store option**: overlapping store avatars + "Dividir em X lojas" + store names + total price (green) + savings amount. Green border (2px solid #16A34A) + "Melhor opção" badge (green, positioned absolute top-left). Always show both options — user decides the tradeoff.
- **Item list**:
  - Unchecked items: checkbox (22px, rounded 6px, gray border) + product name + "R$ X,XX · [Store]" (store name color-coded) + price on right.
  - Checked items: teal filled checkbox with white checkmark + strikethrough name + faded (opacity 0.5).

#### Item Entry Methods
- Text input with autocomplete from product database.
- "Adicionar à lista" (+) buttons on search results, deal cards, alert items.
- Template lists for cold-start.

### 4. Mapa (Store Map)

Color-coded price map.

#### Default View
- Full-screen map with store pins.
- **Pin colors by ranking**: green (#16A34A) = cheapest, yellow (#F59E0B) = mid, red (#EF4444) = expensive.
- Top 3 pins show medal emoji (🥇🥈🥉) + store initials.
- Other pins show store initials only.
- **Legend** (top-left): "Ranking de preço" — Barato (green dot), Médio (yellow), Caro (red). White card with shadow.
- **Filter pill** (top-right): "Minha lista" toggle. When active, pin colors reflect prices for the user's specific shopping list.
- **User location**: blue dot with white border and blue glow.

#### Store Tapped (Bottom Sheet)
- Pin expands to show full store name with white border, stronger shadow.
- Map dims slightly (opacity 0.6).
- Bottom sheet slides up with:
  - Drag handle (36px, gray, rounded).
  - **Store header**: large initial avatar (44px) + store name + distance + ranking badge + "Ir ao mapa" button (opens native maps navigation).
  - **Lista total** (if user has a list): teal background strip showing item count, availability, total price at this store, ranking note.
  - **Destaques nesta loja**: horizontal scroll of top deal cards with product name, price, badge.

### 5. Busca (Search)

Discovery-first search with price range results.

#### Discovery View (default, search bar not focused)
- **Search bar**: white, rounded 12px, gray border, search icon + placeholder "Buscar produto ou marca...".
- **Buscas recentes**: pills with clock icon + query text. "Limpar" link on the right.
- **Categorias**: 4x2 grid of category cards. Each with emoji (24px) + category name (11px). White cards with subtle shadow.
  - Categories: Laticínios, Carnes, Hortifrúti, Padaria, Limpeza, Higiene, Bebidas, Pet.
- **Em alta perto de você**: numbered trending list (1, 2, 3 in teal). Each row: rank number + product name + price range + store count. Badge on right when applicable.

#### Search Results (query entered)
- **Search bar**: teal border (focused state), teal search icon, query text, clear (X) button.
- **Result count**: "X resultados perto de você".
- **Result cards**: white, rounded 12px, subtle shadow. Layout:
  - Left: product emoji icon (48px, colored background rounded 10px).
  - Center: product name (15px, bold) → price range "R$ X,XX – R$ X,XX" (lowest in green bold, highest in gray) → store count + badge (e.g., "5 lojas `-12%`").
  - Right: "+" button (32px square, teal outlined, rounded 8px) — adds product to shopping list.
- **Badges**: inline with store count on the third row. Green for discounts, purple for historical lows.

### 6. Conta (Account)

Keep existing design. Changes:
- No longer a tab — accessed via avatar tap from any screen.
- Add back navigation (back arrow in top-left or swipe-back gesture).
- No visual redesign needed.

## Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Primary | #0D9488 | Buttons, active states, links |
| Primary Dark | #115E59 | Header gradient start |
| Primary Medium | #0D9488 | Header gradient mid |
| Primary Light | #14B8A6 | Header gradient end |
| Background | #F0FDFA | Screen backgrounds |
| Background Light | #CCFBF1 | Icon circles, highlights |
| Accent | #F59E0B | Amber badges, warnings |
| Success | #16A34A | Price drops, cheapest store, savings |
| Alert/Error | #EF4444 | Expensive stores, unread dot |
| Purple | #7C3AED | "Menor em 30d" badge |
| Text Primary | #134E4A | Headings, dark text |
| Text Secondary | #6B7280 | Subtitles, metadata |
| Text Muted | #9CA3AF | Timestamps, disabled |
| Border | #E5E7EB | Card borders, dividers |
| Card Background | #FFFFFF | Cards, inputs |

## Typography

- **Screen titles**: 22px, weight 700, #134E4A.
- **Section headers**: 15-16px, weight 700, #134E4A.
- **Card titles**: 14-15px, weight 600, #134E4A.
- **Prices (best)**: 14-16px, weight 700, #16A34A.
- **Prices (range max)**: 13px, weight 400, #6B7280.
- **Metadata**: 12px, weight 400, #6B7280.
- **Badges**: 10-11px, weight 600, colored background + colored text.
- **Buttons**: 13-15px, weight 600.

## Spacing & Sizing

- Screen horizontal padding: 20px.
- Card padding: 12-14px.
- Card border-radius: 10-12px.
- Card gap: 6-8px (lists), 10px (grids).
- Icon containers: 40-48px, border-radius 8-10px.
- Avatar (header): 38-40px, circular.
- Buttons: padding 8-14px horizontal, border-radius 8-12px.
- Tab bar: floating, existing component dimensions.

## Mockup References

All HTML mockups preserved in `.superpowers/brainstorm/27216-1773737598/`:
- `01-home-header.html`, `01-home-header-v2.html` — header iterations.
- `06-wordmark-options.html` through `12-wordmark-overlap.html` — wordmark explorations.
- `13-header-no-logo.html` — final header (no logo).
- `14-alertas-screen.html` — alertas screen (empty + populated).
- `15-lista-screen.html` — lista screen (empty + populated).
- `16-mapa-screen.html` — mapa screen (default + tapped).
- `17-busca-screen.html` — busca screen (discovery + results).
- `poup-home-v2.html` (project root) — full home screen "Proposta Alinhada".
