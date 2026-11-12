// Public page with the privacy policy, terms (#termos) and about (#sobre),
// served by the admin at /privacidade. The base comes from the build env
// (eas.json) and ships as a placeholder until the domain is decided — so the
// links must disappear rather than open "https://<PREENCHER>/…".

export type PolicyLink = 'sobre' | 'termos' | 'privacidade';

export function resolvePrivacyUrl(raw: string | undefined): string | null {
  const url = raw?.trim();
  if (!url || !url.startsWith('https://') || url.includes('<')) return null;
  return url;
}

export function policyLinkUrl(base: string, link: PolicyLink): string {
  return link === 'privacidade' ? base : `${base}#${link}`;
}

export const PRIVACY_URL = resolvePrivacyUrl(process.env.EXPO_PUBLIC_PRIVACY_URL);
