import type {
  AuthTokens,
  LoginInput,
  ProjectInput,
  ProjectUpdate,
  RefreshTokenInput,
} from '@santaisabel/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
  }
}

type AuthCallbacks = {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  onTokensRefreshed: (tokens: AuthTokens) => void;
  onUnauthorized: () => void;
};

let auth: AuthCallbacks | null = null;
let refreshInflight: Promise<AuthTokens | null> | null = null;

export function configureApiAuth(callbacks: AuthCallbacks): void {
  auth = callbacks;
}

async function refreshAccess(): Promise<AuthTokens | null> {
  if (!auth) return null;
  const rt = auth.getRefreshToken();
  if (!rt) return null;
  if (refreshInflight) return refreshInflight;

  refreshInflight = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt } satisfies RefreshTokenInput),
      });
      if (!res.ok) return null;
      const tokens = (await res.json()) as AuthTokens;
      auth?.onTokensRefreshed(tokens);
      return tokens;
    } catch {
      return null;
    } finally {
      refreshInflight = null;
    }
  })();

  return refreshInflight;
}

type FetchOpts = RequestInit & { skipAuth?: boolean; _retried?: boolean };

async function request<T>(path: string, init: FetchOpts = {}): Promise<T> {
  const { skipAuth = false, _retried = false, headers: hdrs, ...rest } = init;
  const token = !skipAuth ? auth?.getAccessToken() ?? null : null;

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(hdrs ?? {}),
    },
  });

  if (res.status === 401 && !skipAuth && !_retried) {
    const tokens = await refreshAccess();
    if (tokens) {
      return request<T>(path, { ...init, _retried: true });
    }
    auth?.onUnauthorized();
    throw new ApiError(401, 'No autenticado');
  }

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text().catch(() => '');
    }
    const message =
      (typeof body === 'object' && body && 'message' in body && String((body as { message: unknown }).message)) ||
      res.statusText;
    throw new ApiError(res.status, message, body);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  login: (input: LoginInput) =>
    request<AuthTokens>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
      skipAuth: true,
    }),
  me: () => request<{ sub: string; email: string; role: string }>('/auth/me'),
  listProjects: () => request<Array<Record<string, unknown>>>('/projects'),
  getProject: (id: string) => request<Record<string, unknown>>(`/projects/${id}`),
  createProject: (input: ProjectInput) =>
    request<Record<string, unknown>>('/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateProject: (id: string, input: ProjectUpdate) =>
    request<Record<string, unknown>>(`/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  deleteProject: (id: string) =>
    request<void>(`/projects/${id}`, { method: 'DELETE' }),
};
