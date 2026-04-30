// LOCATION: frontend/lib/supabase.ts

import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnon)

// ── Database table types ──────────────────────────────────────
// Used by timeline/debatetimeline.tsx, timeline/forkmodal.tsx,
// and hooks/usecheckpoints.ts

export type Tables = {
  debates: {
    id: string
    user_id: string
    topic: string
    status: string
    config: Record<string, unknown>
    transcript: unknown[]
    consensus_score: number
    current_round: number
    winner_role: string | null
    summary: string | null
    tags: string[]
    personal_context_detected: boolean
    created_at: string
    updated_at: string
  }
  checkpoints: {
    id: string
    debate_id: string
    round: number
    label: string
    state_snapshot: Record<string, unknown>
    created_at: string
  }
  turns: {
    id: string
    debate_id: string
    round: number
    agent_role: string
    agent_name: string
    content: string
    score: Record<string, unknown>
    tool_calls: unknown[]
    embedding: number[] | null
    is_interrupt: boolean
    created_at: string
  }
}