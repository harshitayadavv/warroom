// ═══════════════════════════════════════════════════════════
// WARROOM — API Client
// ═══════════════════════════════════════════════════════════

import type {
  Debate,
  DebateConfig,
  DebateSummary,
  InterruptRequest,
  ApiResponse,
  PaginatedResponse,
} from './types'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new ApiError(res.status, body.detail ?? 'Request failed')
  }
  return res.json()
}

// ── Debate Endpoints ──────────────────────────────────────────

export const api = {
  debates: {
    create: (config: DebateConfig): Promise<ApiResponse<Debate>> =>
      request('/debates', { method: 'POST', body: JSON.stringify({ config }) }),

    get: (id: string): Promise<ApiResponse<Debate>> =>
      request(`/debates/${id}`),

    list: (page = 1, limit = 20): Promise<PaginatedResponse<DebateSummary>> =>
      request(`/debates?page=${page}&limit=${limit}`),

    delete: (id: string): Promise<void> =>
      request(`/debates/${id}`, { method: 'DELETE' }),

    pause: (id: string): Promise<ApiResponse<Debate>> =>
      request(`/debates/${id}/pause`, { method: 'POST' }),

    resume: (id: string): Promise<ApiResponse<Debate>> =>
      request(`/debates/${id}/resume`, { method: 'POST' }),

    interrupt: (payload: InterruptRequest): Promise<ApiResponse<Debate>> =>
      request(`/debates/${payload.debateId}/interrupt`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    forceConsensus: (id: string): Promise<ApiResponse<Debate>> =>
      request(`/debates/${id}/force-consensus`, { method: 'POST' }),
  },

  agents: {
    templates: (): Promise<ApiResponse<import('./types').AgentConfig[]>> =>
      request('/agents/templates'),
  },

  health: (): Promise<{ status: string; version: string }> =>
    request('/health'),
}

// ── WebSocket Factory ─────────────────────────────────────────

export function createDebateSocket(debateId: string): WebSocket {
  const wsBase = BASE_URL.replace(/^http/, 'ws')
  return new WebSocket(`${wsBase}/ws/debates/${debateId}`)
}

export { ApiError }