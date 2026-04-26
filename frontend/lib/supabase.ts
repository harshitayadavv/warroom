// LOCATION: frontend/lib/supabase.ts
// Supabase client for persistent storage of debates, transcripts, agent personalities

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── Typed DB helpers ──────────────────────────────────────────

export type Tables = {
  debates: {
    id: string
    topic: string
    status: string
    config: Record<string, unknown>
    consensus_score: number
    current_round: number
    max_rounds: number
    winner_role: string | null
    summary: string | null
    tags: string[]
    created_at: string
    updated_at: string
  }
  debate_turns: {
    id: string
    debate_id: string
    round: number
    agent_role: string
    agent_name: string
    content: string
    tool_calls: Record<string, unknown>[]
    score: Record<string, unknown>
    embedding: number[] | null
    is_interrupt: boolean
    created_at: string
  }
  agent_personalities: {
    id: string
    name: string
    role: string
    system_prompt: string
    temperament: string
    expertise_level: number
    model: string
    temperature: number
    is_default: boolean
    created_at: string
  }
  checkpoints: {
    id: string
    debate_id: string
    round: number
    state_snapshot: Record<string, unknown>
    label: string | null
    created_at: string
  }
}

// ── Debate queries ────────────────────────────────────────────

export const db = {
  debates: {
    list: (limit = 20, offset = 0) =>
      supabase
        .from('debates')
        .select('id,topic,status,consensus_score,current_round,max_rounds,winner_role,tags,created_at,updated_at')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),

    get: (id: string) =>
      supabase.from('debates').select('*').eq('id', id).single(),

    create: (data: Partial<Tables['debates']>) =>
      supabase.from('debates').insert(data).select().single(),

    update: (id: string, data: Partial<Tables['debates']>) =>
      supabase.from('debates').update(data).eq('id', id).select().single(),

    delete: (id: string) =>
      supabase.from('debates').delete().eq('id', id),
  },

  turns: {
    list: (debateId: string) =>
      supabase
        .from('debate_turns')
        .select('*')
        .eq('debate_id', debateId)
        .order('created_at', { ascending: true }),

    insert: (turn: Partial<Tables['debate_turns']>) =>
      supabase.from('debate_turns').insert(turn).select().single(),
  },

  checkpoints: {
    list: (debateId: string) =>
      supabase
        .from('checkpoints')
        .select('*')
        .eq('debate_id', debateId)
        .order('round', { ascending: true }),

    get: (id: string) =>
      supabase.from('checkpoints').select('*').eq('id', id).single(),

    create: (data: Partial<Tables['checkpoints']>) =>
      supabase.from('checkpoints').insert(data).select().single(),
  },

  personalities: {
    list: () =>
      supabase.from('agent_personalities').select('*').order('created_at', { ascending: false }),

    get: (id: string) =>
      supabase.from('agent_personalities').select('*').eq('id', id).single(),

    defaults: () =>
      supabase.from('agent_personalities').select('*').eq('is_default', true),
  },
}