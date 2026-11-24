import Hls from 'hls.js'
import { useEffect, useRef, useState } from 'react'

// MediaMTX can retain a historical target duration after the long segment
// has left the sliding window. Hls.js uses it to schedule playlist reloads.
class LivePlaylistLoader extends Hls.DefaultConfig.loader {
  load(context, config, callbacks) {
    super.load(context, config, {
      ...callbacks,
      onSuccess(response, stats, context, networkDetails) {
        if (context.type === 'level' && typeof response.data === 'string' &&
            !response.data.includes('#EXT-X-ENDLIST')) {
          const durations = Array.from(
            response.data.matchAll(/^#EXTINF:(\d+(?:\.\d+)?),/gm),
            (match) => Math.round(Number(match[1])),
          )
          const windowTarget = Math.max(1, ...durations)
          if (durations.length) {
            response.data = response.data.replace(
              /^(#EXT-X-TARGETDURATION:)(\d+)(?=\r?$)/m,
              (line, prefix, target) => Number(target) >= windowTarget * 2
                ? `${prefix}${windowTarget}`
                : line,
            )
          }
        }
        callbacks.onSuccess(response, stats, context, networkDetails)
      },
    })
  }
}

export function VideoPlayer({ streamKey, isLive }) {
  const videoRef = useRef(null)
  const [attempt, setAttempt] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [paused, setPaused] = useState(true)
  const [muted, setMuted] = useState(false)

  const hlsUrl = `/hls/live/${streamKey}/index.m3u8`

  useEffect(() => {
    const video = videoRef.current
    if (!video || !isLive) return

    setError(null)
    setLoading(true)
    setPaused(video.paused)
    setMuted(false)
    video.muted = false

    let hls
    let active = true
    let mediaRecovered = false
    let starting = false
    const onError = () => {
      setLoading(false)
      setError('No se pudo reproducir la transmisión')
    }
    const startPlayback = async () => {
      if (!active || starting || !video.paused) return
      starting = true
      try {
        await video.play()
      } catch (error) {
        if (!active || error.name !== 'NotAllowedError') return
        video.muted = true
        await video.play().catch(() => {})
      } finally {
        starting = false
      }
    }
    const onReady = () => {
      setLoading(false)
      startPlayback()
    }

    video.addEventListener('canplay', onReady, { once: true })
    if (Hls.isSupported()) {
      hls = new Hls({
        lowLatencyMode: false,
        backBufferLength: 30,
        pLoader: LivePlaylistLoader,
      })
      hls.on(Hls.Events.MANIFEST_PARSED, startPlayback)
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !mediaRecovered) {
          mediaRecovered = true
          hls.recoverMediaError()
          return
        }
        hls.destroy()
        hls = null
        onError()
      })
      hls.loadSource(hlsUrl)
      hls.attachMedia(video)
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.addEventListener('error', onError)
      video.src = hlsUrl
      startPlayback()
    } else {
      onError()
    }

    return () => {
      active = false
      video.removeEventListener('canplay', onReady)
      video.removeEventListener('error', onError)
      hls?.destroy()
      video.removeAttribute('src')
      video.load()
    }
  }, [hlsUrl, isLive, attempt])

  const activatePlayback = () => {
    const video = videoRef.current
    video.muted = false
    if (video.paused) video.play().catch(() => {})
  }

  const canActivate = !loading && !error && (muted || paused)

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
            onClick={() => setAttempt((value) => value + 1)}
          >
            Reintentar
          </button>
        </div>
      )}

      <video
        ref={videoRef}
        className="w-full h-full"
        style={{ width: '100%', height: '100%', display: 'block' }}
        autoPlay
        preload="auto"
        playsInline
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onVolumeChange={({ currentTarget }) => setMuted(currentTarget.muted)}
      />

      {canActivate && (
        <button
          type="button"
          aria-label="Reproducir con sonido"
          onClick={activatePlayback}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            background: 'transparent',
            border: 0,
            cursor: 'pointer',
          }}
        />
      )}
    </div>
  )
}
