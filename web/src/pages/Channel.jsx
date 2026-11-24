import { useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { VideoPlayer } from '../components/VideoPlayer'
import { Chat } from '../components/Chat'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

export function Channel() {
  const { slug } = useParams()
  const { user } = useAuth()
  const [channel, setChannel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get(`/channels/${slug}`)
      .then((r) => setChannel(r.data))
      .catch(() => setError('Canal no encontrado'))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div
        style={{
          minHeight: 'calc(100dvh - 60px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div className="spinner" />
      </div>
    )
  }

  if (error || !channel) {
    return (
      <div
        style={{
          minHeight: 'calc(100dvh - 60px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: '40px 24px',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Canal no encontrado</p>
        <p style={{ color: 'var(--c-muted)', margin: 0, fontSize: 14 }}>
          El canal <strong>/{slug}</strong> no existe.
        </p>
      </div>
    )
  }

  return (
    <div className="channel-layout page-enter">

      {/* ── Main column ── */}
      <div className="channel-main">

        {/* Video */}
        <div style={{ background: '#000', flexShrink: 0 }}>
          <VideoPlayer streamKey={channel.slug} isLive={channel.isLive} />
        </div>

        {/* Channel info */}
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--c-border)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Avatar */}
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--c-accent), #fb923c)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: 700,
                color: '#fff',
                flexShrink: 0,
                fontFamily: "'Syne', sans-serif",
              }}
            >
              {channel.user?.username?.[0]?.toUpperCase()}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1
                  style={{
                    fontFamily: "'Syne', sans-serif",
                    fontWeight: 700,
                    fontSize: 16,
                    margin: 0,
                    color: 'var(--c-text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {channel.title || channel.user?.username}
                </h1>
                {channel.isLive && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      background: 'rgba(239,68,68,0.15)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      padding: '2px 7px 2px 5px',
                      borderRadius: 4,
                      flexShrink: 0,
                    }}
                  >
                    <span className="live-dot" />
                    <span
                      style={{
                        fontFamily: "'Syne', sans-serif",
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'var(--c-live)',
                        letterSpacing: '0.1em',
                      }}
                    >
                      EN VIVO
                    </span>
                  </div>
                )}
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--c-muted)' }}>
                {channel.user?.username}
              </p>
            </div>
          </div>
        </div>

        {/* Description — hidden on mobile to save space */}
        <div style={{ flex: 1, padding: '14px 16px', overflowY: 'auto' }}>
          <p style={{ fontSize: 13, color: 'var(--c-muted)', margin: 0 }}>
            {channel.isLive
              ? 'Stream en directo. Únete al chat para participar.'
              : 'El canal no está transmitiendo actualmente.'}
          </p>
        </div>
      </div>

      {/* ── Chat sidebar / section ── */}
      <div className="channel-sidebar">
        <Chat channelSlug={slug} username={user?.username} />
      </div>
    </div>
  )
}
