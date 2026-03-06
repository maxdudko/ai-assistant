const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

let refreshRequest: Promise<boolean> | null = null;

function shouldRedirectOnUnauthorized(path: string) {
  if (['/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/forgot-password', '/api/auth/reset-password'].includes(path)) {
    return false;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  return window.location.pathname.startsWith('/me');
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

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  didRetry = false,
): Promise<T> {
  const res = await doFetch(path, options);

  if (res.status === 401 && !didRetry && path !== '/api/auth/refresh') {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiFetch<T>(path, options, true);
    }
  }

  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined' && shouldRedirectOnUnauthorized(path)) {
      window.location.href = '/auth/login';
    }
    throw new Error(await res.text());
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
