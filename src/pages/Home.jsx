import { Link } from 'react-router-dom'
import Logo from '../components/Logo'

export default function Home({ session }) {
  return (
    <main className="marketing-page">
      <nav className="topbar container">
        <Logo />
        <div className="nav-actions">
          {session ? <Link className="button secondary" to="/dashboard">Dashboard</Link> : <><Link className="button secondary" to="/login">Log in</Link><Link className="button" to="/signup">For barbers</Link></>}
        </div>
      </nav>
      <section className="hero container">
        <div className="hero-copy">
          <span className="eyebrow">Simple booking for barbers</span>
          <h1>Let customers book a haircut without the back-and-forth.</h1>
          <p>Create your free barber page, add your services and opening hours, then share one link with your customers.</p>
          <div className="hero-actions">
            <Link className="button large" to={session ? '/dashboard' : '/signup'}>{session ? 'Open dashboard' : 'Create your free page'}</Link>
            <span className="muted">No payments. No subscriptions.</span>
          </div>
        </div>
        <div className="preview-card">
          <div className="preview-header"><span className="avatar">AB</span><div><strong>Ahmed Barber</strong><span>Casablanca</span></div></div>
          <div className="preview-service"><span>Haircut</span><strong>50 DH</strong></div>
          <div className="preview-service"><span>Haircut + Beard</span><strong>70 DH</strong></div>
          <button className="button full">Book appointment</button>
        </div>
      </section>
    </main>
  )
}
