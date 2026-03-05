# Deal Card Compact Spacing Fix

**Date:** 2026-03-05
**Status:** Approved

## Problem

PriceTagCard in compact mode has double padding. The `compactCard` style adds `padding: 12` to the wrapper, while the inner content view has `paddingTop: 28, paddingHorizontal: 16, paddingBottom: 16`. This stacks to ~28px horizontal padding per side, leaving only ~164px for content. Two badges almost touch the right edge.

## Solution

Combine: fix the double-padding bug + bump card width from 220 to 236px.

### Changes

1. **PriceTagCard** — add `compact` prop. When true, reduce content padding to `paddingTop: 16, paddingHorizontal: 12, paddingBottom: 10`.
2. **DealCard** — pass `compact` to CardWrapper. Remove `compactCard` style override.
3. **DealCard** — bump `compactWrapper` width from 220 to 236.

### Result

Content area: 236 - 12 - 12 = 212px (up from ~164px). Badges have ample breathing room.
