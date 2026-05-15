import type {
  AuthTokens,
  LoginInput,
  ProjectInput,
  ProjectUpdate,
  RefreshTokenInput,
  ResourceInput,
  APUInput,
  BudgetItemInput,
  AIUConfigInput,
  ChapterInput,
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

  // Budget
  getBudgetSummary: (projectId: string) =>
    request<Record<string, unknown>>(`/projects/${projectId}/budget/summary`),
  listChapters: (projectId: string) =>
    request<Array<Record<string, unknown>>>(`/projects/${projectId}/budget/chapters`),
  createSubchapter: (projectId: string, chapterId: string, input: ChapterInput) =>
    request<Record<string, unknown>>(
      `/projects/${projectId}/budget/chapters/${chapterId}/subchapters`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
  listItems: (projectId: string, chapterId?: string) =>
    request<Array<Record<string, unknown>>>(
      `/projects/${projectId}/budget/items${chapterId ? `?chapterId=${chapterId}` : ''}`,
    ),
  createItem: (projectId: string, subchapterId: string, input: BudgetItemInput) =>
    request<Record<string, unknown>>(
      `/projects/${projectId}/budget/subchapters/${subchapterId}/items`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
  updateItem: (projectId: string, itemId: string, input: Partial<BudgetItemInput>) =>
    request<Record<string, unknown>>(`/projects/${projectId}/budget/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  deleteItem: (projectId: string, itemId: string) =>
    request<void>(`/projects/${projectId}/budget/items/${itemId}`, { method: 'DELETE' }),
  getAIU: (projectId: string) =>
    request<Record<string, unknown>>(`/projects/${projectId}/budget/aiu`),
  upsertAIU: (projectId: string, input: AIUConfigInput) =>
    request<Record<string, unknown>>(`/projects/${projectId}/budget/aiu`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  // Schedule
  listTasks: (projectId: string) =>
    request<Array<Record<string, unknown>>>(`/projects/${projectId}/schedule/tasks`),
  createTask: (
    projectId: string,
    input: {
      code: string;
      name: string;
      kind?: string;
      parentId?: string | null;
      plannedStart: string;
      plannedEnd: string;
      durationDays: number;
      progress?: number;
    },
  ) =>
    request<Record<string, unknown>>(`/projects/${projectId}/schedule/tasks`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateTask: (projectId: string, taskId: string, input: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/projects/${projectId}/schedule/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  deleteTask: (projectId: string, taskId: string) =>
    request<void>(`/projects/${projectId}/schedule/tasks/${taskId}`, { method: 'DELETE' }),
  updateTaskProgress: (projectId: string, taskId: string, progress: number) =>
    request<Record<string, unknown>>(`/projects/${projectId}/schedule/tasks/${taskId}/progress`, {
      method: 'PATCH',
      body: JSON.stringify({ progress }),
    }),
  computeCPM: (projectId: string) =>
    request<Array<Record<string, unknown>>>(`/projects/${projectId}/schedule/cpm`),
  createDependency: (
    projectId: string,
    input: { predecessorId: string; successorId: string; type?: string; lagDays?: number },
  ) =>
    request<Record<string, unknown>>(`/projects/${projectId}/schedule/dependencies`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  // Sales
  getSalesSummary: (projectId: string) =>
    request<Record<string, unknown>>(`/projects/${projectId}/sales/summary`),
  listTowers: (projectId: string) =>
    request<Array<Record<string, unknown>>>(`/projects/${projectId}/sales/towers`),
  listUnits: (projectId: string) =>
    request<Array<Record<string, unknown>>>(`/projects/${projectId}/sales/units`),
  createTower: (
    projectId: string,
    input: { code: string; name: string; floors?: number },
  ) =>
    request<Record<string, unknown>>(`/projects/${projectId}/sales/towers`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  createUnit: (projectId: string, input: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/projects/${projectId}/sales/units`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  listSales: (projectId: string) =>
    request<Array<Record<string, unknown>>>(`/projects/${projectId}/sales/sales`),
  createSale: (projectId: string, input: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/projects/${projectId}/sales/sales`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  // Cash Flow
  getCashFlowSummary: (projectId: string) =>
    request<Record<string, unknown>>(`/projects/${projectId}/cashflow/summary`),
  listCashFlowEntries: (projectId: string, year?: number) =>
    request<Array<Record<string, unknown>>>(
      `/projects/${projectId}/cashflow/entries${year ? `?year=${year}` : ''}`,
    ),
  createCashFlowEntry: (
    projectId: string,
    input: {
      date: string;
      kind: 'INGRESO' | 'EGRESO';
      category:
        | 'VENTA_CUOTA_INICIAL'
        | 'VENTA_SALDO'
        | 'DESEMBOLSO_CREDITO'
        | 'APORTE_SOCIO'
        | 'EGRESO_CAPITULO'
        | 'INTERES_CREDITO'
        | 'AMORTIZACION_CREDITO'
        | 'IMPUESTOS'
        | 'OTRO';
      description: string;
      amount: string;
      chapterId?: string | null;
      budgetItemId?: string | null;
      saleId?: string | null;
      loanFacilityId?: string | null;
    },
  ) =>
    request<Record<string, unknown>>(`/projects/${projectId}/cashflow/entries`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  deleteCashFlowEntry: (projectId: string, entryId: string) =>
    request<void>(`/projects/${projectId}/cashflow/entries/${entryId}`, { method: 'DELETE' }),
  listLoans: (projectId: string) =>
    request<Array<Record<string, unknown>>>(`/projects/${projectId}/cashflow/loans`),
  createLoan: (
    projectId: string,
    input: {
      bank: string;
      amount: string;
      interestRateAnnual: string;
      startDate: string;
      termMonths: number;
      graceMonths?: number;
    },
  ) =>
    request<Record<string, unknown>>(`/projects/${projectId}/cashflow/loans`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  // Change Orders
  listChangeOrders: (projectId: string) =>
    request<Array<Record<string, unknown>>>(`/projects/${projectId}/changes`),
  createChangeOrder: (
    projectId: string,
    input: {
      code: string;
      title: string;
      justification: string;
      estimatedCostImpact: string;
      estimatedScheduleImpactDays?: number;
    },
  ) =>
    request<Record<string, unknown>>(`/projects/${projectId}/changes`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateChangeOrderStatus: (
    projectId: string,
    id: string,
    status: string,
  ) =>
    request<Record<string, unknown>>(`/projects/${projectId}/changes/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  approveChangeOrder: (projectId: string, id: string) =>
    request<Record<string, unknown>>(`/projects/${projectId}/changes/${id}/approve`, {
      method: 'POST',
    }),
  rejectChangeOrder: (projectId: string, id: string, reason: string) =>
    request<Record<string, unknown>>(`/projects/${projectId}/changes/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  listBaselines: (projectId: string) =>
    request<Array<Record<string, unknown>>>(`/projects/${projectId}/changes/baselines`),

  // Dashboard
  getDashboardSummary: (projectId: string) =>
    request<Record<string, unknown>>(`/projects/${projectId}/dashboard/summary`),

  // Resources & APUs (global)
  listResources: () => request<Array<Record<string, unknown>>>('/budget/resources'),
  createResource: (input: ResourceInput) =>
    request<Record<string, unknown>>('/budget/resources', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  addResourceRate: (resourceId: string, unitCost: string) =>
    request<Record<string, unknown>>(`/budget/resources/${resourceId}/rates`, {
      method: 'POST',
      body: JSON.stringify({ unitCost }),
    }),
  listAPUs: () => request<Array<Record<string, unknown>>>('/budget/apus'),
  createAPU: (input: APUInput) =>
    request<Record<string, unknown>>('/budget/apus', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};
