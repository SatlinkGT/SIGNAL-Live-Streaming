import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        height: '60px',
        background: 'rgba(8,11,18,0.88)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--c-border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: '12px',
      }}
    >
      {/* Brand */}
      <Link
        to="/"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          textDecoration: 'none',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: 'var(--c-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="3" fill="white" />
            <circle cx="7" cy="7" r="6" stroke="white" strokeWidth="1.5" opacity="0.4" />
          </svg>
        </span>
        <span
          style={{
            fontFamily: "'Syne', sans-serif",
            fontWeight: 700,
            fontSize: 15,
            color: 'var(--c-text)',
            letterSpacing: '0.05em',
          }}
        >
          SIGNAL
        </span>
      </Link>

      {/* Nav links — hidden on mobile via CSS */}
      <nav className="navbar-links">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          En vivo
        </NavLink>
        {user && (
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            Mi canal
          </NavLink>
        )}
      </nav>

      {/* Spacer when nav links hidden on mobile */}
      <div style={{ flex: 1 }} />

      {/* Auth actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {user ? (
          <>
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--c-accent), #fb923c)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 700,
                color: '#fff',
                fontFamily: "'Syne', sans-serif",
                flexShrink: 0,
              }}
              title={user.username}
            >
              {user.username[0].toUpperCase()}
            </span>
            <button
              className="btn btn-ghost"
              style={{ padding: '7px 12px', fontSize: 13 }}
              onClick={handleLogout}
            >
              Salir
            </button>
          </>
        ) : (
          <>
            <Link to="/login">
              <button className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: 13 }}>
                <span className="nav-label-full">Iniciar sesión</span>
                <span className="nav-label-short">Entrar</span>
              </button>
            </Link>
            <Link to="/register">
              <button className="btn btn-primary" style={{ padding: '7px 12px', fontSize: 13 }}>
                <span className="nav-label-full">Registrarse</span>
                <span className="nav-label-short">Registro</span>
              </button>
            </Link>
          </>
        )}
      </div>
    </header>
  )
}
