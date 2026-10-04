import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { supabase } from '../lib/supabase'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (signInError) return setError(signInError.message)
    navigate('/dashboard')
  }

  return <AuthShell title="Welcome back" subtitle="Log in to manage your barber page.">
    <form onSubmit={submit} className="form-stack">
      <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></label>
      <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" /></label>
      {error && <div className="error">{error}</div>}
      <button className="button full" disabled={loading}>{loading ? 'Logging in…' : 'Log in'}</button>
      <p className="form-footer">New here? <Link to="/signup">Create a barber account</Link></p>
    </form>
  </AuthShell>
}

function AuthShell({ title, subtitle, children }) {
  return <main className="auth-page"><div className="auth-card"><Logo /><h1>{title}</h1><p>{subtitle}</p>{children}</div></main>
}
