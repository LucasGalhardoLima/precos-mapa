# Switch PDF Extraction to Claude Sonnet via Vercel AI SDK

**Date:** 2026-03-05
**Status:** Approved

## Problem

The automated PDF import cron uses GPT-4o vision with a complex rendering pipeline (pdfjs-dist → @napi-rs/canvas → sharp → base64 images → OpenAI). Each page requires a separate API call, making 3-pass extraction on a 4-page PDF take ~240-300s, hitting Vercel's 300s timeout. It's also expensive at $2.50/$10 per 1M tokens.

## Solution

Switch to Claude Sonnet 4.6 via the Vercel AI SDK with native PDF support. Send the raw PDF buffer directly — no rendering needed. One API call per pass instead of one per page.

### Changes

1. **Install packages**: `ai`, `@ai-sdk/anthropic`
2. **New function**: `extractProductsFromPdf()` using `generateObject` with Zod schema
3. **Update `processPdfBuffer()`**: Use new Claude-based extraction for the cron path
4. **Keep existing OpenAI functions**: `extractFromImage`, `crawlUrl` remain for admin manual flow

### Model

Claude Sonnet 4.6 (`claude-sonnet-4-6`) at $3/$15 per 1M tokens.

### Result

- API calls reduced from `pages × 3` to just `3`
- No rendering pipeline needed
- Type-safe extraction with Zod schema
- Well within 300s timeout
