// LOCATION: frontend/store/debateStore.ts
// Zustand global state — single source of truth for active debate UI

import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import type { Debate, DebateTurn, AgentRole, StreamingState } from '@/lib/types'

interface DebateUIState {
  // ── Active debate ─────────────────────────────────────────
  activeDebate: Debate | null
  setActiveDebate: (d: Debate | null) => void
  patchDebate: (patch: Partial<Debate>) => void

  // ── Streaming ─────────────────────────────────────────────
  streaming: StreamingState
  setStreaming: (s: Partial<StreamingState>) => void
  resetStreaming: () => void

  // ── Transcript ────────────────────────────────────────────
  appendTurn: (turn: DebateTurn) => void

  // ── UI selections ─────────────────────────────────────────
  selectedTurnId: string | null
  setSelectedTurnId: (id: string | null) => void

  activePanels: {
    scoring:    boolean
    graph:      boolean
    timeline:   boolean
    agentConfig: boolean
  }
  togglePanel: (panel: keyof DebateUIState['activePanels']) => void

  // ── Interrupt ─────────────────────────────────────────────
  interruptModalOpen: boolean
  setInterruptModalOpen: (v: boolean) => void

  // ── Approval gate ─────────────────────────────────────────
  pendingApproval: PendingApproval | null
  setPendingApproval: (a: PendingApproval | null) => void

  // ── Graph ─────────────────────────────────────────────────
  activeGraphNodeId: string | null
  setActiveGraphNodeId: (id: string | null) => void

  // ── Checkpoints ───────────────────────────────────────────
  forkModalOpen: boolean
  forkFromRound: number | null
  openForkModal: (round: number) => void
  closeForkModal: () => void

  // ── Connection ────────────────────────────────────────────
  wsStatus: 'connecting' | 'open' | 'closed' | 'error'
  setWsStatus: (s: DebateUIState['wsStatus']) => void

  // ── Notifications ─────────────────────────────────────────
  notifications: Notification[]
  addNotification: (n: Omit<Notification, 'id' | 'ts'>) => void
  removeNotification: (id: string) => void
}

interface PendingApproval {
  agentRole: AgentRole
  tool: string
  description: string
  input: Record<string, unknown>
  approveCallback: () => void
  rejectCallback: () => void
}

interface Notification {
  id: string
  ts: number
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message?: string
}

const STREAMING_DEFAULTS: StreamingState = {
  agentRole:  undefined,
  thought:    '',
  speech:     '',
  isThinking: false,
  isSpeaking: false,
}

let notifCounter = 0

export const useDebateStore = create<DebateUIState>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // ── Active debate ───────────────────────────────────────
      activeDebate: null,
      setActiveDebate: (d) => set({ activeDebate: d }),
      patchDebate: (patch) =>
        set((s) => ({
          activeDebate: s.activeDebate ? { ...s.activeDebate, ...patch } : s.activeDebate,
        })),

      // ── Streaming ──────────────────────────────────────────
      streaming: { ...STREAMING_DEFAULTS },
      setStreaming: (s) =>
        set((state) => ({ streaming: { ...state.streaming, ...s } })),
      resetStreaming: () => set({ streaming: { ...STREAMING_DEFAULTS } }),

      // ── Transcript ─────────────────────────────────────────
      appendTurn: (turn) =>
        set((s) => ({
          activeDebate: s.activeDebate
            ? { ...s.activeDebate, transcript: [...s.activeDebate.transcript, turn] }
            : s.activeDebate,
        })),

      // ── UI selections ──────────────────────────────────────
      selectedTurnId: null,
      setSelectedTurnId: (id) => set({ selectedTurnId: id }),

      activePanels: {
        scoring:     true,
        graph:       false,
        timeline:    false,
        agentConfig: false,
      },
      togglePanel: (panel) =>
        set((s) => ({
          activePanels: { ...s.activePanels, [panel]: !s.activePanels[panel] },
        })),

      // ── Interrupt ──────────────────────────────────────────
      interruptModalOpen: false,
      setInterruptModalOpen: (v) => set({ interruptModalOpen: v }),

      // ── Approval gate ──────────────────────────────────────
      pendingApproval: null,
      setPendingApproval: (a) => set({ pendingApproval: a }),

      // ── Graph ──────────────────────────────────────────────
      activeGraphNodeId: null,
      setActiveGraphNodeId: (id) => set({ activeGraphNodeId: id }),

      // ── Checkpoints ────────────────────────────────────────
      forkModalOpen: false,
      forkFromRound: null,
      openForkModal: (round) => set({ forkModalOpen: true, forkFromRound: round }),
      closeForkModal: () => set({ forkModalOpen: false, forkFromRound: null }),

      // ── Connection ─────────────────────────────────────────
      wsStatus: 'closed',
      setWsStatus: (s) => set({ wsStatus: s }),

      // ── Notifications ──────────────────────────────────────
      notifications: [],
      addNotification: (n) => {
        const id = `notif-${++notifCounter}`
        const notif: Notification = { ...n, id, ts: Date.now() }
        set((s) => ({ notifications: [notif, ...s.notifications].slice(0, 5) }))
        // Auto-dismiss after 5s unless it's an error
        if (n.type !== 'error') {
          setTimeout(() => get().removeNotification(id), 5000)
        }
      },
      removeNotification: (id) =>
        set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
    })),
    { name: 'WarroomDebateStore' }
  )
)

// ── Selector hooks (avoid re-renders) ────────────────────────
export const useActiveDebate    = () => useDebateStore((s) => s.activeDebate)
export const useStreaming        = () => useDebateStore((s) => s.streaming)
export const useActivePanels    = () => useDebateStore((s) => s.activePanels)
export const useWsStatus        = () => useDebateStore((s) => s.wsStatus)
export const useNotifications   = () => useDebateStore((s) => s.notifications)
export const usePendingApproval = () => useDebateStore((s) => s.pendingApproval)