import { useEffect, useState } from 'react'
import { ChannelCard, ChannelCardSkeleton } from '../components/ChannelCard'
import api from '../api/axios'

export function Home() {
  const [channels, setChannels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/channels/live')
      .then((r) => setChannels(r.data))
      .catch(() => setError('No se pudo conectar con el servidor'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="page-enter" style={{ minHeight: 'calc(100dvh - 60px)' }}>
      {/* Hero */}
      <div
        className="bg-grid hero-padding"
        style={{
          padding: '64px 24px 56px',
          textAlign: 'center',
          position: 'relative',
          borderBottom: '1px solid var(--c-border)',
        }}
      >
        {/* Glow behind heading */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 400,
            height: 200,
            background: 'radial-gradient(ellipse, rgba(249,115,22,0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <h1
          style={{
            fontFamily: "'Syne', sans-serif",
            fontWeight: 800,
            fontSize: 'clamp(32px, 6vw, 60px)',
            margin: '0 0 16px',
            background: 'linear-gradient(135deg, var(--c-text) 30%, var(--c-muted) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}
        >
          Transmite. Conecta.
          <br />
          <span
            style={{
              background: 'linear-gradient(135deg, var(--c-accent), #fb923c)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            En tiempo real.
          </span>
        </h1>
        <p
          style={{
            fontSize: 16,
            color: 'var(--c-muted)',
            margin: 0,
            maxWidth: 480,
            marginInline: 'auto',
            lineHeight: 1.6,
          }}
        >
          Tu plataforma de streaming autoalojada. Sin latencia de terceros, sin costos de video.
        </p>
      </div>

      {/* Live channels */}
      <section className="section-padding" style={{ maxWidth: 1280, marginInline: 'auto', padding: '40px 24px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 24,
          }}
        >
          {!loading && channels.length > 0 && <span className="live-dot" />}
          <h2
            style={{
              fontFamily: "'Syne', sans-serif",
              fontWeight: 700,
              fontSize: 18,
              margin: 0,
              color: 'var(--c-text)',
            }}
          >
            {loading ? 'Canales en vivo' : channels.length > 0 ? `${channels.length} canal${channels.length !== 1 ? 'es' : ''} en vivo` : 'Sin transmisiones activas'}
          </h2>
        </div>

        {error && (
          <div
            style={{
              padding: '16px 20px',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 10,
              color: 'var(--c-live)',
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        {loading && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 16,
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <ChannelCardSkeleton key={i} />
            ))}
          </div>
        )}

        {!loading && !error && channels.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '80px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none" opacity="0.18">
              <rect x="7" y="12" width="42" height="30" rx="5" stroke="#F97316" strokeWidth="2" />
              <circle cx="28" cy="27" r="9" stroke="#F97316" strokeWidth="2" />
              <path d="M12 46h32" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <div>
              <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: 'var(--c-text)' }}>
                Nadie está transmitiendo ahora
              </p>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--c-muted)' }}>
                Vuelve más tarde o inicia tu propia transmisión desde OBS.
              </p>
            </div>
          </div>
        )}

        {!loading && !error && channels.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 16,
            }}
          >
            {channels.map((ch) => (
              <ChannelCard key={ch.id} channel={ch} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
