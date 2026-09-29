/**
 * Sanitizes user-generated input to prevent stored Cross-Site Scripting (XSS)
 * and malicious protocol injection (e.g. javascript:, data:, vbscript:).
 */

const DANGEROUS_TAG_REGEX = /<\s*\/?\s*(script|iframe|embed|object|base|link|meta|style|form|input|button|svg|math)[^>]*>/gi;
const DANGEROUS_ATTR_REGEX = /\s*(on\w+|formaction|action|href|src)\s*=\s*(['"]?)\s*(javascript:|data:|vbscript:)[^'"]*\2/gi;
const ON_EVENT_REGEX = /\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;

export function sanitizeHtml(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') return '';

  let sanitized = input
    // Strip script, iframe, object, embed tags
    .replace(DANGEROUS_TAG_REGEX, '')
    // Strip inline on* handlers (onclick, onload, onerror, etc.)
    .replace(ON_EVENT_REGEX, '')
    // Strip dangerous URL schemes in attributes
    .replace(DANGEROUS_ATTR_REGEX, '');

  return sanitized.trim();
}

export function sanitizeText(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') return '';
  // Convert any HTML special characters to text entities for plain-text fields
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

export function sanitizeUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed;
    }
    return null;
  } catch {
    return null;
  }
}
