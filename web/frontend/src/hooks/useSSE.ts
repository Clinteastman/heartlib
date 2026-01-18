import { useEffect, useRef, useCallback } from 'react'

interface SSEOptions {
  onMessage: (data: unknown) => void
  onError?: (error: Event) => void
  onOpen?: () => void
}

export function useSSE(url: string | null, options: SSEOptions) {
  const eventSourceRef = useRef<EventSource | null>(null)
  const { onMessage, onError, onOpen } = options

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!url) {
      disconnect()
      return
    }

    // Create new EventSource
    const eventSource = new EventSource(url)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      onOpen?.()
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessage(data)
      } catch (e) {
        console.error('Failed to parse SSE message:', e)
      }
    }

    eventSource.onerror = (error) => {
      onError?.(error)
      // EventSource will automatically try to reconnect
    }

    return () => {
      eventSource.close()
    }
  }, [url, onMessage, onError, onOpen, disconnect])

  return { disconnect }
}
