import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Loading from '../components/Loading'

function localDateKey(date) { return date.toISOString().slice(0, 10) }

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
    async function load() {
      const { data: p } = await supabase.from('profiles').select('*').eq('username', username).single()
      if (!p) return setLoading(false)
      const [s, h, a] = await Promise.all([
        supabase.from('services').select('*').eq('barber_id', p.id).order('created_at'),
        supabase.from('business_hours').select('*').eq('barber_id', p.id).order('day_of_week'),
        supabase.from('appointments').select('start_time, end_time').eq('barber_id', p.id).eq('status', 'confirmed').gte('start_time', new Date().toISOString())
      ])
      setProfile(p); setServices(s.data || []); setHours(h.data || []); setAppointments(a.data || []); setLoading(false)
    }
    load()
  }, [username])

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
    e.preventDefault(); setError(''); setResult('')
    if (!selectedService || !selectedTime) return setError('Choose a service and time.')
    setBooking(true)
    const start = new Date(`${selectedDate}T${selectedTime}:00`).toISOString()
    const { data, error } = await supabase.rpc('create_appointment', {
      p_barber_id: profile.id,
      p_service_id: selectedService.id,
      p_customer_name: customer.name.trim(),
      p_customer_phone: customer.phone.trim(),
      p_customer_email: customer.email.trim() || null,
      p_start_time: start,
      p_notes: customer.notes.trim() || null
    })
    if (error) setError(error.message)
    else { setResult(`Booked successfully. Your appointment is ${new Date(data.start_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}.`); setCustomer({ name: '', phone: '', email: '', notes: '' }); setSelectedTime('') }
    setBooking(false)
  }

  if (loading) return <div className="screen-center"><Loading /></div>
  if (!profile) return <div className="screen-center"><div><h1>Page not found</h1><Link to="/">Go home</Link></div></div>

  return <main className="public-page">
    <nav className="public-nav container"><Link className="logo" to="/">Trimly</Link><span>Book an appointment</span></nav>
    <section className="business-hero container"><div className="public-avatar">{(profile.business_name || 'B').slice(0, 1).toUpperCase()}</div><div><h1>{profile.business_name}</h1>{profile.city && <p>{profile.city}</p>}{profile.address && <p>{profile.address}</p>}{profile.phone && <p><a className="public-link" href={`tel:${profile.phone}`}>{profile.phone}</a></p>}{profile.description && <p className="business-description">{profile.description}</p>}</div></section>
    <section className="public-content container">
      <div className="public-main"><div className="public-section"><h2>Services</h2><div className="public-services">{services.map(service => <button className={`public-service ${selectedService?.id === service.id ? 'selected' : ''}`} key={service.id} onClick={() => { setSelectedService(service); setSelectedTime(''); setResult('') }}><div><strong>{service.name}</strong><span>{service.duration_minutes} min</span></div><strong>{service.price} DH</strong></button>)}</div>{services.length === 0 && <p>No services have been added yet.</p>}</div>
        {selectedService && <div className="public-section booking-box"><h2>Choose a time</h2><div className="date-row">{Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); const key = localDateKey(d); return <button key={key} className={key === selectedDate ? 'selected' : ''} onClick={() => { setSelectedDate(key); setSelectedTime('') }}><span>{d.toLocaleDateString([], { weekday: 'short' })}</span><strong>{d.getDate()}</strong></button> })}</div><div className="time-grid">{slots.map(time => <button key={time} className={selectedTime === time ? 'selected' : ''} onClick={() => setSelectedTime(time)}>{time}</button>)}{slots.length === 0 && <p className="empty">No available times on this date.</p>}</div></div>}
      </div>
      <aside className="booking-card"><h2>{selectedService ? `Book ${selectedService.name}` : 'Book an appointment'}</h2>{selectedService && selectedTime ? <form className="form-stack" onSubmit={book}><div className="booking-summary"><strong>{selectedService.name}</strong><span>{selectedDate} at {selectedTime}</span><span>{selectedService.price} DH</span></div><label>Name<input value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} required /></label><label>Phone<input value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} required /></label><label>Email <span className="optional">optional</span><input type="email" value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })} /></label><label>Notes <span className="optional">optional</span><textarea rows="3" value={customer.notes} onChange={e => setCustomer({ ...customer, notes: e.target.value })} /></label>{error && <div className="error">{error}</div>}{result && <div className="success">{result}</div>}<button className="button full" disabled={booking}>{booking ? 'Booking…' : 'Confirm appointment'}</button><small className="muted">No account required.</small></form> : <p className="muted">Select a service, date and available time. You won't need to create an account.</p>}</aside>
    </section>
  </main>
}
