import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Loading from '../components/Loading'

const DEFAULTS = {
  primary_color: '#171717',
  secondary_color: '#E9E7E1',
  background_style: 'light',
  button_style: 'rounded',
  page_style: 'minimal',
  enable_effects: true,
  show_phone: true,
  show_address: true,
  show_description: true,
  allow_notes: true
}

function localDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function safeColor(value, fallback) {
  return /^#[0-9a-fA-F]{6}$/.test(value || '') ? value : fallback
}

function readableTextColor(hex) {
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16) / 255
  const g = parseInt(value.slice(2, 4), 16) / 255
  const b = parseInt(value.slice(4, 6), 16) / 255
  const convert = channel => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  const luminance = 0.2126 * convert(r) + 0.7152 * convert(g) + 0.0722 * convert(b)
  return luminance > 0.48 ? '#171717' : '#ffffff'
}

function formatDate(dateKey) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
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
      if (!p) return setLoading(false)
      const [s, h, a] = await Promise.all([
        supabase.from('services').select('*').eq('barber_id', p.id).order('created_at'),
        supabase.from('business_hours').select('*').eq('barber_id', p.id).order('day_of_week'),
        supabase.from('appointments').select('start_time, end_time').eq('barber_id', p.id).eq('status', 'confirmed').gte('start_time', new Date().toISOString())
      ])
      if (!active) return
      setProfile(p)
      setServices(s.data || [])
      setHours(h.data || [])
      setAppointments(a.data || [])
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [username])

  const settings = { ...DEFAULTS, ...profile }
  const primary = safeColor(settings.primary_color, DEFAULTS.primary_color)
  const secondary = safeColor(settings.secondary_color, DEFAULTS.secondary_color)
  const primaryText = readableTextColor(primary)
  const customStyle = {
    '--public-primary': primary,
    '--public-primary-text': primaryText,
    '--public-secondary': secondary
  }
  const themeClasses = `public-theme background-${settings.background_style || 'light'} buttons-${settings.button_style || 'rounded'} style-${settings.page_style || 'minimal'} ${settings.enable_effects === false ? 'effects-off' : 'effects-on'}`

  const selectedDay = new Date(`${selectedDate}T12:00:00`).getDay()
  const dayHours = hours.find(h => h.day_of_week === selectedDay)
  const slots = useMemo(() => {
    if (!selectedService || !dayHours?.is_open || !dayHours.opening_time || !dayHours.closing_time) return []
    const [openH, openM] = dayHours.opening_time.split(':').map(Number)
    const [closeH, closeM] = dayHours.closing_time.split(':').map(Number)
    const start = new Date(`${selectedDate}T00:00:00`)
    start.setHours(openH, openM, 0, 0)
    const close = new Date(`${selectedDate}T00:00:00`)
    close.setHours(closeH, closeM, 0, 0)
    const now = new Date()
    const result = []
    for (let cursor = new Date(start); cursor.getTime() + selectedService.duration_minutes * 60000 <= close.getTime(); cursor.setMinutes(cursor.getMinutes() + 30)) {
      const end = new Date(cursor.getTime() + selectedService.duration_minutes * 60000)
      const conflict = appointments.some(a => cursor < new Date(a.end_time) && end > new Date(a.start_time))
      if (!conflict && cursor > now) result.push(cursor.toTimeString().slice(0, 5))
    }
    return result
  }, [selectedService, selectedDate, dayHours, appointments])

  const nextDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setHours(12, 0, 0, 0)
    d.setDate(d.getDate() + i)
    return { date: d, key: localDateKey(d) }
  }), [])

  async function book(e) {
    e.preventDefault()
    setError('')
    setResult('')
    if (!selectedService || !selectedTime) return setError('Choose a service and time.')
    setBooking(true)
    const start = new Date(`${selectedDate}T${selectedTime}:00`).toISOString()
    const { data, error: bookingError } = await supabase.rpc('create_appointment', {
      p_barber_id: profile.id,
      p_service_id: selectedService.id,
      p_customer_name: customer.name.trim(),
      p_customer_phone: customer.phone.trim(),
      p_customer_email: customer.email.trim() || null,
      p_start_time: start,
      p_notes: settings.allow_notes !== false ? customer.notes.trim() || null : null
    })
    if (bookingError) setError(bookingError.message)
    else {
      setResult(`Booked successfully. Your appointment is ${new Date(data.start_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}.`)
      setCustomer({ name: '', phone: '', email: '', notes: '' })
      setSelectedTime('')
    }
    setBooking(false)
  }

  if (loading) return <div className="screen-center"><Loading /></div>
  if (!profile) return <div className="screen-center"><div className="public-not-found"><span className="eyebrow">Trimly</span><h1>Page not found</h1><p>This barber page doesn't exist or is no longer available.</p><Link className="button" to="/">Go home</Link></div></div>

  return <main className={`public-page ${themeClasses}`} style={customStyle}>
    <nav className="public-nav container">
      <Link className="logo" to="/">Trimly</Link>
      <span>Book an appointment</span>
    </nav>

    <section className="business-hero container">
      {settings.cover_image_url && <div className="business-cover"><img src={settings.cover_image_url} alt="" /></div>}
      <div className="business-hero-inner">
        <div className={`public-avatar ${settings.profile_image_url ? 'has-image' : ''}`}>
          {settings.profile_image_url ? <img src={settings.profile_image_url} alt={profile.business_name || 'Barber'} /> : (profile.business_name || 'B').slice(0, 1).toUpperCase()}
        </div>
        <div className="business-hero-copy">
          <span className="public-eyebrow">Barber shop</span>
          <h1>{profile.business_name || 'Your barber shop'}</h1>
          <div className="business-meta">
            {profile.city && <span>{profile.city}</span>}
            {settings.show_address !== false && profile.address && <span>{profile.address}</span>}
            {settings.show_phone !== false && profile.phone && <a className="public-link" href={`tel:${profile.phone}`}>Call {profile.phone}</a>}
          </div>
          {settings.show_description !== false && profile.description && <p className="business-description">{profile.description}</p>}
        </div>
      </div>
      <div className="hero-accent" aria-hidden="true" />
    </section>

    <section className="public-content container">
      <div className="public-main">
        <div className="booking-steps">
          <div className="booking-step"><span>1</span><div><strong>Choose a service</strong><small>Pick what you need</small></div></div>
          <div className="booking-step"><span>2</span><div><strong>Choose a time</strong><small>Find an available slot</small></div></div>
          <div className="booking-step"><span>3</span><div><strong>Confirm</strong><small>No account required</small></div></div>
        </div>

        <div className="public-section">
          <div className="section-title-row"><div><span className="public-eyebrow">What we offer</span><h2>Services</h2></div><span className="section-count">{services.length} {services.length === 1 ? 'service' : 'services'}</span></div>
          <div className="public-services">
            {services.map(service => <button type="button" className={`public-service ${selectedService?.id === service.id ? 'selected' : ''}`} key={service.id} onClick={() => { setSelectedService(service); setSelectedTime(''); setResult(''); setError('') }}>
              <div className="service-copy"><span className="service-index">{String(services.indexOf(service) + 1).padStart(2, '0')}</span><div><strong>{service.name}</strong>{service.description && <p>{service.description}</p>}<span>{service.duration_minutes} min</span></div></div>
              <div className="service-price"><strong>{service.price} DH</strong><span>{selectedService?.id === service.id ? 'Selected' : 'Choose'}</span></div>
            </button>)}
          </div>
          {services.length === 0 && <div className="public-empty"><strong>No services yet</strong><span>This barber hasn't added bookable services yet.</span></div>}
        </div>

        {selectedService && <div className="public-section booking-box">
          <div className="section-title-row"><div><span className="public-eyebrow">Availability</span><h2>Choose a time</h2></div><span className="selected-service-label">{selectedService.name}</span></div>
          <div className="date-row">
            {nextDays.map(({ date, key }) => <button type="button" key={key} className={key === selectedDate ? 'selected' : ''} onClick={() => { setSelectedDate(key); setSelectedTime(''); setError('') }}><span>{date.toLocaleDateString([], { weekday: 'short' })}</span><strong>{date.getDate()}</strong><small>{date.toLocaleDateString([], { month: 'short' })}</small></button>)}
          </div>
          <div className="availability-label">{dayHours?.is_open ? `Available times · ${dayHours.opening_time?.slice(0, 5)}–${dayHours.closing_time?.slice(0, 5)}` : 'Closed on this day'}</div>
          <div className="time-grid">
            {slots.map(time => <button type="button" key={time} className={selectedTime === time ? 'selected' : ''} onClick={() => { setSelectedTime(time); setError('') }}>{time}</button>)}
            {slots.length === 0 && <div className="time-empty"><strong>No available times</strong><span>Try another day or choose another service.</span></div>}
          </div>
        </div>}
      </div>

      <aside className="booking-card">
        <div className="booking-card-header"><span className="public-eyebrow">Your appointment</span><h2>{selectedService ? selectedService.name : 'Book an appointment'}</h2></div>
        {selectedService && selectedTime ? <form className="form-stack" onSubmit={book}>
          <div className="booking-summary"><div><span>Service</span><strong>{selectedService.name}</strong></div><div><span>Date & time</span><strong>{formatDate(selectedDate)} · {selectedTime}</strong></div><div><span>Duration</span><strong>{selectedService.duration_minutes} min</strong></div><div className="summary-total"><span>Total</span><strong>{selectedService.price} DH</strong></div></div>
          <label>Name<input placeholder="Your name" value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} required /></label>
          <label>Phone<input type="tel" placeholder="Your phone number" value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} required /></label>
          <label>Email <span className="optional">optional</span><input type="email" placeholder="you@example.com" value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })} /></label>
          {settings.allow_notes !== false && <label>Notes <span className="optional">optional</span><textarea rows="3" placeholder="Anything the barber should know?" value={customer.notes} onChange={e => setCustomer({ ...customer, notes: e.target.value })} /></label>}
          {error && <div className="error">{error}</div>}
          {result && <div className="success">{result}</div>}
          <button className="button full public-book-button" disabled={booking}>{booking ? 'Booking…' : 'Confirm appointment'}</button>
          <small className="booking-note">No account required. Your booking is confirmed through the shop.</small>
        </form> : <div className="booking-placeholder"><div className="placeholder-icon">✦</div><p>Select a service, date and available time to continue.</p><small>No account required.</small></div>}
      </aside>
    </section>
  </main>
}
