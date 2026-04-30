// LOCATION: frontend/lib/api.ts

import type {
  Debate, DebateConfig, DebateSummary,
  ApiResponse, PaginatedResponse,
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
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new ApiError(res.status, body.detail ?? 'Request failed')
  }
  return res.json()
}

export const api = {
  debates: {
    create: (config: DebateConfig, token?: string): Promise<ApiResponse<Debate>> =>
      request('/debates', {
        method: 'POST',
        body: JSON.stringify({ config }),
      }, token),

    get: (id: string, token?: string): Promise<ApiResponse<Debate>> =>
      request(`/debates/${id}`, {}, token),

    list: (page = 1, limit = 20, token?: string): Promise<PaginatedResponse<DebateSummary>> =>
      request(`/debates?page=${page}&limit=${limit}`, {}, token),

    delete: (id: string, token?: string): Promise<void> =>
      request(`/debates/${id}`, { method: 'DELETE' }, token),

    pause: (id: string, token?: string): Promise<ApiResponse<Debate>> =>
      request(`/debates/${id}/pause`, { method: 'POST' }, token),

    resume: (id: string, token?: string): Promise<ApiResponse<Debate>> =>
      request(`/debates/${id}/resume`, { method: 'POST' }, token),

    interrupt: (debateId: string, message: string, redirectType: string, token?: string): Promise<ApiResponse<Debate>> =>
      request(`/debates/${debateId}/interrupt`, {
        method: 'POST',
        body: JSON.stringify({ debate_id: debateId, message, redirect_type: redirectType }),
      }, token),

    forceConsensus: (id: string, token?: string): Promise<ApiResponse<Debate>> =>
      request(`/debates/${id}/force-consensus`, { method: 'POST' }, token),

    checkpoints: (id: string, token?: string): Promise<ApiResponse<unknown[]>> =>
      request(`/debates/${id}/checkpoints`, {}, token),

    // Used by usecheckpoints.ts
    fork: (debateId: string, checkpointId: string, newTopic?: string, token?: string): Promise<ApiResponse<{ newDebateId: string }>> =>
      request(`/debates/${debateId}/checkpoints/${checkpointId}/fork`, {
        method: 'POST',
        body: JSON.stringify({ new_topic: newTopic }),
      }, token),
  },

  health: (): Promise<{ status: string }> =>
    request('/health'),
}

export function createDebateSocket(debateId: string): WebSocket {
  const wsBase = BASE_URL.replace(/^http/, 'ws')
  return new WebSocket(`${wsBase}/ws/debates/${debateId}`)
}

export { ApiError }