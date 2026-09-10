const INTERNAL_PATH_BASE = "https://twoplayer.invalid";
const UNSAFE_PATH_CHARACTERS = /[\\\u0000-\u001f\u007f]/;

/**
 * Normalize an untrusted redirect target to a same-origin application path.
 * The synthetic base prevents protocol-relative and backslash-based redirects
 * without coupling this shared utility to server-only environment values.
 */
export function getSafeInternalPath(value: unknown, fallback: string): string;
export function getSafeInternalPath(
  value: unknown,
  fallback?: undefined,
): string | undefined;
export function getSafeInternalPath(
  value: unknown,
  fallback?: string,
): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== "string") return fallback;

  const path = candidate.trim();
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    UNSAFE_PATH_CHARACTERS.test(path)
  ) {
    return fallback;
  }

  try {
    const url = new URL(path, INTERNAL_PATH_BASE);
    if (url.origin !== INTERNAL_PATH_BASE) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
