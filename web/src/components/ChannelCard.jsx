import { Link } from 'react-router-dom'

export function ChannelCard({ channel }) {
  const { slug, title, user, isLive, logoUrl } = channel

  return (
    <Link to={`/canal/${slug}`} style={{ textDecoration: 'none' }}>
      <article className="card card-interactive" style={{ overflow: 'hidden' }}>
        {/* Thumbnail placeholder */}
        <div
          style={{
            aspectRatio: '16/9',
            background: `linear-gradient(135deg, #0F1520 0%, #18243A 100%)`,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Grid texture on thumbnail */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />
          {logoUrl ? (
            <img src={logoUrl} alt={`Logo de ${user?.username || slug}`} loading="lazy"
              style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, objectFit: 'contain', padding: 16, boxSizing: 'border-box' }} />
          ) : <svg width="40" height="40" viewBox="0 0 40 40" fill="none" opacity="0.2">
            <rect x="4" y="8" width="32" height="22" rx="3" stroke="#F97316" strokeWidth="2" />
            <circle cx="20" cy="19" r="6" stroke="#F97316" strokeWidth="2" />
            <path d="M8 34h24M14 30l2-4M26 30l-2-4" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" />
          </svg>}

          {/* Live badge */}
          {isLive && (
            <div
              style={{
                position: 'absolute',
                top: 10,
                left: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(239,68,68,0.9)',
                backdropFilter: 'blur(4px)',
                padding: '3px 8px 3px 6px',
                borderRadius: 4,
              }}
            >
              <span className="live-dot" style={{ width: 6, height: 6 }} />
              <span
                style={{
                  fontFamily: "'Syne', sans-serif",
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#fff',
                  letterSpacing: '0.1em',
                }}
              >
                EN VIVO
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ padding: '12px 14px 14px' }}>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--c-text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title || user?.username}
          </p>
        </div>
      </article>
    </Link>
  )
}

export function ChannelCardSkeleton() {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="skeleton" style={{ aspectRatio: '16/9', borderRadius: 0 }} />
      <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="skeleton" style={{ height: 14, width: '70%' }} />
        <div className="skeleton" style={{ height: 12, width: '40%' }} />
      </div>
    </div>
  )
}
