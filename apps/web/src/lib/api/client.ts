const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Must stay in sync with `AuthService.ACCESS_TOKEN_TTL_SECONDS` in apps/api. */
export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;

let refreshRequest: Promise<boolean> | null = null;

function shouldRedirectOnUnauthorized(path: string) {
  if (
    [
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/refresh',
      '/api/auth/forgot-password',
      '/api/auth/reset-password',
    ].includes(path)
  ) {
    return false;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  return window.location.pathname.startsWith('/me');
}

/** When an API call returns 401 on a protected app route, send the user to login (refresh already failed). */
export function redirectToLoginIfUnauthorized(apiPath: string, status: number) {
  if (status === 401) {
    if (typeof window !== 'undefined' && shouldRedirectOnUnauthorized(apiPath)) {
      window.location.href = '/auth/login';
    }
  }
}

async function doFetch(path: string, options: RequestInit = {}) {
  return fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
}

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshRequest) {
    refreshRequest = (async () => {
      try {
        const res = await doFetch('/api/auth/refresh', { method: 'POST' });
        return res.ok;
      } catch {
        return false;
      } finally {
        refreshRequest = null;
      }
    })();
  }

  return refreshRequest;
}

/** Refresh access cookie using the HTTP-only refresh cookie. Idempotent; safe to call on a timer or when the tab becomes visible. */
export async function refreshSession(): Promise<boolean> {
  return refreshAccessToken();
}

/** Like apiFetch but returns the Response (for streaming, blobs, etc.). Retries once after refresh on 401. */
export async function fetchWithAuth(
  path: string,
  options: RequestInit = {},
  didRetry = false,
): Promise<Response> {
  const res = await doFetch(path, options);

  if (res.status === 401 && !didRetry && path !== '/api/auth/refresh') {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return fetchWithAuth(path, options, true);
    }
  }

  return res;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetchWithAuth(path, options);

  if (!res.ok) {
    redirectToLoginIfUnauthorized(path, res.status);
    throw new Error(await res.text());
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
