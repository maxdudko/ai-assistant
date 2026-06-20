const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

let refreshRequest: Promise<boolean> | null = null;

function shouldRedirectOnUnauthorized(path: string) {
  if (
    ['/api/admin/auth/login', '/api/admin/auth/refresh'].includes(path) ||
    typeof window === 'undefined'
  ) {
    return false;
  }

  return window.location.pathname.startsWith('/admin');
}

function redirectToLoginIfUnauthorized(apiPath: string, status: number) {
  if (status === 401 && typeof window !== 'undefined' && shouldRedirectOnUnauthorized(apiPath)) {
    window.location.href = '/admin/login';
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
        const res = await doFetch('/api/admin/auth/refresh', { method: 'POST' });
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

async function fetchWithAuth(
  path: string,
  options: RequestInit = {},
  didRetry = false,
): Promise<Response> {
  const res = await doFetch(path, options);

  if (res.status === 401 && !didRetry && path !== '/api/admin/auth/refresh') {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return fetchWithAuth(path, options, true);
    }
  }

  return res;
}

export async function adminApiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
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
