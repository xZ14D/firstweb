import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { supabase } from '../lib/supabase'

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)
}

export default function Signup() {
  const navigate = useNavigate()
  const [businessName, setBusinessName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    const cleanUsername = slugify(username || businessName)
    if (!cleanUsername) {
      setError('Choose a page name.')
      setLoading(false)
      return
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { business_name: businessName.trim(), username: cleanUsername } }
    })
    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (!data.user) {
      setError('Account creation did not return a user.')
      setLoading(false)
      return
    }

    setLoading(false)
    if (!data.session) {
      setError('Account created. Check your email to confirm your account, then log in.')
      return
    }
    navigate('/dashboard')
  }

  return <main className="auth-page"><div className="auth-card wide"><Logo /><h1>Create your barber page</h1><p>Free for now. Customers will not need an account to book.</p>
    <form onSubmit={submit} className="form-stack">
      <label>Business name<input value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Ahmed Barber" required /></label>
      <label>Page name<input value={username} onChange={e => setUsername(slugify(e.target.value))} placeholder="ahmed-barber" required /><small>Your public URL will be /{username || 'your-name'}</small></label>
      <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></label>
      <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required autoComplete="new-password" /></label>
      {error && <div className="error">{error}</div>}
      <button className="button full" disabled={loading}>{loading ? 'Creating…' : 'Create account'}</button>
      <p className="form-footer">Already have an account? <Link to="/login">Log in</Link></p>
    </form>
  </div></main>
}
