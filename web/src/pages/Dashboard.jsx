import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div
      className="toast"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        background: 'var(--c-surface-raised)',
        border: '1px solid rgba(52,211,153,0.3)',
        borderRadius: 10,
        padding: '12px 18px',
        fontSize: 14,
        color: '#34D399',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        zIndex: 100,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="#34D399" strokeWidth="1.5" />
        <path d="M5 8l2 2 4-4" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {message}
    </div>
  )
}

export function Dashboard() {
  const { user } = useAuth()
  const [streamKey, setStreamKey] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    api.get('/channels/me/stream-key')
      .then((r) => setStreamKey(r.data.streamKey))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function copy() {
    navigator.clipboard.writeText(streamKey)
    setToast('Stream key copiada al portapapeles')
  }

  async function reset() {
    if (!window.confirm('La stream key anterior dejará de funcionar inmediatamente. ¿Continuar?')) return
    setResetting(true)
    try {
      const { data } = await api.post('/channels/me/reset-key')
      setStreamKey(data.streamKey)
      setShow(false)
      setToast('Stream key regenerada correctamente')
    } catch {
      setToast('Error al regenerar la stream key')
    } finally {
      setResetting(false)
    }
  }

  const maskedKey = streamKey ? '•'.repeat(8) + streamKey.slice(-8) : ''

  return (
    <main
      className="page-enter"
      style={{ maxWidth: 800, marginInline: 'auto', padding: '40px 24px' }}
    >
      {/* Page title */}
      <div style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontFamily: "'Syne', sans-serif",
            fontWeight: 800,
            fontSize: 28,
            margin: '0 0 6px',
            color: 'var(--c-text)',
          }}
        >
          Mi Canal
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--c-muted)' }}>
          Gestiona tu stream y configura OBS
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* OBS Setup card */}
        <div className="card" style={{ padding: '24px' }}>
          <h2
            style={{
              fontFamily: "'Syne', sans-serif",
              fontWeight: 700,
              fontSize: 16,
              margin: '0 0 20px',
              color: 'var(--c-text)',
            }}
          >
            Configuración de OBS
          </h2>

          {/* RTMP Server */}
          <div style={{ marginBottom: 16 }}>
            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--c-muted)',
                margin: '0 0 6px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Servidor RTMP
            </p>
            <div
              className="code-block"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
            >
              <span>rtmp://localhost/live</span>
              <button
                className="btn btn-ghost"
                style={{ padding: '5px 10px', fontSize: 12 }}
                onClick={() => {
                  navigator.clipboard.writeText('rtmp://localhost/live')
                  setToast('URL copiada')
                }}
              >
                Copiar
              </button>
            </div>
          </div>

          {/* Stream key */}
          <div>
            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--c-muted)',
                margin: '0 0 6px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Stream Key
            </p>
            {loading ? (
              <div className="skeleton" style={{ height: 44 }} />
            ) : (
              <div
                className="code-block"
                style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
              >
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {show ? streamKey : maskedKey}
                </span>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: '5px 10px', fontSize: 12 }}
                    onClick={() => setShow((s) => !s)}
                  >
                    {show ? 'Ocultar' : 'Ver'}
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ padding: '5px 12px', fontSize: 12 }}
                    onClick={copy}
                  >
                    Copiar
                  </button>
                </div>
              </div>
            )}
            <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--c-muted)' }}>
              Mantén esta clave en secreto. Nadie debe conocerla salvo tú.
            </p>
          </div>
        </div>

        {/* Steps card */}
        <div className="card" style={{ padding: '24px' }}>
          <h2
            style={{
              fontFamily: "'Syne', sans-serif",
              fontWeight: 700,
              fontSize: 16,
              margin: '0 0 20px',
              color: 'var(--c-text)',
            }}
          >
            Cómo empezar a transmitir
          </h2>

          <ol style={{ margin: 0, padding: '0 0 0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              'Abre OBS Studio',
              'Ve a Configuración → Emisión → Servicio: Personalizado',
              'Pega el servidor RTMP y tu stream key',
              'Haz clic en Iniciar emisión',
              `Tu canal estará en vivo en: /canal/${user?.username?.toLowerCase()}`,
            ].map((step, i) => (
              <li key={i} style={{ fontSize: 14, color: 'var(--c-muted)', lineHeight: 1.5 }}>
                <span style={{ color: 'var(--c-accent)', fontWeight: 600 }}>
                  {i + 1}.{' '}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        {/* Danger zone */}
        <div
          className="card"
          style={{
            padding: '24px',
            borderColor: 'rgba(239,68,68,0.15)',
          }}
        >
          <h2
            style={{
              fontFamily: "'Syne', sans-serif",
              fontWeight: 700,
              fontSize: 16,
              margin: '0 0 8px',
              color: 'var(--c-live)',
            }}
          >
            Zona de peligro
          </h2>
          <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--c-muted)' }}>
            Regenerar la stream key invalidará la clave actual. Si OBS está transmitiendo, el stream se cortará.
          </p>
          <button
            className="btn btn-danger"
            onClick={reset}
            disabled={resetting || loading}
          >
            {resetting ? 'Regenerando...' : 'Regenerar stream key'}
          </button>
        </div>
      </div>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </main>
  )
}
