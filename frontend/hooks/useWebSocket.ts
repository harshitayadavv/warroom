'use client'
import { useEffect, useRef, useCallback, useState } from 'react'
import { createDebateSocket } from '@/lib/api'
import type { WSEvent, WSEventType } from '@/lib/types'

type Handler = (payload: unknown) => void

interface UseWebSocketOptions {
  onOpen?: () => void
  onClose?: () => void
  onError?: (e: Event) => void
  autoReconnect?: boolean
  reconnectDelay?: number
}

export function useDebateSocket(
  debateId: string | null,
  handlers: Partial<Record<WSEventType, Handler>>,
  options: UseWebSocketOptions = {},
) {
  const {
    onOpen,
    onClose,
    onError,
    autoReconnect = true,
    reconnectDelay = 3000,
  } = options

  const wsRef = useRef<WebSocket | null>(null)
  const handlersRef = useRef(handlers)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [connectionState, setConnectionState] = useState<'connecting' | 'open' | 'closed' | 'error'>('closed')
  const shouldReconnect = useRef(true)

  // Keep handlers ref up-to-date without re-connecting
  useEffect(() => { handlersRef.current = handlers }, [handlers])

  const connect = useCallback(() => {
    if (!debateId) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setConnectionState('connecting')
    const ws = createDebateSocket(debateId)
    wsRef.current = ws

    ws.onopen = () => {
      setConnectionState('open')
      onOpen?.()
    }

    ws.onmessage = (e: MessageEvent) => {
      try {
        const event: WSEvent = JSON.parse(e.data)
        const handler = handlersRef.current[event.type]
        handler?.(event.payload)
      } catch {
        console.warn('[WS] Failed to parse message', e.data)
      }
    }

    ws.onerror = (e) => {
      setConnectionState('error')
      onError?.(e)
    }

    ws.onclose = () => {
      setConnectionState('closed')
      onClose?.()
      if (autoReconnect && shouldReconnect.current) {
        reconnectTimerRef.current = setTimeout(connect, reconnectDelay)
      }
    }
  }, [debateId, onOpen, onClose, onError, autoReconnect, reconnectDelay])

  useEffect(() => {
    shouldReconnect.current = true
    connect()
    return () => {
      shouldReconnect.current = false
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  const disconnect = useCallback(() => {
    shouldReconnect.current = false
    wsRef.current?.close()
  }, [])

  return { connectionState, send, disconnect, reconnect: connect }
}