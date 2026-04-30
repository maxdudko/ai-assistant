const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export type ListPagination = { limit: number; offset: number };

/**
 * Parses limit/offset query params for list endpoints.
 * @param defaultLimit — per-route default when `limit` is omitted (e.g. 100 for tasks).
 */
export function parseListPagination(
  limitRaw?: string,
  offsetRaw?: string,
  defaultLimit: number = DEFAULT_LIMIT,
): ListPagination {
  const parsedLimit = parseInt(limitRaw ?? '', 10);
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, MAX_LIMIT)
      : Math.min(Math.max(defaultLimit, 1), MAX_LIMIT);

  const parsedOffset = parseInt(offsetRaw ?? '', 10);
  const offset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

  return { limit, offset };
}
