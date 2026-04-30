// LOCATION: frontend/lib/constants.ts

import type { AgentRole } from './types'

// ── Role colors ───────────────────────────────────────────────────────────────

export const ROLE_COLORS: Record<AgentRole, { primary: string; glow: string; dim: string }> = {
  proponent:    { primary: '#00ff88', glow: '#00ff8844', dim: '#00ff8811' },
  opponent:     { primary: '#ff3c3c', glow: '#ff3c3c44', dim: '#ff3c3c11' },
  fact_checker: { primary: '#f5a623', glow: '#f5a62344', dim: '#f5a62311' },
  moderator:    { primary: '#1e90ff', glow: '#1e90ff44', dim: '#1e90ff11' },
}

// ── Graph node ID constants ───────────────────────────────────────────────────

export const GRAPH_NODES = {
  START:        'start',
  ROUND_START:  'round_start',
  PROPONENT:    'proponent',
  OPPONENT:     'opponent',
  FACT_CHECKER: 'fact_checker',
  MODERATOR:    'moderator',
  TOOL_ROUTER:  'tool_router',
  WEB_SEARCH:   'web_search',
  PYTHON_REPL:  'python_repl',
  HUMAN:        'human',
  CONSENSUS:    'consensus',
  JUDGE:        'judge',
  END:          'end',
} as const

// ── Debate mode options ───────────────────────────────────────────────────────

export const DEBATE_MODES = [
  { value: 'adversarial',   label: 'Adversarial',   desc: 'Agents argue opposing sides aggressively'  },
  { value: 'collaborative', label: 'Collaborative', desc: 'Agents work together to find truth'         },
  { value: 'socratic',      label: 'Socratic',      desc: 'Agents question each other to find clarity' },
] as const

// ── Default agent configs ─────────────────────────────────────────────────────

export const DEFAULT_AGENTS = [
  { role: 'proponent',    name: 'AXIOM',   model: 'llama-3.3-70b-versatile', temperature: 0.8, expertiseLevel: 4, temperament: 'aggressive' },
  { role: 'opponent',     name: 'REFUTE',  model: 'llama-3.3-70b-versatile', temperature: 0.8, expertiseLevel: 4, temperament: 'aggressive' },
  { role: 'fact_checker', name: 'VERITAS', model: 'llama-3.3-70b-versatile', temperature: 0.3, expertiseLevel: 5, temperament: 'analytical' },
  { role: 'moderator',    name: 'ARBITER', model: 'llama-3.3-70b-versatile', temperature: 0.4, expertiseLevel: 5, temperament: 'diplomatic' },
] as const

// ── Max rounds options ────────────────────────────────────────────────────────

export const MAX_ROUNDS_OPTIONS = [1, 2, 3, 5, 7, 10]

// ── Consensus threshold options ───────────────────────────────────────────────

export const CONSENSUS_THRESHOLD_OPTIONS = [
  { value: 0.6,  label: 'Easy (60%)'   },
  { value: 0.75, label: 'Medium (75%)' },
  { value: 0.85, label: 'Hard (85%)'   },
  { value: 0.95, label: 'Expert (95%)' },
]