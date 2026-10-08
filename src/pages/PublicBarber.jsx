import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Loading from '../components/Loading'

const DEFAULT_CUSTOMIZATION = {
  primary_color: '#171717',
  secondary_color: '#E9E7E1',
  background_style: 'light',
  button_style: 'rounded',
  page_style: 'minimal',
  enable_effects: true,
  show_phone: true,
  show_address: true,
  show_description: true,
  allow_notes: true,
  profile_image_url: '',
  cover_image_url: ''
}

const BACKGROUNDS = {
  light: { bg: '#f7f6f3', surface: '#ffffff', soft: '#f1f0ec', text: '#171717', muted: '#707070', border: '#e2e0db' },
  warm: { bg: '#f6f0e8', surface: '#fffaf4', soft: '#eee3d5', text: '#2a241e', muted: '#776e64', border: '#ded2c4' },
  cool: { bg: '#f1f4f7', surface: '#ffffff', soft: '#e7edf2', text: '#17202a', muted: '#68737e', border: '#d9e0e6' },
  dark: { bg: '#151515', surface: '#202020', soft: '#292929', text: '#f5f5f5', muted: '#aaa', border: '#363636' }
}

function localDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatAppointmentDate(start) {
  return new Date(start).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })
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
  const [confirmation, setConfirmation] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: p } = await supabase.from('profiles').select('*').eq('username', username).single()
      if (!p) return setLoading(false)
      const [s, h, a] = await Promise.all([
        supabase.from('services').select('*').eq('barber_id', p.id).order('created_at'),
        supabase.from('business_hours').select('*').eq('barber_id', p.id).order('day_of_week'),
        supabase.from('appointments').select('start_time, end_time').eq('barber_id', p.id).eq('status', 'confirmed').gte('start_time', new Date().toISOString())
      ])
      setProfile(p)
      setServices(s.data || [])
      setHours(h.data || [])
      setAppointments(a.data || [])
      setLoading(false)
    }
    load()
  }, [username])

  const customization = { ...DEFAULT_CUSTOMIZATION, ...(profile || {}) }
  const background = BACKGROUNDS[customization.background_style] || BACKGROUNDS.light
  const pageStyle = customization.page_style || 'minimal'
  const buttonStyle = customization.button_style || 'rounded'
  const pageClass = `public-page style-${pageStyle} button-${buttonStyle} background-${customization.background_style} ${customization.enable_effects === false ? 'effects-off' : 'effects-on'}`
  const pageVars = {
    '--public-primary': customization.primary_color || DEFAULT_CUSTOMIZATION.primary_color,
    '--public-secondary': customization.secondary_color || DEFAULT_CUSTOMIZATION.secondary_color,
    '--public-bg': background.bg,
    '--public-surface': background.surface,
    '--public-soft': background.soft,
    '--public-text': background.text,
    '--public-muted': background.muted,
    '--public-border': background.border
  }

  const selectedDay = new Date(`${selectedDate}T12:00:00`).getDay()
  const dayHours = hours.find(h => h.day_of_week === selectedDay)

  const slots = useMemo(() => {
    if (!selectedService || !dayHours?.is_open) return []
    const [openH, openM] = dayHours.opening_time.split(':').map(Number)
    const [closeH, closeM] = dayHours.closing_time.split(':').map(Number)
    const start = new Date(`${selectedDate}T00:00:00`)
    start.setHours(openH, openM, 0, 0)
    const close = new Date(`${selectedDate}T00:00:00`)
    close.setHours(closeH, closeM, 0, 0)
    const result = []
    for (let cursor = new Date(start); cursor.getTime() + selectedService.duration_minutes * 60000 <= close.getTime(); cursor.setMinutes(cursor.getMinutes() + 30)) {
      const end = new Date(cursor.getTime() + selectedService.duration_minutes * 60000)
      const conflict = appointments.some(a => cursor < new Date(a.end_time) && end > new Date(a.start_time))
      if (!conflict && cursor > new Date()) result.push(cursor.toTimeString().slice(0, 5))
    }
    return result
  }, [selectedService, selectedDate, dayHours, appointments])

  async function book(e) {
    e.preventDefault()
    setError('')
    if (!selectedService || !selectedTime) return setError('Choose a service and time.')
    setBooking(true)

    const start = new Date(`${selectedDate}T${selectedTime}:00`)
    const startIso = start.toISOString()
    const customerName = customer.name.trim()

    const { data, error: bookingError } = await supabase.rpc('create_appointment', {
      p_barber_id: profile.id,
      p_service_id: selectedService.id,
      p_customer_name: customerName,
      p_customer_phone: customer.phone.trim(),
      p_customer_email: customer.email.trim() || null,
      p_start_time: startIso,
      p_notes: customization.allow_notes === false ? null : (customer.notes.trim() || null)
    })

    if (bookingError) {
      setError(bookingError.message)
      setBooking(false)
      return
    }

    const appointmentStart = data?.start_time || startIso
    const appointmentEnd = data?.end_time || new Date(start.getTime() + selectedService.duration_minutes * 60000).toISOString()

    setConfirmation({
      name: customerName,
      service: selectedService.name,
      price: selectedService.price,
      duration: selectedService.duration_minutes,
      start: appointmentStart,
      end: appointmentEnd
    })

    setAppointments(current => [...current, { start_time: appointmentStart, end_time: appointmentEnd }])
    setCustomer({ name: '', phone: '', email: '', notes: '' })
    setSelectedTime('')
    setBooking(false)
  }

  function chooseService(service) {
    setSelectedService(service)
    setSelectedTime('')
    setError('')
    setConfirmation(null)
  }

  function bookAnother() {
    setConfirmation(null)
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading) return <div className="screen-center"><Loading /></div>
  if (!profile) return <div className="screen-center"><div><h1>Page not found</h1><Link to="/">Go home</Link></div></div>

  return <main className={pageClass} style={pageVars}>
    {customization.cover_image_url && <div className="public-cover" style={{ backgroundImage: `url(${customization.cover_image_url})` }} />}

    <nav className="public-nav container">
      <Link className="logo" to="/">Trimly</Link>
      <span>Book an appointment</span>
    </nav>

    <section className="business-hero container">
      {customization.profile_image_url ? (
        <img className="public-avatar public-avatar-image" src={customization.profile_image_url} alt="" />
      ) : (
        <div className="public-avatar">{(profile.business_name || 'B').slice(0, 1).toUpperCase()}</div>
      )}
      <div className="business-hero-content">
        <span className="public-eyebrow">Barber shop</span>
        <h1>{profile.business_name}</h1>
        {profile.city && <p className="business-meta">{profile.city}</p>}
        {customization.show_address !== false && profile.address && <p className="business-meta">{profile.address}</p>}
        {customization.show_phone !== false && profile.phone && <p className="business-meta"><a className="public-link" href={`tel:${profile.phone}`}>{profile.phone}</a></p>}
        {customization.show_description !== false && profile.description && <p className="business-description">{profile.description}</p>}
      </div>
    </section>

    <section className="public-content container">
      <div className="public-main">
        <div className="public-section">
          <div className="public-section-heading"><div><span className="public-eyebrow">Services</span><h2>Choose your service</h2></div></div>
          <div className="public-services">
            {services.map(service => <button className={`public-service ${selectedService?.id === service.id ? 'selected' : ''}`} key={service.id} onClick={() => chooseService(service)}>
              <div><strong>{service.name}</strong><span>{service.duration_minutes} min</span></div>
              <strong>{service.price} DH</strong>
            </button>)}
          </div>
          {services.length === 0 && <p className="empty">No services have been added yet.</p>}
        </div>

        {selectedService && <div className="public-section booking-box">
          <div className="public-section-heading"><div><span className="public-eyebrow">Availability</span><h2>Choose a time</h2></div></div>
          <div className="date-row">{Array.from({ length: 7 }, (_, i) => {
            const d = new Date()
            d.setDate(d.getDate() + i)
            const key = localDateKey(d)
            return <button key={key} className={key === selectedDate ? 'selected' : ''} onClick={() => { setSelectedDate(key); setSelectedTime(''); setConfirmation(null) }}>
              <span>{d.toLocaleDateString([], { weekday: 'short' })}</span><strong>{d.getDate()}</strong>
            </button>
          })}</div>
          <div className="time-grid">{slots.map(time => <button key={time} className={selectedTime === time ? 'selected' : ''} onClick={() => { setSelectedTime(time); setConfirmation(null) }}>{time}</button>)}{slots.length === 0 && <p className="empty">No available times on this date.</p>}</div>
        </div>}
      </div>

      <aside className="booking-card">
        {confirmation ? <div className="confirmation-card">
          <div className="confirmation-icon"><span>✓</span></div>
          <span className="public-eyebrow">Booking complete</span>
          <h2>Appointment confirmed</h2>
          <p className="confirmation-lead">You're booked, {confirmation.name}.</p>
          <div className="confirmation-details">
            <div><span>Service</span><strong>{confirmation.service}</strong></div>
            <div><span>When</span><strong>{formatAppointmentDate(confirmation.start)}</strong></div>
            <div><span>Duration</span><strong>{confirmation.duration} minutes</strong></div>
            <div><span>Price</span><strong>{confirmation.price} DH</strong></div>
          </div>
          <p className="confirmation-note">Please arrive a few minutes before your appointment.</p>
          <button className="button full" onClick={bookAnother}>Book another appointment</button>
        </div> : <>
          <span className="public-eyebrow">Your appointment</span>
          <h2>{selectedService ? `Book ${selectedService.name}` : 'Book an appointment'}</h2>
          {selectedService && selectedTime ? <form className="form-stack" onSubmit={book}>
            <div className="booking-summary"><strong>{selectedService.name}</strong><span>{selectedDate} at {selectedTime}</span><span>{selectedService.duration_minutes} min · {selectedService.price} DH</span></div>
            <label>Name<input value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} required /></label>
            <label>Phone<input value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} required /></label>
            <label>Email <span className="optional">optional</span><input type="email" value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })} /></label>
            {customization.allow_notes !== false && <label>Notes <span className="optional">optional</span><textarea rows="3" value={customer.notes} onChange={e => setCustomer({ ...customer, notes: e.target.value })} /></label>}
            {error && <div className="error">{error}</div>}
            <button className="button full" disabled={booking}>{booking ? 'Booking…' : 'Confirm appointment'}</button>
            <small className="muted">No account required.</small>
          </form> : <p className="muted">Select a service, date and available time. You won't need to create an account.</p>}
        </>}
      </aside>
    </section>
  </main>
}
