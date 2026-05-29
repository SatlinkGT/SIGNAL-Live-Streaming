import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    setLoading(true)
    try {
      await register(form.username, form.email, form.password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo crear la cuenta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main
      className="page-enter bg-grid"
      style={{
        minHeight: 'calc(100dvh - 60px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 16px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'var(--c-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginInline: 'auto',
              marginBottom: 16,
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="5" fill="white" />
              <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="1.5" opacity="0.4" />
            </svg>
          </div>
          <h1
            style={{
              fontFamily: "'Syne', sans-serif",
              fontWeight: 700,
              fontSize: 24,
              margin: '0 0 6px',
              color: 'var(--c-text)',
            }}
          >
            Crear cuenta
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--c-muted)' }}>
            Comienza a transmitir hoy
          </p>
        </div>

        <div className="card" style={{ padding: '28px 28px 24px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label
                htmlFor="username"
                style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--c-muted)', marginBottom: 6 }}
              >
                Nombre de usuario
              </label>
              <input
                id="username"
                name="username"
                type="text"
                className="input"
                value={form.username}
                onChange={handleChange}
                placeholder="tuusuario"
                required
                autoComplete="username"
                minLength={3}
                pattern="[a-zA-Z0-9_]+"
                title="Solo letras, números y guion bajo"
              />
              <span style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 4, display: 'block' }}>
                Solo letras, números y guion bajo. Se usa como URL de tu canal.
              </span>
            </div>

            <div>
              <label
                htmlFor="email"
                style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--c-muted)', marginBottom: 6 }}
              >
                Correo electrónico
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="input"
                value={form.email}
                onChange={handleChange}
                placeholder="tu@email.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--c-muted)', marginBottom: 6 }}
              >
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className="input"
                value={form.password}
                onChange={handleChange}
                placeholder="Mínimo 8 caracteres"
                required
                autoComplete="new-password"
                minLength={8}
              />
            </div>

            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 8,
                  fontSize: 13,
                  color: '#FCA5A5',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', marginTop: 4 }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="spinner" style={{ width: 16, height: 16 }} />
                  Creando cuenta...
                </span>
              ) : (
                'Crear cuenta'
              )}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--c-muted)', marginTop: 20 }}>
          ¿Ya tienes cuenta?{' '}
          <Link
            to="/login"
            style={{ color: 'var(--c-accent)', textDecoration: 'none', fontWeight: 500 }}
          >
            Inicia sesión
          </Link>
        </p>
      </div>
    </main>
  )
}
