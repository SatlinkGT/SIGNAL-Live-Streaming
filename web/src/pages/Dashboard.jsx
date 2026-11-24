import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text)
    return
  }
  const input = document.createElement('textarea')
  input.value = text
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.appendChild(input)
  input.select()
  const copied = document.execCommand('copy')
  input.remove()
  if (!copied) window.prompt('Copia este valor:', text)
}

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
  const [title, setTitle] = useState('')
  const [savingTitle, setSavingTitle] = useState(false)
  const [titleError, setTitleError] = useState('')
  const [channelLoaded, setChannelLoaded] = useState(false)
  const [inputProtocol, setInputProtocol] = useState('rtmp')
  const [savingInput, setSavingInput] = useState(false)
  const [inputError, setInputError] = useState('')
  const [streamKey, setStreamKey] = useState('')
  const [logoUrl, setLogoUrl] = useState(null)
  const [savingLogo, setSavingLogo] = useState(false)
  const [logoError, setLogoError] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    api.get('/channels/me/stream-key')
      .then((r) => { setTitle(r.data.title || user?.username || ''); setChannelLoaded(true); setStreamKey(r.data.streamKey); setLogoUrl(r.data.logoUrl); setInputProtocol(r.data.inputProtocol || 'rtmp') })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function saveTitle(event) {
    event.preventDefault()
    setSavingTitle(true)
    setTitleError('')
    try {
      const { data } = await api.post('/channels/me/title', { title: title.trim() })
      setTitle(data.title)
      setToast('Nombre del canal guardado')
    } catch {
      setTitleError('No se pudo guardar el nombre. Inténtalo de nuevo.')
    } finally {
      setSavingTitle(false)
    }
  }

  async function selectInput(protocol) {
    setSavingInput(true)
    setInputError('')
    try {
      const { data } = await api.post('/channels/me/input', { inputProtocol: protocol })
      setInputProtocol(data.inputProtocol)
      setShow(false)
      setToast(`Entrada ${data.inputProtocol.toUpperCase()} activada`)
    } catch (error) {
      setInputError(error.response?.status === 409
        ? 'Detén la señal actual antes de cambiar el protocolo de entrada.'
        : 'No se pudo cambiar la entrada. Inténtalo de nuevo.')
    } finally {
      setSavingInput(false)
    }
  }

  async function uploadLogo(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setLogoError('')
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setLogoError('Selecciona una imagen PNG, JPG o WebP de hasta 5 MB.')
      return
    }
    setSavingLogo(true)
    let bitmap
    try {
      bitmap = await createImageBitmap(file)
      const scale = Math.min(1, 192 / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const { data } = await api.post('/channels/me/logo', { logoUrl: canvas.toDataURL('image/png') })
      setLogoUrl(data.logoUrl)
      setToast('Logo del canal guardado')
    } catch {
      setLogoError('No se pudo guardar el logo. Intenta con otra imagen.')
    } finally {
      bitmap?.close()
      setSavingLogo(false)
    }
  }

  async function removeLogo() {
    setSavingLogo(true)
    setLogoError('')
    try {
      await api.post('/channels/me/logo', { logoUrl: null })
      setLogoUrl(null)
      setToast('Logo eliminado')
    } catch {
      setLogoError('No se pudo eliminar el logo. Inténtalo de nuevo.')
    } finally {
      setSavingLogo(false)
    }
  }

  function copy() {
    copyText(inputProtocol === 'srt' ? `publish:live/${streamKey}` : streamKey)
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

  const rtmpUrl = `rtmp://${window.location.hostname}/live`
  const srtUrl = `srt://${window.location.hostname}:8890`
  const inputUrl = inputProtocol === 'srt' ? srtUrl : rtmpUrl
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
          Gestiona tu canal y configura la señal de entrada
        </p>
        <p style={{ margin: '12px 0 0', fontSize: 14, color: 'var(--c-text)', overflowWrap: 'anywhere' }}>
          Estás editando el canal de la cuenta <strong>{user?.username}</strong>.
          {' '}<a href={`/canal/${user?.username?.toLowerCase()}`} style={{ color: 'var(--c-accent)' }}>Ver /canal/{user?.username?.toLowerCase()}</a>
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <form className="card" style={{ padding: 24 }} onSubmit={saveTitle}>
          <label htmlFor="channel-title" style={{ display: 'block', marginBottom: 16, fontSize: 16, fontWeight: 700 }}>Nombre del canal</label>
          <input id="channel-title" className="input" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={100} disabled={!channelLoaded || savingTitle} aria-describedby="channel-title-help" />
          <p id="channel-title-help" style={{ color: 'var(--c-muted)', fontSize: 13 }}>Este es el nombre que aparece en la tarjeta de tu canal y en su página. Pulsa Guardar nombre para aplicar el cambio. Máximo 100 caracteres.</p>
          <button type="submit" className="btn btn-primary" disabled={!channelLoaded || savingTitle || !title.trim()}>{savingTitle ? 'Guardando...' : 'Guardar nombre'}</button>
          {titleError && <p role="alert" style={{ color: 'var(--c-live)', fontSize: 14 }}>{titleError}</p>}
          {!loading && !channelLoaded && <p role="alert">No se pudo cargar el canal. Recarga la página para intentarlo de nuevo.</p>}
        </form>

        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 16 }}>Logo del canal</h2>
          <p style={{ color: 'var(--c-muted)', fontSize: 14, lineHeight: 1.5 }}>
            Aparecerá como miniatura de tu canal en la página principal cuando estés en vivo.
            Sube una imagen PNG, JPG o WebP de hasta 5 MB.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ width: 96, height: 96, borderRadius: 12, background: 'var(--c-surface-raised)', display: 'grid', placeItems: 'center' }}>
              {logoUrl ? <img src={logoUrl} alt="Logo de tu canal" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8, boxSizing: 'border-box' }} />
                : <span style={{ color: 'var(--c-muted)', fontSize: 12 }}>Sin logo</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label htmlFor="channel-logo" style={{ fontSize: 14 }}>Seleccionar logo</label>
              <input id="channel-logo" type="file" accept="image/png,image/jpeg,image/webp" disabled={savingLogo || loading} onChange={uploadLogo} style={{ maxWidth: '100%' }} />
              {savingLogo && <span role="status">Guardando...</span>}
              {logoUrl && <button className="btn btn-ghost" onClick={removeLogo} disabled={savingLogo || loading}>Eliminar logo</button>}
            </div>
          </div>
          {logoError && <p role="alert" style={{ color: 'var(--c-live)', fontSize: 14 }}>{logoError}</p>}
        </div>

        {/* Input setup card */}
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
            Configuración de entrada: {inputProtocol === 'srt' ? 'Astra de Cesbo' : 'vMix'}
          </h2>

          <div style={{ marginBottom: 24 }}>
            <label htmlFor="input-protocol" style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>Protocolo de entrada</label>
            <select id="input-protocol" className="input" value={inputProtocol} disabled={loading || savingInput} onChange={(event) => selectInput(event.target.value)}>
              <option value="rtmp">RTMP</option>
              <option value="srt">SRT</option>
            </select>
            <p style={{ color: 'var(--c-muted)', fontSize: 13, lineHeight: 1.5 }}>
              Solo funciona la entrada seleccionada. Detén la transmisión actual antes de cambiar el protocolo.
              La otra entrada permanecerá desactivada.
            </p>
          </div>

          {savingInput && <p role="status">Guardando entrada...</p>}
          {inputError && <p role="alert" style={{ color: 'var(--c-live)' }}>{inputError}</p>}

          {/* Ingest server */}
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
              {inputProtocol === 'srt' ? 'Servidor SRT de destino en Astra' : 'URL en vMix (servidor RTMP)'}
            </p>
            <div
              className="code-block"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
            >
              <span style={{ overflowWrap: 'anywhere' }}>{inputUrl}</span>
              <button
                className="btn btn-ghost"
                style={{ padding: '5px 10px', fontSize: 12 }}
                onClick={() => {
                  copyText(inputUrl)
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
              {inputProtocol === 'srt' ? 'Stream ID en Astra' : 'Stream Name or Key en vMix (clave de transmisión)'}
            </p>
            {loading ? (
              <div className="skeleton" style={{ height: 44 }} />
            ) : (
              <div
                className="code-block"
                style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
              >
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {inputProtocol === 'srt' ? 'publish:live/' : ''}{show ? streamKey : maskedKey}
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
              Mantén esta clave en secreto. Se utiliza tanto para RTMP como para el Stream ID de SRT.
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
            Cómo enviar {inputProtocol.toUpperCase()} desde {inputProtocol === 'srt' ? 'Astra de Cesbo' : 'vMix'}
          </h2>

          <ol style={{ margin: 0, padding: '0 0 0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(inputProtocol === 'srt' ? [
              'En Astra de Cesbo, abre el canal que deseas enviar y añade una salida SRT (Output).',
              'Configura la salida de Astra en modo Caller. Este servidor recibe la señal en modo Listener.',
              `Configura el destino ${window.location.hostname} y el puerto 8890/UDP.`,
              'En la salida SRT de Astra, copia el Stream ID completo de este panel (publish:live/ seguido de tu clave). Deja Passphrase vacío. Si tu versión no admite Stream ID en la salida Caller, actualiza Astra.',
              'Configura la latencia en 200 ms y envía un solo programa MPEG-TS por canal. La fuente debe tener video H.264, audio AAC y fotogramas clave cada 2 segundos; Astra conserva los códecs de la fuente.',
              'Guarda y activa la salida SRT. Asegúrate de que tu red permita tráfico UDP al puerto 8890.',
              `Tu canal estará en vivo en: /canal/${user?.username?.toLowerCase()}`,
            ] : [
              'Abre vMix y haz clic en el engranaje junto al botón Stream para abrir Streaming Settings.',
              'En Destination, selecciona Custom RTMP Server.',
              'Copia el servidor RTMP de este panel y pégalo en el campo URL de vMix.',
              'Copia tu clave de transmisión y pégala en Stream Name or Key. La URL y la clave van en campos separados.',
              'En Quality, configura video H.264, audio AAC y un intervalo de fotogramas clave de 2 segundos.',
              'Guarda los ajustes y pulsa Stream para iniciar la transmisión.',
              `Tu canal estará en vivo en: /canal/${user?.username?.toLowerCase()}`,
            ]).map((step, i) => (
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
            Regenerar la stream key invalidará la clave actual. Si tu emisor está transmitiendo, necesitarás configurar la nueva clave para volver a conectarte.
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
