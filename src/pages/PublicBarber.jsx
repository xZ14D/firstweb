import { useEffect, useMemo, useRef, useState } from 'react'
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

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]
const DAYS_AHEAD = 14

/* ---------- helpers ---------- */

function localDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatAppointmentDate(start) {
  return new Date(start).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })
}

const hhmm = value => (value || '').slice(0, 5)

function hexToRgb(hex) {
  let h = String(hex || '').replace('#', '').trim()
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  if (!/^[0-9a-f]{6}$/i.test(h)) return null
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))
}

function luminance(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const [r, g, b] = rgb.map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a, b) {
  const la = luminance(a)
  const lb = luminance(b)
  if (la === null || lb === null) return 21
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

function readableOn(hex) {
  return contrast(hex, '#ffffff') >= contrast(hex, '#111111') ? '#ffffff' : '#111111'
}

function getOpenStatus(hours) {
  if (!hours.length) return null
  const now = new Date()
  const today = hours.find(h => h.day_of_week === now.getDay())
  if (!today || !today.is_open) return { open: false, label: 'Closed today' }
  const [oh, om] = today.opening_time.split(':').map(Number)
  const [ch, cm] = today.closing_time.split(':').map(Number)
  const current = now.getHours() * 60 + now.getMinutes()
  if (current >= oh * 60 + om && current < ch * 60 + cm) return { open: true, label: `Open now · until ${hhmm(today.closing_time)}` }
  if (current < oh * 60 + om) return { open: false, label: `Opens today at ${hhmm(today.opening_time)}` }
  return { open: false, label: 'Closed for today' }
}

function icsStamp(iso) {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function icsText(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/[,;]/g, m => `\\${m}`).replace(/\n/g, '\\n')
}

function downloadCalendar(confirmation, shop) {
  const location = [shop.address, shop.city].filter(Boolean).join(', ')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Trimly//Booking//EN',
    'BEGIN:VEVENT',
    `UID:${icsStamp(confirmation.start)}-${Math.random().toString(36).slice(2)}@trimly`,
    `DTSTAMP:${icsStamp(new Date().toISOString())}`,
    `DTSTART:${icsStamp(confirmation.start)}`,
    `DTEND:${icsStamp(confirmation.end)}`,
    `SUMMARY:${icsText(`${confirmation.service} at ${shop.business_name}`)}`,
    location ? `LOCATION:${icsText(location)}` : null,
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean)
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'appointment.ics'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Icon({ name }) {
  const paths = {
    pin: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
    phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />,
    clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
    check: <path d="M20 6 9 17l-5-5" />,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>
  }
  return <svg className="pb-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

/* ---------- page ---------- */

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

  const timeRef = useRef(null)
  const detailsRef = useRef(null)
  const flowRef = useRef(null)

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

  /* theme */
  const customization = { ...DEFAULT_CUSTOMIZATION, ...(profile || {}) }
  const backgroundKey = BACKGROUNDS[customization.background_style] ? customization.background_style : 'light'
  const background = BACKGROUNDS[backgroundKey]
  const pageStyle = customization.page_style || 'minimal'
  const buttonStyle = customization.button_style || 'rounded'
  const pageClass = `public-page style-${pageStyle} button-${buttonStyle} background-${backgroundKey} ${customization.enable_effects === false ? 'effects-off' : 'effects-on'}`

  const chosenPrimary = customization.primary_color || DEFAULT_CUSTOMIZATION.primary_color
  // If the brand colour would disappear on the page surface (e.g. near-black on dark mode), fall back to the text colour.
  const brand = contrast(chosenPrimary, background.surface) >= 1.25 ? chosenPrimary : background.text
  const accent = contrast(brand, background.surface) >= 3 ? brand : background.text
  const secondary = customization.secondary_color || DEFAULT_CUSTOMIZATION.secondary_color
  const pageVars = {
    '--public-primary': brand,
    '--public-on-secondary': readableOn(secondary),
    '--public-on-primary': readableOn(brand),
    '--public-accent': accent,
    '--public-secondary': secondary,
    '--public-bg': background.bg,
    '--public-surface': background.surface,
    '--public-soft': background.soft,
    '--public-text': background.text,
    '--public-muted': background.muted,
    '--public-border': background.border
  }

  /* dates, hours, slots */
  const days = useMemo(() => Array.from({ length: DAYS_AHEAD }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() + i)
    return { key: localDateKey(date), date, open: hours.some(h => h.day_of_week === date.getDay() && h.is_open) }
  }), [hours])

  // If today is closed, start on the first day the shop is actually open.
  useEffect(() => {
    if (!hours.length) return
    const current = days.find(d => d.key === selectedDate)
    if (current && !current.open) {
      const firstOpen = days.find(d => d.open)
      if (firstOpen) setSelectedDate(firstOpen.key)
    }
  }, [days]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedDay = new Date(`${selectedDate}T12:00:00`).getDay()
  const dayHours = hours.find(h => h.day_of_week === selectedDay)
  const prettyDate = new Date(`${selectedDate}T12:00:00`).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })
  const status = getOpenStatus(hours)

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

  const slotGroups = useMemo(() => {
    const groups = [
      { key: 'morning', label: 'Morning', items: [] },
      { key: 'afternoon', label: 'Afternoon', items: [] },
      { key: 'evening', label: 'Evening', items: [] }
    ]
    slots.forEach(time => {
      const h = Number(time.slice(0, 2))
      groups[h < 12 ? 0 : h < 17 ? 1 : 2].items.push(time)
    })
    return groups.filter(g => g.items.length)
  }, [slots])

  /* actions */
  function scrollToRef(ref) {
    if (window.innerWidth >= 900) return
    setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }

  function chooseService(service) {
    setSelectedService(service)
    setSelectedTime('')
    setError('')
    setConfirmation(null)
    scrollToRef(timeRef)
  }

  function chooseDate(key) {
    setSelectedDate(key)
    setSelectedTime('')
    setConfirmation(null)
  }

  function chooseTime(time) {
    setSelectedTime(time)
    setConfirmation(null)
    scrollToRef(detailsRef)
  }

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
    setSelectedService(null)
    setBooking(false)
  }

  useEffect(() => {
    if (confirmation) flowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [confirmation])

  function bookAnother() {
    setConfirmation(null)
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /* render */
  if (loading) return <div className="screen-center"><Loading /></div>
  if (!profile) return <div className="screen-center"><div><h1>Page not found</h1><Link to="/">Go home</Link></div></div>

  const showAddress = customization.show_address !== false && profile.address
  const showPhone = customization.show_phone !== false && profile.phone
  const showDescription = customization.show_description !== false && profile.description
  const location = [profile.city, showAddress ? profile.address : null].filter(Boolean).join(' · ')

  const stepState = n => {
    if (n === 1) return selectedService ? 'is-done' : 'is-active'
    if (n === 2) return !selectedService ? 'is-locked' : selectedTime ? 'is-done' : 'is-active'
    return !selectedTime ? 'is-locked' : 'is-active'
  }

  const stepNumber = (n, state) => <span className="pb-step-num">{state === 'is-done' ? <Icon name="check" /> : n}</span>

  return <main className={pageClass} style={pageVars}>
    <header className="pb-nav container">
      <Link className="logo" to="/">Trimly</Link>
      <span className="pb-nav-tag"><Icon name="calendar" /> Online booking</span>
    </header>

    {/* ---------- hero ---------- */}
    <section className="pb-hero container">
      <div className="pb-cover" style={customization.cover_image_url ? { backgroundImage: `url(${customization.cover_image_url})` } : undefined} />
      <div className="pb-hero-card">
        {customization.profile_image_url
          ? <img className="pb-avatar" src={customization.profile_image_url} alt="" />
          : <div className="pb-avatar" aria-hidden="true">{(profile.business_name || 'B').slice(0, 1).toUpperCase()}</div>}

        <div className="pb-hero-body">
          <div className="pb-hero-top">
            <span className="pb-eyebrow">Barber shop</span>
            {status && <span className={`pb-status ${status.open ? 'is-open' : ''}`}><i />{status.label}</span>}
          </div>
          <h1>{profile.business_name}</h1>
          {(location || showPhone) && <ul className="pb-facts">
            {location && <li><Icon name="pin" />{location}</li>}
            {showPhone && <li><Icon name="phone" /><a href={`tel:${profile.phone}`}>{profile.phone}</a></li>}
          </ul>}
          {showDescription && <p className="pb-description">{profile.description}</p>}
        </div>

        <div className="pb-hero-actions">
          <a className="button" href="#pb-services" onClick={e => { e.preventDefault(); document.getElementById('pb-services')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>Book now</a>
          {showPhone && <a className="button secondary" href={`tel:${profile.phone}`}><Icon name="phone" /> Call</a>}
        </div>
      </div>
    </section>

    {/* ---------- booking ---------- */}
    <div className="pb-layout container">
      <div className="pb-flow" ref={flowRef}>
        {confirmation ? <section className="pb-card pb-confirm" aria-live="polite">
          <div className="pb-confirm-icon"><Icon name="check" /></div>
          <span className="pb-eyebrow">Booking complete</span>
          <h2>You're booked, {confirmation.name}.</h2>
          <p className="pb-confirm-lead">Your appointment at {profile.business_name} is confirmed.</p>
          <div className="pb-confirm-grid">
            <div><span>Service</span><strong>{confirmation.service}</strong></div>
            <div><span>Price</span><strong>{confirmation.price} DH</strong></div>
            <div><span>When</span><strong>{formatAppointmentDate(confirmation.start)}</strong></div>
            <div><span>Duration</span><strong>{confirmation.duration} minutes</strong></div>
            {(showAddress || profile.city) && <div className="wide-cell"><span>Where</span><strong>{[profile.address && showAddress ? profile.address : null, profile.city].filter(Boolean).join(', ')}</strong></div>}
          </div>
          <p className="pb-note">Please arrive a few minutes before your appointment.</p>
          <div className="pb-confirm-actions">
            <button type="button" className="button" onClick={() => downloadCalendar(confirmation, profile)}><Icon name="calendar" /> Add to calendar</button>
            <button type="button" className="button secondary" onClick={bookAnother}>Book another</button>
          </div>
        </section> : <>
          {/* step 1 */}
          <section id="pb-services" className={`pb-card pb-step ${stepState(1)}`}>
            <div className="pb-step-head">
              {stepNumber(1, stepState(1))}
              <div><h2>Choose a service</h2><p>Pick what you'd like done.</p></div>
            </div>
            <div className="pb-services">
              {services.map(service => <button type="button" key={service.id} className={`pb-service ${selectedService?.id === service.id ? 'selected' : ''}`} aria-pressed={selectedService?.id === service.id} onClick={() => chooseService(service)}>
                <span className="pb-service-main">
                  <span className="pb-service-name">{service.name}</span>
                  <span className="pb-service-meta"><Icon name="clock" />{service.duration_minutes} min</span>
                </span>
                <span className="pb-service-leader" aria-hidden="true" />
                <span className="pb-service-price">{service.price} DH</span>
                <span className="pb-service-check"><Icon name="check" /></span>
              </button>)}
            </div>
            {services.length === 0 && <p className="pb-empty">No services have been added yet.</p>}
          </section>

          {/* step 2 */}
          <section ref={timeRef} className={`pb-card pb-step ${stepState(2)}`}>
            <div className="pb-step-head">
              {stepNumber(2, stepState(2))}
              <div><h2>Pick a date &amp; time</h2><p>{selectedService ? `${selectedService.duration_minutes} minute appointment` : 'Choose a service first.'}</p></div>
            </div>
            {selectedService ? <>
              <div className="pb-dates" role="group" aria-label="Choose a date">
                {days.map((d, i) => <button type="button" key={d.key} disabled={!d.open} className={`pb-date ${d.key === selectedDate ? 'selected' : ''}`} aria-pressed={d.key === selectedDate} onClick={() => chooseDate(d.key)}>
                  <small>{i === 0 ? 'Today' : d.date.toLocaleDateString([], { weekday: 'short' })}</small>
                  <strong>{d.date.getDate()}</strong>
                  <em>{d.date.toLocaleDateString([], { month: 'short' })}</em>
                </button>)}
              </div>
              <p className="pb-subhead">{prettyDate}</p>
              {slotGroups.map(group => <div className="pb-slot-group" key={group.key}>
                <p className="pb-slot-label">{group.label}</p>
                <div className="pb-slots">
                  {group.items.map(time => <button type="button" key={time} className={`pb-slot ${selectedTime === time ? 'selected' : ''}`} aria-pressed={selectedTime === time} onClick={() => chooseTime(time)}>{time}</button>)}
                </div>
              </div>)}
              {slots.length === 0 && <p className="pb-empty">{dayHours?.is_open ? 'No available times on this date. Try another day.' : 'The shop is closed on this day.'}</p>}
            </> : <p className="pb-locked-note">Select a service above to see available dates and times.</p>}
          </section>

          {/* step 3 */}
          <section ref={detailsRef} className={`pb-card pb-step ${stepState(3)}`}>
            <div className="pb-step-head">
              {stepNumber(3, stepState(3))}
              <div><h2>Your details</h2><p>No account needed.</p></div>
            </div>
            {selectedService && selectedTime ? <form className="pb-form" onSubmit={book}>
              <label className="pb-field">Name<input autoComplete="name" value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} required /></label>
              <label className="pb-field">Phone<input type="tel" inputMode="tel" autoComplete="tel" value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} required /></label>
              <label className="pb-field full">Email <span className="optional">optional</span><input type="email" autoComplete="email" value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })} /></label>
              {customization.allow_notes !== false && <label className="pb-field full">Notes <span className="optional">optional</span><textarea rows="3" placeholder="Anything the barber should know?" value={customer.notes} onChange={e => setCustomer({ ...customer, notes: e.target.value })} /></label>}
              {error && <div className="error full" role="alert">{error}</div>}
              <div className="pb-form-foot full">
                <button className="button full" disabled={booking}>{booking ? 'Booking…' : `Confirm · ${selectedService.price} DH`}</button>
                <small>You'll see your confirmation right after.</small>
              </div>
            </form> : <p className="pb-locked-note">Choose a time to finish your booking.</p>}
          </section>
        </>}
      </div>

      <aside className="pb-aside">
        {!confirmation && <section className="pb-card pb-summary">
          <span className="pb-eyebrow">Your booking</span>
          {selectedService ? <>
            <dl className="pb-summary-list">
              <div className="pb-summary-row"><dt>Service</dt><dd>{selectedService.name}</dd></div>
              <div className="pb-summary-row"><dt>Duration</dt><dd>{selectedService.duration_minutes} min</dd></div>
              <div className="pb-summary-row"><dt>When</dt><dd>{selectedTime ? `${prettyDate}, ${selectedTime}` : <span className="pb-pending">Pick a time</span>}</dd></div>
            </dl>
            <div className="pb-summary-total"><span>Total</span><strong>{selectedService.price} DH</strong></div>
          </> : <p className="pb-summary-empty">Your selection will appear here as you go.</p>}
          <ul className="pb-assurance">
            <li><Icon name="check" />No account required</li>
            <li><Icon name="check" />Instant confirmation</li>
          </ul>
        </section>}

        {hours.length > 0 && <section className="pb-card pb-hours">
          <span className="pb-eyebrow">Opening hours</span>
          <ul className="pb-hours-list">
            {WEEK_ORDER.map(day => {
              const h = hours.find(x => x.day_of_week === day)
              const open = h && h.is_open
              return <li key={day} className={`${day === new Date().getDay() ? 'is-today' : ''} ${open ? '' : 'is-closed'}`}>
                <span>{DAY_NAMES[day]}</span>
                <span>{open ? `${hhmm(h.opening_time)} – ${hhmm(h.closing_time)}` : 'Closed'}</span>
              </li>
            })}
          </ul>
        </section>}
      </aside>
    </div>

    <footer className="pb-footer container">Bookings powered by <Link to="/">Trimly</Link></footer>
  </main>
}