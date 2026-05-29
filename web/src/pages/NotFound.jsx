import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <main
      className="page-enter bg-grid"
      style={{
        minHeight: 'calc(100dvh - 60px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        textAlign: 'center',
        gap: 20,
      }}
    >
      <div
        style={{
          fontFamily: "'Syne', sans-serif",
          fontWeight: 800,
          fontSize: 'clamp(80px, 20vw, 160px)',
          color: 'var(--c-surface-raised)',
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        404
      </div>
      <div>
        <h1
          style={{
            fontFamily: "'Syne', sans-serif",
            fontWeight: 700,
            fontSize: 24,
            margin: '0 0 8px',
            color: 'var(--c-text)',
          }}
        >
          Señal perdida
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--c-muted)', maxWidth: 320 }}>
          La página que buscas no existe o fue movida.
        </p>
      </div>
      <Link to="/">
        <button className="btn btn-primary">Volver al inicio</button>
      </Link>
    </main>
  )
}
