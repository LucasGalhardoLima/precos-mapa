// Capital Verde — design tokens for the MLP rebuild.
//
// Source of truth, in order (per mobile/CLAUDE.md): docs/poup-mlp-decisoes.md
// "Base visual" section, then the Claude Design artifact
// (https://claude.ai/artifact/2iTFp1CFYKN3kVAtMr6p8C). Every value below was
// either transcribed from the doc or confirmed against the artifact's
// rendered HTML (colors via literal hex/CSS-var matches, sizes/weights via
// inline styles on the actual mockup elements — not invented).
//
// Two things the doc names but doesn't give a hex for aren't included here:
// "vermelho" (error color) and the settings-icon-button's own 14px radius —
// neither is used by any Etapa 2 component, so no value was guessed for them.
//
// Known, deliberate divergence from the artifact's rendered pixels: the
// amber banner in the artifact renders text as #7A4A00, but the doc states
// #9A5B00 and doc wins on conflict per mobile/CLAUDE.md's source hierarchy —
// confirmed with the user 2026-09-17.

export const colors = {
  brand: '#12A08C',
  brandInk: '#0E7F6F', // green-text and filled-button background (contrast pick)
  brandTint: '#E4F3EF', // badge/seal background
  background: '#F2F5F4',
  ink: '#16201D',
  secondary: '#5B6965',
  absence: '#A3AEAA', // gray for missing/unavailable, never red or amber
  border: '#DCE3E0',
  borderDashed: '#C5CEC9', // dashed empty-state card border only, verified on the artifact
  amberText: '#9A5B00',
  amberBackground: '#FBF1DC',
} as const;

// RN ignores `fontWeight` on a custom-loaded font family (the weight is
// baked into the family name instead) — each Manrope weight is its own
// fontFamily, registered by useFonts() in app/_layout.tsx.
export const fontFamily = {
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
} as const;

// Apply to any Text showing a number (prices, counts, distances) so digits
// keep a fixed width and don't jiggle at line breaks.
// Not `as const`: RN's TextStyle.fontVariant wants a mutable FontVariant[],
// and `as const` would make this a readonly tuple TS then rejects on spread.
export const tabularNums: { fontVariant: ('tabular-nums' | 'lining-nums' | 'oldstyle-nums' | 'proportional-nums')[] } = {
  fontVariant: ['tabular-nums'],
};

export const typography = {
  title: { fontFamily: fontFamily.bold, fontSize: 26 },
  phrase: { fontFamily: fontFamily.semibold, fontSize: 20 },
  price: { fontFamily: fontFamily.extrabold, fontSize: 22 },
  body: { fontFamily: fontFamily.medium, fontSize: 16 },
  support: { fontFamily: fontFamily.medium, fontSize: 14 },
  label: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    letterSpacing: 1.04, // 0.08em @ 13px, verified on "ONDE"/"ITENS" block labels
    textTransform: 'uppercase' as const,
  },
  provenance: { fontFamily: fontFamily.medium, fontSize: 13 },
  // Not one of the doc's named scale steps, but verified directly on the
  // artifact's "ver todos os mercados ›" link text — its own distinct size.
  link: { fontFamily: fontFamily.semibold, fontSize: 15 },
  // Onboarding (artifact 7a–7c) sizes that the doc's scale above doesn't list.
  // Line heights are the artifact's ratios (1.1 / 1.45 / 1.4) in whole px.
  headline: { fontFamily: fontFamily.extrabold, fontSize: 30, lineHeight: 33, letterSpacing: -0.6 },
  headlineSm: { fontFamily: fontFamily.extrabold, fontSize: 28, lineHeight: 31, letterSpacing: -0.56 },
  lead: { fontFamily: fontFamily.medium, fontSize: 16, lineHeight: 23 },
  leadSm: { fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 22 },
  note: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 18 },
  wordmark: { fontFamily: fontFamily.extrabold, fontSize: 24, letterSpacing: -0.48 },
} as const;

export const radii = {
  md: 16, // buttons, cards, inputs, the amber banner, the dashed empty-card
  lg: 20, // larger sheet/modal-level containers (not used before Etapa 3+)
} as const;

export const targets = {
  touch: 44, // minimum tappable area (chips, leading ✕, list-row icons)
  button: 52, // filled-button and search-field height
} as const;

export const borderWidth = 1.5; // every card/button/input border in the system

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 14,
  xl: 16,
} as const;
