<!--
Sync Impact Report
===================
Version change: 0.0.0 → 1.0.0 (MAJOR — initial ratification)
Modified principles: N/A (first version)
Added sections:
  - Core Principles (5 principles)
  - Technology & Architecture Constraints
  - Development Workflow & Quality Gates
  - Governance
Removed sections: N/A
Templates requiring updates:
  - .specify/templates/plan-template.md — ✅ compatible (Constitution Check section exists)
  - .specify/templates/spec-template.md — ✅ compatible (user stories + acceptance criteria align)
  - .specify/templates/tasks-template.md — ✅ compatible (test tasks + phases align)
Follow-up TODOs: None
-->

# Precos Mapa Constitution

## Core Principles

### I. Type-Safe Clean Code

All production code MUST be written in TypeScript with strict mode enabled.
Functions MUST have explicit return types. `any` is forbidden unless
justified in a code review comment. Dead code, unused imports, and
commented-out blocks MUST be removed before merge.

- Every module MUST pass `eslint` with zero warnings and zero errors.
- Variable and function names MUST be descriptive and self-documenting.
- Files MUST have a single responsibility; co-locate related logic
  by feature (e.g., `src/features/<name>/`).
- Shared utilities live in `src/lib/`; cross-feature imports MUST
  go through explicit barrel exports.
- Magic numbers and string literals MUST be extracted into named
  constants or configuration.

**Rationale**: Strict typing catches defects at compile time. Clean,
readable code reduces onboarding friction and review latency.

### II. Testing Discipline

Every user-facing feature MUST ship with tests that cover its acceptance
criteria. Tests MUST be co-located with or clearly mapped to the feature
they verify.

- Unit tests MUST cover all business logic and utility functions.
- Integration tests MUST cover API routes (`src/app/api/`) and
  critical data flows (e.g., crawl → extract → store).
- Tests MUST be deterministic: no reliance on network, real clocks,
  or mutable shared state. External dependencies MUST be mocked or
  stubbed.
- A failing test MUST block the PR from merging.
- Test names MUST describe the behavior, not the implementation
  (e.g., "returns formatted price when value is valid" not
  "test formatPrice").

**Rationale**: Tests are the executable specification. Without them
regressions go undetected and refactoring becomes risky.

### III. User Experience First

Every UI decision MUST prioritize clarity, speed, and accessibility.
Features MUST be designed from the user's perspective before
considering implementation convenience.

- Pages MUST render meaningful content within 1 second on a 4G
  connection; use server components and streaming where applicable.
- Interactive elements MUST provide immediate visual feedback
  (loading states, optimistic updates, error messages).
- All text MUST be in Portuguese (pt-BR) — the target audience's
  language. Labels, errors, and placeholders MUST be human-readable,
  never raw technical identifiers.
- Navigation MUST be predictable: the user MUST always know where
  they are and how to go back.
- Error states MUST guide the user toward resolution, not display
  stack traces or generic "something went wrong" messages.

**Rationale**: The product serves Brazilian market operators who
expect fast, intuitive tools. Poor UX directly causes churn.

### IV. Interface Consistency

All UI components MUST follow a single, cohesive design language
across the entire application. Visual inconsistencies are treated
as bugs.

- Colors, spacing, typography, and border radii MUST come from the
  Tailwind CSS design tokens defined in `tailwind.config.ts` (or
  Tailwind v4 CSS theme). No inline hex values or ad-hoc pixel
  sizes.
- Reusable components (buttons, cards, modals, section headers)
  MUST live in `src/features/shared/` or a designated component
  library and be used everywhere instead of one-off variants.
- Icon usage MUST be limited to the `lucide-react` library already
  in the project. Adding a second icon library requires constitution
  amendment.
- Layout patterns (panel shell, page headers, grid systems) MUST be
  consistent across all panel routes (`/painel/**`).
- Motion and animation MUST use `framer-motion` with consistent
  easing and duration values defined as shared constants.

**Rationale**: Consistency builds user trust and reduces cognitive
load. A fragmented UI signals an unfinished product.

### V. Simplicity & YAGNI

Start with the simplest solution that solves the current requirement.
Do not build for hypothetical future needs.

- No abstractions until a pattern repeats at least three times.
- Prefer Next.js built-in features (App Router, Server Actions,
  `next/font`, `next/image`) over third-party alternatives unless
  a measurable benefit is demonstrated.
- State management MUST use Zustand stores only when React state
  or server components are insufficient.
- New dependencies MUST be justified: document the problem they
  solve and confirm no existing dependency already covers it.
- Configuration MUST be minimal; convention-based defaults are
  preferred.

**Rationale**: Complexity is the primary enemy of maintainability.
Every abstraction carries ongoing cost. YAGNI keeps the codebase
lean and comprehensible.

## Technology & Architecture Constraints

- **Framework**: Next.js (App Router) with React 19+ and TypeScript 5+.
- **Styling**: Tailwind CSS v4 only. No CSS modules, styled-components,
  or inline styles except for dynamic values computed at runtime.
- **State**: Zustand for client state; React Server Components for
  server-derived data. No Redux, MobX, or Context-based global state.
- **Validation**: Zod for all runtime validation (API inputs, form data,
  external payloads).
- **AI/LLM**: OpenAI SDK (`openai` package). Prompts MUST be versioned
  and stored as constants, not inline strings.
- **Scraping**: Playwright for browser automation. Crawler logic MUST
  live in `src/lib/crawler/`.
- **Images**: Sharp for server-side image processing.
- **Deployment target**: Vercel (serverless). API routes MUST respect
  serverless constraints (no persistent connections, stateless handlers).

## Development Workflow & Quality Gates

- **Branching**: Feature branches off `main`. Branch names follow
  `<type>/<short-description>` (e.g., `feat/offer-import`).
- **Commits**: Conventional Commits format (`feat:`, `fix:`, `refactor:`,
  `docs:`, `test:`, `chore:`).
- **PR Requirements**:
  1. All CI checks (lint, type-check, tests) MUST pass.
  2. PR description MUST summarize what changed and why.
  3. No `console.log` or debug artifacts in production code.
- **Code Review**: At least one approval required before merge.
  Reviewers MUST verify constitution compliance.
- **Formatting**: Enforced by ESLint; no manual formatting debates.

## Governance

This constitution is the highest-authority document for development
decisions in the Precos Mapa project. When a practice conflicts with
this constitution, the constitution prevails.

- **Amendments**: Any change to this document MUST be proposed via PR,
  reviewed, and approved. The amendment MUST include a migration plan
  if existing code would violate the updated principles.
- **Versioning**: This document follows semantic versioning:
  - MAJOR: Principle removed or fundamentally redefined.
  - MINOR: New principle or section added, or material expansion.
  - PATCH: Wording, typo, or non-semantic clarification.
- **Compliance Review**: Every PR review MUST include a constitution
  compliance check. Violations MUST be flagged and resolved before
  merge.
- **Exceptions**: Temporary exceptions MUST be documented as
  `TODO(CONSTITUTION)` comments with a linked issue for resolution.

**Version**: 1.0.0 | **Ratified**: 2026-02-10 | **Last Amended**: 2026-02-10
