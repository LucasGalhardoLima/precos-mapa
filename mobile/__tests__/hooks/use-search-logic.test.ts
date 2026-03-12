// mobile/__tests__/hooks/use-search-logic.test.ts

// Replicate the search logic from use-search.ts

// ---------------------------------------------------------------------------
// Query threshold: determines which search mode to use
// ---------------------------------------------------------------------------

type SearchMode = 'none' | 'ilike' | 'fuzzy';

function getSearchMode(query: string): SearchMode {
  if (!query || query.length < 2) return 'none';
  if (query.length >= 3) return 'fuzzy';
  return 'ilike';
}

// ---------------------------------------------------------------------------
// Deduplication: remove duplicate names, limit to 5
// ---------------------------------------------------------------------------

function deduplicateSuggestions(names: string[]): string[] {
  return [...new Set(names)].slice(0, 5);
}

// ===========================================================================
// Tests
// ===========================================================================

describe('Search — Query Mode Selection', () => {
  it('returns "none" for empty query', () => {
    expect(getSearchMode('')).toBe('none');
  });

  it('returns "none" for single character', () => {
    expect(getSearchMode('a')).toBe('none');
  });

  it('returns "ilike" for 2-character query', () => {
    expect(getSearchMode('ar')).toBe('ilike');
  });

  it('returns "fuzzy" for 3+ character query', () => {
    expect(getSearchMode('arr')).toBe('fuzzy');
    expect(getSearchMode('arroz')).toBe('fuzzy');
  });

  it('returns "none" for null/undefined-like empty string', () => {
    expect(getSearchMode('')).toBe('none');
  });
});

describe('Search — Deduplication', () => {
  it('removes duplicate names', () => {
    const input = ['Arroz', 'Feijão', 'Arroz', 'Leite', 'Feijão'];
    expect(deduplicateSuggestions(input)).toEqual(['Arroz', 'Feijão', 'Leite']);
  });

  it('limits to 5 results', () => {
    const input = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    expect(deduplicateSuggestions(input)).toHaveLength(5);
    expect(deduplicateSuggestions(input)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('deduplicates before limiting', () => {
    // 8 items but only 4 unique
    const input = ['A', 'B', 'A', 'C', 'B', 'D', 'A', 'C'];
    expect(deduplicateSuggestions(input)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('returns empty array for empty input', () => {
    expect(deduplicateSuggestions([])).toEqual([]);
  });

  it('preserves order of first occurrence', () => {
    const input = ['Café', 'Arroz', 'Café', 'Leite'];
    expect(deduplicateSuggestions(input)).toEqual(['Café', 'Arroz', 'Leite']);
  });
});
