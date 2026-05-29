import { useEffect, useState, useRef } from 'react'
import { io } from 'socket.io-client'

const COLORS = ['#F97316', '#38BDF8', '#34D399', '#A78BFA', '#FB7185', '#FBBF24']

function colorForUser(username) {
  let h = 0
  for (let i = 0; i < username.length; i++) h = (h * 31 + username.charCodeAt(i)) & 0xffffffff
  return COLORS[Math.abs(h) % COLORS.length]
}

export function Chat({ channelSlug, username }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [connected, setConnected] = useState(false)
  const socketRef = useRef(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    let active = true

    const s = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
    })
    socketRef.current = s

    s.on('connect', () => {
      if (!active) return
      setConnected(true)
      s.emit('join_channel', channelSlug)
    })
    s.on('disconnect', () => {
      if (!active) return
      setConnected(false)
    })
    s.on('new_message', (msg) => {
      if (!active) return
      setMessages((p) => [...p, msg])
    })
    s.on('channel_event', (e) => {
      if (!active || e.type !== 'stream_status') return
      setMessages((p) => [
        ...p,
        {
          id: Date.now().toString(),
          username: 'Sistema',
          text: e.isLive ? '🔴 El stream ha comenzado' : '⏹ El stream ha terminado',
          system: true,
        },
      ])
    })

    return () => {
      active = false
      s.disconnect()
    }
  }, [channelSlug])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function send() {
    const text = input.trim()
    if (!text || !socketRef.current?.connected) return
    socketRef.current.emit('send_message', {
      channel: channelSlug,
      text,
      username: username || 'Anónimo',
    })
    setInput('')
    inputRef.current?.focus()
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--c-surface)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--c-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "'Syne', sans-serif",
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: '0.05em',
            color: 'var(--c-text)',
          }}
        >
          CHAT
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: 'var(--c-muted)',
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: connected ? '#34D399' : 'var(--c-muted)',
              transition: 'background 0.3s',
            }}
          />
          {connected ? 'Conectado' : 'Reconectando...'}
        </div>
      </div>

      {/* Messages */}
      <div
        className="chat-scroll"
        style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}
      >
        {messages.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '32px 16px',
              color: 'var(--c-muted)',
              fontSize: 13,
            }}
          >
            Sé el primero en escribir...
          </div>
        )}
        {messages.map((m) =>
          m.system ? (
            <div
              key={m.id}
              style={{
                padding: '6px 16px',
                fontSize: 12,
                color: 'var(--c-muted)',
                textAlign: 'center',
                fontStyle: 'italic',
              }}
            >
              {m.text}
            </div>
          ) : (
            <div
              key={m.id}
              style={{
                padding: '3px 16px',
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              <span
                style={{
                  color: colorForUser(m.username),
                  fontWeight: 600,
                }}
              >
                {m.username}
              </span>
              <span style={{ color: 'var(--c-muted)', margin: '0 4px' }}>›</span>
              <span style={{ color: 'var(--c-text)' }}>{m.text}</span>
            </div>
          )
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: '12px',
          borderTop: '1px solid var(--c-border)',
          display: 'flex',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <input
          ref={inputRef}
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          maxLength={500}
          placeholder={connected ? 'Escribe un mensaje...' : 'Conectando...'}
          disabled={!connected}
          style={{ flex: 1 }}
        />
        <button
          className="btn btn-primary"
          onClick={send}
          disabled={!connected || !input.trim()}
          style={{ padding: '10px 14px', flexShrink: 0 }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M12 7L2 2l2 5-2 5 10-5z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  )
}
