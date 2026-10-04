import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Loading from '../components/Loading'

function localDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatPrice(price) {
  const value = Number(price)
  return Number.isFinite(value) ? `${value.toLocaleString()} DH` : `${price} DH`
}

export default function PublicBarber() {
  const { username } = useParams()
  const [profile, setProfile] = useState(null)
  const [services, setServices] = useState([])
  const [hours, setHours] = useState([])
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedService, setSelectedService] = useState(null)
  const [selectedDate, setSelectedDate] = useState(localDateKey(new Date()))
  const [selectedTime, setSelectedTime] = useState('')
  const [customer, setCustomer] = useState({ name: '', phone: '', email: '', notes: '' })
  const [booking, setBooking] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      const { data: p } = await supabase.from('profiles').select('*').eq('username', username).single()
      if (!active) return
      if (!p) { setProfile(null); setLoading(false); return }
      const [s, h, a] = await Promise.all([
        supabase.from('services').select('*').eq('barber_id', p.id).order('created_at'),
        supabase.from('business_hours').select('*').eq('barber_id', p.id).order('day_of_week'),
        supabase.from('appointments').select('start_time, end_time').eq('barber_id', p.id).eq('status', 'confirmed').gte('start_time', new Date().toISOString())
      ])
      if (!active) return
      setProfile(p); setServices(s.data || []); setHours(h.data || []); setAppointments(a.data || []); setLoading(false)
    }
    load()
    return () => { active = false }
  }, [username])

  const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + i); return d
  }), [])
  const selectedDay = new Date(`${selectedDate}T12:00:00`).getDay()
  const dayHours = hours.find(h => h.day_of_week === selectedDay)

  const slots = useMemo(() => {
    if (!selectedService || !dayHours?.is_open || !dayHours.opening_time || !dayHours.closing_time) return []
    const [openH, openM] = dayHours.opening_time.split(':').map(Number)
    const [closeH, closeM] = dayHours.closing_time.split(':').map(Number)
    const start = new Date(`${selectedDate}T00:00:00`); start.setHours(openH, openM, 0, 0)
    const close = new Date(`${selectedDate}T00:00:00`); close.setHours(closeH, closeM, 0, 0)
    const result = []
    for (let cursor = new Date(start); cursor.getTime() + selectedService.duration_minutes * 60000 <= close.getTime(); cursor.setMinutes(cursor.getMinutes() + 30)) {
      const end = new Date(cursor.getTime() + selectedService.duration_minutes * 60000)
      const conflict = appointments.some(a => cursor < new Date(a.end_time) && end > new Date(a.start_time))
      if (!conflict && cursor > new Date()) result.push(cursor.toTimeString().slice(0, 5))
    }
    return result
  }, [selectedService, selectedDate, dayHours, appointments])

  function chooseService(service) { setSelectedService(service); setSelectedTime(''); setError(''); setResult('') }
  function chooseDate(key) { setSelectedDate(key); setSelectedTime(''); setError(''); setResult('') }

  async function book(e) {
    e.preventDefault(); setError(''); setResult('')
    if (!selectedService || !selectedTime) return setError('Choose a service and time.')
    setBooking(true)
    const start = new Date(`${selectedDate}T${selectedTime}:00`).toISOString()
    const { data, error } = await supabase.rpc('create_appointment', {
      p_barber_id: profile.id, p_service_id: selectedService.id,
      p_customer_name: customer.name.trim(), p_customer_phone: customer.phone.trim(),
      p_customer_email: customer.email.trim() || null, p_start_time: start,
      p_notes: customer.notes.trim() || null
    })
    if (error) setError(error.message)
    else {
      setResult(`Booked successfully. Your appointment is ${new Date(data.start_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}.`)
      setCustomer({ name: '', phone: '', email: '', notes: '' }); setSelectedTime('')
    }
    setBooking(false)
  }

  if (loading) return <div className="screen-center"><Loading /></div>
  if (!profile) return <div className="screen-center"><div className="not-found-card"><div className="not-found-icon">?</div><h1>Page not found</h1><p>This barber page may have been removed or the address is incorrect.</p><Link className="button" to="/">Go home</Link></div></div>

  const initials = (profile.business_name || 'B').split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase()

  return <main className="public-page">
    <nav className="public-nav container"><Link className="logo" to="/">Trimly</Link><span className="public-nav-label">Online booking</span></nav>

    <section className="business-hero container">
      <div className="business-hero-card">
        <div className="public-avatar">{initials}</div>
        <div className="business-identity">
          <div className="eyebrow">Barber shop</div>
          <h1>{profile.business_name}</h1>
          <div className="business-meta">
            {profile.city && <span>📍 {profile.city}</span>}
            {profile.phone && <a className="public-link" href={`tel:${profile.phone}`}>☎ {profile.phone}</a>}
          </div>
          {profile.description && <p className="business-description">{profile.description}</p>}
        </div>
      </div>
      {(profile.address || profile.phone) && <div className="hero-actions public-hero-actions">
        {profile.phone && <a className="button secondary" href={`tel:${profile.phone}`}>Call</a>}
        {profile.address && <span className="address-chip">📍 {profile.address}</span>}
      </div>}
    </section>

    <section className="public-content container">
      <div className="public-main">
        <div className="public-section">
          <div className="public-section-heading"><div><div className="eyebrow">What we offer</div><h2>Services</h2></div>{services.length > 0 && <span className="section-count">{services.length} available</span>}</div>
          <div className="public-services">
            {services.map(service => <button type="button" className={`public-service ${selectedService?.id === service.id ? 'selected' : ''}`} key={service.id} onClick={() => chooseService(service)}>
              <div className="service-copy"><div className="service-title-row"><strong>{service.name}</strong>{selectedService?.id === service.id && <span className="selected-badge">Selected</span>}</div>{service.description && <p>{service.description}</p>}<span>{service.duration_minutes} min</span></div>
              <strong className="service-price">{formatPrice(service.price)}</strong>
            </button>)}
          </div>
          {services.length === 0 && <div className="empty-state"><strong>No services available yet</strong><p>This barber hasn't added any services to their page.</p></div>}
        </div>

        {selectedService && <div className="public-section booking-box">
          <div className="public-section-heading"><div><div className="eyebrow">Step 2</div><h2>Pick a date and time</h2></div></div>
          <div className="date-row">
            {dates.map(date => { const key = localDateKey(date); return <button type="button" key={key} className={key === selectedDate ? 'selected' : ''} onClick={() => chooseDate(key)}><span>{date.toLocaleDateString([], { weekday: 'short' })}</span><strong>{date.getDate()}</strong><small>{date.toLocaleDateString([], { month: 'short' })}</small></button> })}
          </div>
          <div className="schedule-heading"><strong>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</strong>{dayHours?.is_open && dayHours.opening_time && dayHours.closing_time ? <span>{dayHours.opening_time.slice(0, 5)} – {dayHours.closing_time.slice(0, 5)}</span> : <span>Closed</span>}</div>
          <div className="time-grid">
            {slots.map(time => <button type="button" key={time} className={selectedTime === time ? 'selected' : ''} onClick={() => { setSelectedTime(time); setError(''); setResult('') }}>{time}</button>)}
            {slots.length === 0 && <div className="empty-state compact"><strong>No available times</strong><p>Try another date or choose a different service.</p></div>}
          </div>
        </div>}

        <div className="public-section booking-help"><div><div className="eyebrow">Simple booking</div><h2>No account required</h2><p>Choose your service, pick an available time, and enter your contact details. That's it.</p></div><div className="booking-steps"><span><b>1</b> Service</span><span><b>2</b> Time</span><span><b>3</b> Details</span></div></div>
      </div>

      <aside className="booking-card">
        <div className="booking-card-top"><div><div className="eyebrow">Step 3</div><h2>{selectedService ? `Book ${selectedService.name}` : 'Book an appointment'}</h2></div><span className="secure-badge">Free booking</span></div>
        {selectedService && selectedTime ? <form className="form-stack" onSubmit={book}>
          <div className="booking-summary"><div className="summary-main"><strong>{selectedService.name}</strong><strong>{formatPrice(selectedService.price)}</strong></div><span>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString([], { dateStyle: 'medium' })}</span><span>{selectedTime} · {selectedService.duration_minutes} min</span></div>
          <label>Name<input value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} placeholder="Your name" autoComplete="name" required /></label>
          <label>Phone<input value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} placeholder="Your phone number" autoComplete="tel" inputMode="tel" required /></label>
          <label>Email <span className="optional">optional</span><input type="email" value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })} placeholder="you@example.com" autoComplete="email" /></label>
          <label>Notes <span className="optional">optional</span><textarea rows="3" value={customer.notes} onChange={e => setCustomer({ ...customer, notes: e.target.value })} placeholder="Anything the barber should know?" /></label>
          {error && <div className="error">{error}</div>}{result && <div className="success">{result}</div>}
          <button className="button full booking-submit" disabled={booking}>{booking ? 'Booking…' : 'Confirm appointment'}</button><small className="muted booking-note">No account or payment required.</small>
        </form> : <div className="booking-placeholder"><div className="placeholder-icon">✦</div><strong>Your booking details will appear here</strong><p>Select a service, date, and available time to continue.</p></div>}
      </aside>
    </section>
  </main>
}
