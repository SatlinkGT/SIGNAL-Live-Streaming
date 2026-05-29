import Hls from 'hls.js'
import { useEffect, useRef, useState } from 'react'

export function VideoPlayer({ streamKey, isLive }) {
  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const hlsUrl = `/hls/live/${streamKey}/index.m3u8`

  useEffect(() => {
    const video = videoRef.current
    if (!video || !isLive) return

    setError(null)
    setLoading(true)

    if (Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 30,
        lowLatencyMode: false,
      })
      hlsRef.current = hls
      hls.loadSource(hlsUrl)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false)
        video.play().catch(() => {
          video.muted = true
          video.play()
        })
      })
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad()
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError()
          else {
            setError('Error al cargar el stream')
            hls.destroy()
          }
        }
      })
      return () => { hls.destroy(); hlsRef.current = null }
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl
      video.play()
      setLoading(false)
    }
  }, [hlsUrl, isLive])

  if (!isLive) {
    return (
      <div
        style={{
          aspectRatio: '16/9',
          background: '#0A0F1A',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}
      >
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity="0.25">
          <rect x="6" y="10" width="36" height="26" rx="4" stroke="#F97316" strokeWidth="2" />
          <circle cx="24" cy="23" r="8" stroke="#F97316" strokeWidth="2" />
          <path d="M10 40h28M17 36l2-4M31 36l-2-4" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <p style={{ color: 'var(--c-muted)', fontSize: 14, margin: 0 }}>
          El canal no está transmitiendo ahora
        </p>
      </div>
    )
  }

  return (
    <div
      style={{
        aspectRatio: '16/9',
        background: '#000',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '0 0 12px 12px',
      }}
    >
      {/* Scanlines overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0A0F1A',
            zIndex: 3,
          }}
        >
          <div className="spinner" />
        </div>
      )}

      {error && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            background: '#0A0F1A',
            zIndex: 3,
          }}
        >
          <p style={{ color: 'var(--c-live)', fontSize: 14, margin: 0 }}>{error}</p>
          <button
            className="btn btn-ghost"
            onClick={() => { setError(null); setLoading(true) }}
          >
            Reintentar
          </button>
        </div>
      )}

      <video
        ref={videoRef}
        className="w-full h-full"
        style={{ width: '100%', height: '100%', display: 'block' }}
        controls
        playsInline
      />
    </div>
  )
}
