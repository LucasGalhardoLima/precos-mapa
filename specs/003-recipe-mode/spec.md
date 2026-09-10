# Feature Specification: Modo Receita

**Feature Branch**: `003-recipe-mode`  
**Created**: 2026-05-15  
**Status**: Draft  
**Input**: Recipe-based shopping optimization ("Modo Receita") for Poup v2. Users enter a recipe or paste a list of ingredients, Poup maps them to real products in its catalog, and shows the cheapest store or combination of stores to buy everything.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Recipe Cost Check (Priority: P1)

A consumer wants to cook a specific dish and wants to know how much it will cost before going to the store. They open Poup, tap "Modo Receita", type or paste their ingredient list (e.g., "1 kg de arroz, 500g de feijão preto, 2 latas de tomate pelado"), and Poup returns the total cost at each nearby store, ranked cheapest to most expensive.

**Why this priority**: This is the core value proposition — turning price data into a goal-oriented answer. Delivers immediate, standalone utility with no other feature dependency.

**Independent Test**: Can be fully tested by entering a 5-ingredient list and verifying that a ranked store cost table appears with a total per store.

**Acceptance Scenarios**:

1. **Given** a user has typed a list of ingredients, **When** they tap "Calcular", **Then** Poup displays a ranked list of stores with total basket cost for each, using current catalog prices.
2. **Given** an ingredient in the list doesn't match any catalog product, **When** results are shown, **Then** the unmatched ingredient is highlighted as "não encontrado" and excluded from store totals, with a manual search option.
3. **Given** a store doesn't carry all ingredients, **When** results are shown, **Then** that store's total is marked as "cesta incompleta" with a count of missing items.
4. **Given** multiple catalog products could match an ingredient, **When** Poup auto-selects one, **Then** the user can tap the item to swap it for an alternative product.

---

### User Story 2 - Split-Basket Optimization (Priority: P2)

A Plus-tier user wants to minimize total spend even if it means shopping at two stores. Poup shows not just the cheapest single store, but also the cheapest combination of two stores — "Compre leite e ovos no Atacadão + o restante no Pão de Açúcar, economize R$14,30."

**Why this priority**: This is the key Plus-tier differentiator and the feature's highest-leverage monetization hook. Requires P1 infrastructure but adds clear, quantified value on top.

**Independent Test**: Can be tested independently by verifying that a "melhor combinação" card appears above the single-store list showing which items to buy where and total savings vs. cheapest single store.

**Acceptance Scenarios**:

1. **Given** a Plus user has recipe results, **When** a split-basket saves more than R$5,00, **Then** a "Compra dividida" card appears at the top showing the two-store split, items allocated to each, and total savings amount.
2. **Given** a Free user views results, **When** a split-basket savings exists, **Then** a teaser card shows "Economize R$X comprando em 2 lojas — exclusivo Plus" with a CTA to upgrade.
3. **Given** no split-basket saves more than R$5,00, **When** results are shown, **Then** no split-basket card appears — single-store is already optimal.

---

### User Story 3 - Save & Reuse Recipes (Priority: P3)

A user regularly cooks the same meals and wants to track whether prices have changed. They save a recipe by name ("Feijoada de domingo") and can re-run the calculation any time to see current prices vs. the last time they checked.

**Why this priority**: Drives retention and habitual use. Requires P1 but adds no new infrastructure complexity beyond persistence.

**Independent Test**: Can be tested by saving a recipe, simulating a price change, reopening the saved recipe, and verifying the new total reflects the updated price with a delta indicator.

**Acceptance Scenarios**:

1. **Given** a user has a recipe with results, **When** they tap "Salvar receita" and enter a name, **Then** the recipe is saved to their account and accessible from a "Minhas receitas" section.
2. **Given** a user reopens a saved recipe, **When** prices have changed since last run, **Then** updated totals appear with a timestamp and a delta (↑ R$2,10 mais caro / ↓ R$3,40 mais barato) vs. the last saved total.
3. **Given** a Free user, **Then** they can save up to 3 recipes; Plus users have unlimited saved recipes.

---

### User Story 4 - Serving Size Scaling (Priority: P4)

A user wants to cook for a different number of people than their recipe assumes. They adjust a "serves N" selector and all ingredient quantities — and therefore prices — scale proportionally.

**Why this priority**: Significantly improves usefulness for families vs. individuals but is an enhancement on top of the core flow.

**Independent Test**: Can be tested by setting serves=2, noting totals, changing to serves=4, and verifying all quantities and totals double.

**Acceptance Scenarios**:

1. **Given** a recipe has a serving size set, **When** the user adjusts from 2 to 6 servings, **Then** all quantities and store totals update proportionally in real time.
2. **Given** a user pastes a raw ingredient list with no serving context, **When** the recipe is created, **Then** serving size defaults to 1 (total quantity as entered) and the user can adjust upward.

---

### Loading & Interaction States

- While matching is in progress, each ingredient result appears as it resolves (progressive rendering). Store totals update live after each new match.
- Users can cancel an in-progress calculation and return to the ingredient input screen.
- If matching stalls beyond 15 seconds for any single ingredient, that item is marked "não encontrado" automatically and matching continues for the rest.

### Edge Cases

- What happens when the catalog has no products near the user's location? → Show national average prices with a "preços podem variar por região" disclaimer.
- What if an ingredient is very generic (e.g., "sal")? → Auto-select the lowest-priced matching product; user can swap.
- What if the user pastes a recipe with instructions mixed into the ingredient list? → Ingredient extraction ignores non-ingredient lines; ambiguous lines are flagged for user review.
- What if a saved recipe's matched product goes out of stock or is removed from the catalog? → Mark as "produto indisponível" on next run and prompt the user to pick a replacement.
- What if a store is temporarily closed or has no price data? → Exclude from results with a note.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to enter ingredients as free text — either individual items or a pasted block — with optional quantities and units. A recipe is limited to 30 ingredients maximum; users are notified when approaching and at the limit.
- **FR-002**: System MUST automatically map each ingredient line to one or more catalog products using name/keyword matching.
- **FR-003**: System MUST display a ranked list of stores by total basket cost using current catalog prices for the user's location.
- **FR-004**: System MUST clearly distinguish complete baskets (all ingredients available) from incomplete baskets (some items missing), showing a count of missing items per store.
- **FR-005**: Users MUST be able to manually swap any auto-matched product for an alternative from the catalog.
- **FR-006**: System MUST show a split-basket recommendation to authenticated Plus users when buying from two stores saves more than R$5,00 vs. the cheapest single store. Unauthenticated users do not see split-basket results or teasers.
- **FR-007**: System MUST show a split-basket teaser (savings amount visible, action locked) to Free users, with a CTA to upgrade to Plus.
- **FR-008**: Users MUST be able to save a recipe (ingredient list + product mappings) under a custom name. Saving requires an authenticated account; unauthenticated users are prompted to sign in when they attempt to save.
- **FR-009**: Free users MUST be limited to 3 saved recipes; Plus users have unlimited saved recipes.
- **FR-010**: Saved recipes MUST recalculate with current prices each time they are reopened, showing a delta vs. the total from the previous session (last time the recipe was opened). The previous session's total is persisted alongside the recipe and updated after each view.
- **FR-011**: Users MUST be able to adjust the serving size for a recipe, with all quantities and totals scaling proportionally.
- **FR-012**: System MUST allow users to share a recipe result as a shareable image card (store totals + ingredient list). No public URL is generated — sharing is image-only, suitable for WhatsApp and social media.

### Key Entities

- **Recipe**: A named collection of ingredient lines with an optional serving size. Belongs to a user account.
- **IngredientLine**: A single line of a recipe — raw text input, resolved quantity and unit, and a link to a chosen CatalogProduct.
- **CatalogProduct**: An existing product in Poup's catalog (EAN-keyed, with prices per store).
- **RecipeResult**: A computed snapshot — total cost per store, split-basket recommendation, timestamp. Recalculated on demand, not persisted.
- **ProductMatch**: The mapping between an IngredientLine and one or more CatalogProduct candidates, with a confidence level.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can go from an empty input to a full recipe cost breakdown in under 30 seconds on a standard mobile connection.
- **SC-002**: At least 80% of ingredients from a standard Brazilian recipe are automatically matched to catalog products without manual intervention.
- **SC-003**: Users who use Modo Receita at least once per week show 30% higher 30-day retention than users who do not.
- **SC-004**: The split-basket teaser drives a measurable lift in Free→Plus conversion within 90 days of launch (baseline set at launch).
- **SC-005**: 70% of users who start a recipe calculation complete it (reach the results screen), indicating the matching UX doesn't cause drop-off.
- **SC-006**: At least 40% of users who complete their first recipe calculation save it within the same session.

## Clarifications

### Session 2026-05-15

- Q: Does the P1 core calculation require a logged-in account, or is guest access allowed? → A: P1 calculation (ingredient entry + store totals) is available to unauthenticated users. Saving recipes and accessing split-basket optimization require login.
- Q: Does sharing a recipe result generate a public URL or image only? → A: Image/screenshot card only — no public URL generated.
- Q: Is there a maximum number of ingredients per recipe? → A: 30 ingredients maximum. Users are notified when approaching and at the limit.
- Q: How should matching results appear while calculation is in progress? → A: Progressive — each ingredient match resolves and appears individually; store totals update live as more ingredients are matched.
- Q: What is the reference point for the price delta on saved recipes? → A: Delta vs. the price total from the last time the recipe was opened (not from when it was first created).

## Assumptions

- Ingredient-to-product matching uses keyword/fuzzy search against existing catalog product names in v2; no LLM or external NLP service required.
- "Nearby stores" uses the same location context already established in the core Poup app.
- Split-basket considers a maximum of 2 stores in v2 (not 3+) to keep the UX simple.
- The R$5,00 minimum savings threshold for split-basket is a tuneable default, not hardcoded.
- v2 is user-input only — no built-in recipe library. A browsable curated recipe library (SEO/distribution play) is explicitly deferred to v3, after ingredient matching quality is validated at scale.
