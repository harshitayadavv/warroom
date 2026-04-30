'use client'
// LOCATION: frontend/hooks/usecheckpoints.ts

import { useState, useCallback } from 'react'
import { api } from '@/lib/api'
import type { Checkpoint } from '@/lib/types'

export function useCheckpoints(debateId: string, token?: string | null) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const fetchCheckpoints = useCallback(async () => {
    if (!debateId) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.debates.checkpoints(debateId, token ?? undefined)
      const data = (res?.data ?? []) as Checkpoint[]
      setCheckpoints(data)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load checkpoints')
    } finally {
      setLoading(false)
    }
  }, [debateId, token])

  const forkCheckpoint = useCallback(async (
    checkpointId: string,
    newTopic?: string,
  ): Promise<string | null> => {
    try {
      const res = await api.debates.fork(debateId, checkpointId, newTopic, token ?? undefined)
      return res?.data?.newDebateId ?? null
    } catch (e: any) {
      setError(e?.message ?? 'Failed to fork checkpoint')
      return null
    }
  }, [debateId, token])

  return { checkpoints, loading, error, fetchCheckpoints, forkCheckpoint }
}