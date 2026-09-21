// src/lib/safe-redirect.ts
// ============================================================================
// OPEN-REDIRECT GUARD
// ============================================================================
// `callbackUrl` arrives from the query string, so it is attacker-controllable.
// Once it drives a real navigation, an unchecked value lets someone send a
// user from your login page to any site they choose — a credible phishing
// vector, since the link genuinely starts on your domain.
//
// Only same-origin absolute paths are allowed through.
// ============================================================================

export const DEFAULT_REDIRECT = "/calculator";

export function safeRedirectPath(
  raw: string | null | undefined,
  fallback: string = DEFAULT_REDIRECT
): string {
  if (!raw) return fallback;

  const value = raw.trim();

  // Must be an absolute path on this origin.
  if (!value.startsWith("/")) return fallback;

  // "//evil.com" is protocol-relative and resolves off-origin.
  if (value.startsWith("//")) return fallback;

  // Backslashes are normalised to "/" by some browsers ("/\evil.com").
  if (value.includes("\\")) return fallback;

  // Anything carrying a scheme is not a local path.
  if (value.includes("://")) return fallback;

  return value;
}
