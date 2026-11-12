import { resolvePrivacyUrl, policyLinkUrl } from '../privacy-url';

describe('resolvePrivacyUrl', () => {
  it('accepts a real https URL', () => {
    expect(resolvePrivacyUrl('https://poup.example/privacidade')).toBe('https://poup.example/privacidade');
  });

  it('trims surrounding whitespace', () => {
    expect(resolvePrivacyUrl('  https://poup.example/privacidade \n')).toBe('https://poup.example/privacidade');
  });

  it('hides the links while eas.json still holds the placeholder', () => {
    expect(resolvePrivacyUrl('https://<PREENCHER>/privacidade')).toBeNull();
  });

  it('hides the links when the variable is missing or empty', () => {
    expect(resolvePrivacyUrl(undefined)).toBeNull();
    expect(resolvePrivacyUrl('')).toBeNull();
    expect(resolvePrivacyUrl('   ')).toBeNull();
  });

  it('refuses anything that is not https', () => {
    expect(resolvePrivacyUrl('http://poup.example/privacidade')).toBeNull();
    expect(resolvePrivacyUrl('poup.example/privacidade')).toBeNull();
    expect(resolvePrivacyUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('policyLinkUrl', () => {
  const base = 'https://poup.example/privacidade';

  it('opens the policy itself without an anchor', () => {
    expect(policyLinkUrl(base, 'privacidade')).toBe(base);
  });

  it('points sobre and termos at their anchors on the same page', () => {
    expect(policyLinkUrl(base, 'sobre')).toBe(`${base}#sobre`);
    expect(policyLinkUrl(base, 'termos')).toBe(`${base}#termos`);
  });
});
