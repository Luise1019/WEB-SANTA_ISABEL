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
  const token = !skipAuth ? (auth?.getAccessToken() ?? null) : null;

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
      (typeof body === 'object' &&
        body &&
        'message' in body &&
        String((body as { message: unknown }).message)) ||
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
  deleteProject: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),

  // Budget
  getBudgetSummary: (projectId: string) =>
    request<Record<string, unknown>>(`/projects/${projectId}/budget/summary`),
  listChapters: (projectId: string) =>
    request<Array<Record<string, unknown>>>(`/projects/${projectId}/budget/chapters`),
  createChapter: (projectId: string, input: ChapterInput) =>
    request<Record<string, unknown>>(`/projects/${projectId}/budget/chapters`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
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
  getBudgetControl: (projectId: string) =>
    request<Record<string, unknown>>(`/projects/${projectId}/budget/control`),
  updateItemActuals: (
    projectId: string,
    itemId: string,
    dto: { committedCost?: string; actualCost?: string },
  ) =>
    request<Record<string, unknown>>(`/projects/${projectId}/budget/items/${itemId}/actuals`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
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
  deleteDependency: (projectId: string, dependencyId: string) =>
    request<void>(`/projects/${projectId}/schedule/dependencies/${dependencyId}`, {
      method: 'DELETE',
    }),

  // Schedule — Santa Isabel template + extras
  seedSantaIsabelSchedule: (projectId: string) =>
    request<{ message: string; tasksCreated: number; depsCreated: number }>(
      `/projects/${projectId}/schedule/seed-santa-isabel`,
      { method: 'POST', body: '{}' },
    ),
  clearSchedule: (projectId: string) =>
    request<{ deleted: boolean }>(`/projects/${projectId}/schedule/clear`, { method: 'DELETE' }),

  // Schedule — Milestones
  listMilestones: (projectId: string) =>
    request<Array<Record<string, unknown>>>(`/projects/${projectId}/schedule/milestones`),
  createMilestone: (
    projectId: string,
    input: { code: string; name: string; plannedDate: string; isContractual?: boolean },
  ) =>
    request<Record<string, unknown>>(`/projects/${projectId}/schedule/milestones`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateMilestone: (projectId: string, milestoneId: string, input: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/projects/${projectId}/schedule/milestones/${milestoneId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  deleteMilestone: (projectId: string, milestoneId: string) =>
    request<void>(`/projects/${projectId}/schedule/milestones/${milestoneId}`, {
      method: 'DELETE',
    }),

  // Schedule — Baselines
  listScheduleBaselines: (projectId: string) =>
    request<Array<Record<string, unknown>>>(`/projects/${projectId}/schedule/baselines`),
  createScheduleBaseline: (projectId: string, label: string) =>
    request<Record<string, unknown>>(`/projects/${projectId}/schedule/baselines`, {
      method: 'POST',
      body: JSON.stringify({ label }),
    }),

  // Schedule — Export (returns raw Response for download)
  exportScheduleExcel: (projectId: string): Promise<Response> =>
    fetch(`${API_URL}/projects/${projectId}/schedule/export/excel`, {
      headers: { Authorization: `Bearer ${auth?.getAccessToken() ?? ''}` },
    }),

  // Sales
  getSalesSummary: (projectId: string) =>
    request<Record<string, unknown>>(`/projects/${projectId}/sales/summary`),
  listTowers: (projectId: string) =>
    request<Array<Record<string, unknown>>>(`/projects/${projectId}/sales/towers`),
  listUnits: (projectId: string) =>
    request<Array<Record<string, unknown>>>(`/projects/${projectId}/sales/units`),
  createTower: (projectId: string, input: { code: string; name: string; floors?: number }) =>
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
  listPriceLists: (projectId: string) =>
    request<Array<Record<string, unknown>>>(`/projects/${projectId}/sales/price-lists`),
  createPriceList: (
    projectId: string,
    input: { name: string; effectiveDate: string; notes?: string | null; isBase?: boolean },
  ) =>
    request<Record<string, unknown>>(`/projects/${projectId}/sales/price-lists`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  setPriceListItems: (
    projectId: string,
    priceListId: string,
    items: Array<{ unitId: string; price: string }>,
  ) =>
    request<Record<string, unknown>>(
      `/projects/${projectId}/sales/price-lists/${priceListId}/items`,
      { method: 'PUT', body: JSON.stringify({ items }) },
    ),
  getPriceEvolution: (projectId: string) =>
    request<Array<Record<string, unknown>>>(`/projects/${projectId}/sales/price-evolution`),
  getSalesDashboard: (projectId: string) =>
    request<Record<string, unknown>>(`/projects/${projectId}/sales/dashboard`),

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
  updateChangeOrderStatus: (projectId: string, id: string, status: string) =>
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
  // ── Feasibility / Prefactibilidad ─────────────────────────
  getFeasibility: (projectId: string) =>
    request<Record<string, unknown>>(`/projects/${projectId}/feasibility`),
  updateFeasibility: (projectId: string, input: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/projects/${projectId}/feasibility`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  replaceFeasibilityCostItems: (projectId: string, items: Array<Record<string, unknown>>) =>
    request<Array<Record<string, unknown>>>(`/projects/${projectId}/feasibility/cost-items`, {
      method: 'PUT',
      body: JSON.stringify(items),
    }),
  replaceFeasibilityCashFlow: (projectId: string, rows: Array<Record<string, unknown>>) =>
    request<Array<Record<string, unknown>>>(`/projects/${projectId}/feasibility/cashflow`, {
      method: 'PUT',
      body: JSON.stringify(rows),
    }),
  recalculateFeasibility: (projectId: string) =>
    request<Record<string, unknown>>(`/projects/${projectId}/feasibility/recalculate`, {
      method: 'POST',
    }),
  createFeasibilityScenario: (
    projectId: string,
    input: {
      name: string;
      priceVariationPct: string;
      costVariationPct: string;
      salesVelocityVariationPct: string;
    },
  ) =>
    request<Record<string, unknown>>(`/projects/${projectId}/feasibility/scenarios`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  deleteFeasibilityScenario: (projectId: string, scenarioId: string) =>
    request<void>(`/projects/${projectId}/feasibility/scenarios/${scenarioId}`, {
      method: 'DELETE',
    }),
  // Importador Santa Isabel (multipart upload)
  importSantaIsabelPreview: async (projectId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const accessToken = auth?.getAccessToken() ?? null;
    const res = await fetch(`${API_URL}/projects/${projectId}/imports/santa-isabel/preview`, {
      method: 'POST',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(res.status, body.message ?? res.statusText, body);
    }
    return res.json() as Promise<Record<string, unknown>>;
  },
  importSantaIsabelCommit: (projectId: string, preview: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/projects/${projectId}/imports/santa-isabel/commit`, {
      method: 'POST',
      body: JSON.stringify({ preview }),
    }),

  // Reports / Export (retornan Response crudo — son descargas de archivo)
  exportBudgetCsv: (projectId: string): Promise<Response> =>
    fetch(`${API_URL}/projects/${projectId}/reports/budget.csv`, {
      headers: { Authorization: `Bearer ${auth?.getAccessToken() ?? ''}` },
    }),
  exportCashflowCsv: (projectId: string): Promise<Response> =>
    fetch(`${API_URL}/projects/${projectId}/reports/cashflow.csv`, {
      headers: { Authorization: `Bearer ${auth?.getAccessToken() ?? ''}` },
    }),

  exportHtmlReport: (projectId: string): Promise<Response> =>
    fetch(`${API_URL}/projects/${projectId}/reports/presentation.html`, {
      headers: { Authorization: `Bearer ${auth?.getAccessToken() ?? ''}` },
    }),

  exportBudgetHtml: (projectId: string): Promise<Response> =>
    fetch(`${API_URL}/projects/${projectId}/reports/budget.html`, {
      headers: { Authorization: `Bearer ${auth?.getAccessToken() ?? ''}` },
    }),

  exportScheduleHtml: (projectId: string): Promise<Response> =>
    fetch(`${API_URL}/projects/${projectId}/reports/schedule.html`, {
      headers: { Authorization: `Bearer ${auth?.getAccessToken() ?? ''}` },
    }),

  listResources: () => request<Array<Record<string, unknown>>>('/budget/resources'),
  createResource: (input: ResourceInput) =>
    request<Record<string, unknown>>('/budget/resources', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  seedColombianResources: () =>
    request<{ created: number; updated: number; total: number }>(
      '/budget/resources/seed-colombian',
      {
        method: 'POST',
      },
    ),
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
  getAPUBreakdown: (apuId: string) =>
    request<Record<string, unknown>>(`/budget/apus/${apuId}/breakdown`),

  // ── Logbook ──────────────────────────────────────────────────────────────
  listLogbook: (projectId: string, params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<Record<string, unknown>>(`/projects/${projectId}/logbook${qs}`);
  },
  getLogbookStats: (projectId: string) =>
    request<Record<string, unknown>>(`/projects/${projectId}/logbook/stats`),
  getLogbookEntry: (projectId: string, id: string) =>
    request<Record<string, unknown>>(`/projects/${projectId}/logbook/${id}`),
  createLogbookEntry: (projectId: string, body: unknown) =>
    request<Record<string, unknown>>(`/projects/${projectId}/logbook`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateLogbookEntry: (projectId: string, id: string, body: unknown) =>
    request<Record<string, unknown>>(`/projects/${projectId}/logbook/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteLogbookEntry: (projectId: string, id: string) =>
    request<{ ok: boolean }>(`/projects/${projectId}/logbook/${id}`, { method: 'DELETE' }),

  // ── Admin ──────────────────────────────────────────────────────────────────
  getAdminOrg: () => request<Record<string, unknown>>('/admin/organization'),
  updateAdminOrg: (body: unknown) =>
    request<Record<string, unknown>>('/admin/organization', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  getAdminParams: () => request<Record<string, unknown>>('/admin/params'),
  updateAdminParams: (body: unknown) =>
    request<Record<string, unknown>>('/admin/params', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  listAdminUsers: () => request<Array<Record<string, unknown>>>('/admin/users'),
  createAdminUser: (body: unknown) =>
    request<Record<string, unknown>>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateAdminUser: (id: string, body: unknown) =>
    request<Record<string, unknown>>(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  resetAdminPassword: (id: string, body: unknown) =>
    request<{ ok: boolean }>(`/admin/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getUserProjects: (id: string) =>
    request<Array<Record<string, unknown>>>(`/admin/users/${id}/projects`),

  getProjectMembers: (projectId: string) =>
    request<Array<Record<string, unknown>>>(`/admin/projects/${projectId}/members`),
  addProjectMember: (projectId: string, body: unknown) =>
    request<Record<string, unknown>>(`/admin/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  removeProjectMember: (projectId: string, userId: string) =>
    request<{ ok: boolean }>(`/admin/projects/${projectId}/members/${userId}`, {
      method: 'DELETE',
    }),

  getAuditLogs: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<Record<string, unknown>>(`/admin/audit${qs}`);
  },
  getAuditStats: () => request<Record<string, unknown>>('/admin/audit/stats'),

  // ── Drive / Import-Export ─────────────────────────────────────────────────
  getDriveStatus: () =>
    request<{ oauthConfigured: boolean; exportAvailable: boolean; importAvailable: boolean }>(
      '/drive/status',
    ),

  // Export downloads (returns raw Response for file download)
  driveExportBudgetCsv: (projectId: string): Promise<Response> =>
    fetch(`${API_URL}/drive/export/${projectId}/budget.csv`, {
      headers: { Authorization: `Bearer ${auth?.getAccessToken() ?? ''}` },
    }),
  driveExportFeasibilityCsv: (projectId: string): Promise<Response> =>
    fetch(`${API_URL}/drive/export/${projectId}/feasibility.csv`, {
      headers: { Authorization: `Bearer ${auth?.getAccessToken() ?? ''}` },
    }),
  driveExportCashflowCsv: (projectId: string): Promise<Response> =>
    fetch(`${API_URL}/drive/export/${projectId}/cashflow.csv`, {
      headers: { Authorization: `Bearer ${auth?.getAccessToken() ?? ''}` },
    }),
  driveExportProjectJson: (projectId: string): Promise<Response> =>
    fetch(`${API_URL}/drive/export/${projectId}/project.json`, {
      headers: { Authorization: `Bearer ${auth?.getAccessToken() ?? ''}` },
    }),

  // Import (multipart upload)
  driveImportBudget: async (projectId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const accessToken = auth?.getAccessToken() ?? null;
    const res = await fetch(`${API_URL}/drive/import/${projectId}/budget`, {
      method: 'POST',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(
        res.status,
        (body as Record<string, string>).message ?? res.statusText,
        body,
      );
    }
    return res.json() as Promise<{ imported: number; skipped: number; errors: string[] }>;
  },
  driveImportFeasibilityCosts: async (projectId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const accessToken = auth?.getAccessToken() ?? null;
    const res = await fetch(`${API_URL}/drive/import/${projectId}/feasibility-costs`, {
      method: 'POST',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(
        res.status,
        (body as Record<string, string>).message ?? res.statusText,
        body,
      );
    }
    return res.json() as Promise<{ imported: number; errors: string[] }>;
  },
};
