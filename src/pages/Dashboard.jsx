import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Loading from '../components/Loading'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

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

export default function Dashboard() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [services, setServices] = useState([])
  const [hours, setHours] = useState([])
  const [appointments, setAppointments] = useState([])
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return navigate('/login')

    const [p, s, h, a] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('services').select('*').eq('barber_id', user.id).order('created_at'),
      supabase.from('business_hours').select('*').eq('barber_id', user.id).order('day_of_week'),
      supabase.from('appointments').select('*, services(name, price, duration_minutes)').eq('barber_id', user.id).order('start_time', { ascending: true })
    ])
    if (p.error) setMessage(p.error.message)
    setProfile(p.data)
    setServices(s.data || [])
    setHours(h.data || [])
    setAppointments(a.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function logout() {
    await supabase.auth.signOut()
    navigate('/')
  }

  if (loading) return <div className="screen-center"><Loading /></div>
  if (!profile) return <div className="screen-center"><div className="error">Could not load your profile. {message}</div></div>

  return <main className="dashboard-page">
    <header className="dashboard-header container">
      <div><Link className="logo" to="/">Trimly</Link><div className="dashboard-welcome">Dashboard</div></div>
      <div className="header-actions"><Link className="button secondary" to={`/${profile.username}`} target="_blank">View public page</Link><button className="button ghost" onClick={logout}>Log out</button></div>
    </header>
    <div className="dashboard-layout container">
      <aside className="sidebar">
        {['overview', 'business', 'services', 'hours', 'customization'].map(item => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}
      </aside>
      <section className="dashboard-content">
        {message && <div className="success">{message}</div>}
        {tab === 'overview' && <Overview profile={profile} appointments={appointments} services={services} />}
        {tab === 'business' && <Business profile={profile} onSaved={load} />}
        {tab === 'services' && <Services barberId={profile.id} services={services} onChanged={load} />}
        {tab === 'hours' && <Hours barberId={profile.id} hours={hours} onChanged={load} />}
        {tab === 'customization' && <Customization profile={profile} onSaved={load} />}
      </section>
    </div>
  </main>
}

function Overview({ profile, appointments, services }) {
  const upcoming = appointments.filter(a => new Date(a.start_time) >= new Date() && a.status === 'confirmed').slice(0, 10)
  const today = appointments.filter(a => new Date(a.start_time).toDateString() === new Date().toDateString() && a.status === 'confirmed')
  return <>
    <div className="section-heading"><div><span className="eyebrow">Your business</span><h1>{profile.business_name || 'Your barber shop'}</h1><p>{profile.city || profile.address || 'Add your location to your public page.'}</p></div><Link className="button" to={`/${profile.username}`} target="_blank">Open page</Link></div>
    <div className="stats-grid"><Stat label="Today's bookings" value={today.length} /><Stat label="Services" value={services.length} /><Stat label="Upcoming" value={upcoming.length} /><Stat label="Page" value={`/${profile.username}`} small /></div>
    <div className="panel"><div className="panel-title"><h2>Upcoming appointments</h2></div>{upcoming.length === 0 ? <p className="empty">No upcoming appointments yet.</p> : <div className="appointment-list">{upcoming.map(a => <Appointment key={a.id} appointment={a} />)}</div>}</div>
  </>
}

function Stat({ label, value, small }) { return <div className="stat"><span>{label}</span><strong className={small ? 'small-value' : ''}>{value}</strong></div> }

function Appointment({ appointment }) {
  const date = new Date(appointment.start_time)
  return <div className="appointment"><div><strong>{appointment.customer_name}</strong><span>{appointment.services?.name || 'Service'}</span></div><div className="appointment-time"><strong>{date.toLocaleDateString()}</strong><span>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div></div>
}

function Business({ profile, onSaved }) {
  const [form, setForm] = useState(profile)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => setForm(profile), [profile])
  async function save(e) {
    e.preventDefault(); setSaving(true); setError('')
    const { error } = await supabase.from('profiles').update({ business_name: form.business_name, description: form.description, phone: form.phone, email: form.email, address: form.address, city: form.city }).eq('id', profile.id)
    if (error) setError(error.message); else onSaved()
    setSaving(false)
  }
  return <Editor title="Business information" subtitle="This information appears on your public barber page.">
    <form className="form-grid" onSubmit={save}>
      <Field label="Business name" value={form.business_name || ''} onChange={v => setForm({ ...form, business_name: v })} />
      <Field label="Phone" value={form.phone || ''} onChange={v => setForm({ ...form, phone: v })} />
      <Field label="Public email" type="email" value={form.email || ''} onChange={v => setForm({ ...form, email: v })} />
      <Field label="City" value={form.city || ''} onChange={v => setForm({ ...form, city: v })} />
      <Field label="Address" value={form.address || ''} onChange={v => setForm({ ...form, address: v })} wide />
      <label className="wide">Description<textarea rows="5" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Tell customers about your shop…" /></label>
      {error && <div className="error wide">{error}</div>}
      <button className="button" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
    </form>
  </Editor>
}

function Services({ barberId, services, onChanged }) {
  const [form, setForm] = useState({ name: '', description: '', price: '', duration_minutes: 30 })
  const [error, setError] = useState('')
  async function add(e) {
    e.preventDefault(); setError('')
    const { error } = await supabase.from('services').insert({ barber_id: barberId, name: form.name, description: form.description, price: Number(form.price), duration_minutes: Number(form.duration_minutes) })
    if (error) return setError(error.message)
    setForm({ name: '', description: '', price: '', duration_minutes: 30 }); onChanged()
  }
  async function remove(id) { await supabase.from('services').delete().eq('id', id); onChanged() }
  return <Editor title="Services" subtitle="Add the services customers can book.">
    <form className="service-add" onSubmit={add}><Field label="Service name" value={form.name} onChange={v => setForm({ ...form, name: v })} /><Field label="Description" value={form.description} onChange={v => setForm({ ...form, description: v })} /><Field label="Price" type="number" value={form.price} onChange={v => setForm({ ...form, price: v })} /><Field label="Duration (minutes)" type="number" value={form.duration_minutes} onChange={v => setForm({ ...form, duration_minutes: v })} /><button className="button" disabled={!form.name || !form.price}>Add service</button></form>
    {error && <div className="error">{error}</div>}
    <div className="service-list">{services.map(service => <div className="service-row" key={service.id}><div><strong>{service.name}</strong><span>{service.duration_minutes} min{service.description ? ` · ${service.description}` : ''}</span></div><div><strong>{service.price} DH</strong><button className="text-danger" onClick={() => remove(service.id)}>Delete</button></div></div>)}{services.length === 0 && <p className="empty">No services yet.</p>}</div>
  </Editor>
}

function Hours({ barberId, hours, onChanged }) {
  const initial = useMemo(() => DAYS.map((_, day) => hours.find(h => h.day_of_week === day) || { day_of_week: day, is_open: day !== 0, opening_time: '09:00', closing_time: '18:00' }), [hours])
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  useEffect(() => setForm(initial), [hours])
  async function save(e) {
    e.preventDefault(); setSaving(true)
    await supabase.from('business_hours').delete().eq('barber_id', barberId)
    const rows = form.map(h => ({ barber_id: barberId, ...h }))
    await supabase.from('business_hours').insert(rows)
    setSaving(false); onChanged()
  }
  return <Editor title="Opening hours" subtitle="Set when customers can book appointments."><form className="hours-list" onSubmit={save}>{form.map((h, i) => <div className="hours-row" key={i}><strong>{DAYS[i]}</strong><label className="switch"><input type="checkbox" checked={h.is_open} onChange={e => setForm(form.map((x, j) => j === i ? { ...x, is_open: e.target.checked } : x))} /><span /></label><input type="time" disabled={!h.is_open} value={h.opening_time || ''} onChange={e => setForm(form.map((x, j) => j === i ? { ...x, opening_time: e.target.value } : x))} /><span>to</span><input type="time" disabled={!h.is_open} value={h.closing_time || ''} onChange={e => setForm(form.map((x, j) => j === i ? { ...x, closing_time: e.target.value } : x))} /></div>)}<button className="button" disabled={saving}>{saving ? 'Saving…' : 'Save hours'}</button></form></Editor>
}

function Customization({ profile, onSaved }) {
  const [form, setForm] = useState(() => ({ ...DEFAULT_CUSTOMIZATION, ...profile }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState('')

  useEffect(() => setForm({ ...DEFAULT_CUSTOMIZATION, ...profile }), [profile])

  function update(key, value) {
    setForm(current => ({ ...current, [key]: value }))
  }

  async function uploadImage(type, file) {
    if (!file) return
    setError('')
    if (!file.type.startsWith('image/')) return setError('Please choose an image file.')
    if (file.size > 5 * 1024 * 1024) return setError('Images must be 5 MB or smaller.')
    setUploading(type)
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${profile.id}/${type}-${Date.now()}.${extension}`
    const { error: uploadError } = await supabase.storage.from('barber-assets').upload(path, file, { upsert: true, contentType: file.type })
    if (uploadError) {
      setError(uploadError.message)
      setUploading('')
      return
    }
    const { data } = supabase.storage.from('barber-assets').getPublicUrl(path)
    update(type === 'profile' ? 'profile_image_url' : 'cover_image_url', data.publicUrl)
    setUploading('')
  }

  function clearImage(type) {
    update(type === 'profile' ? 'profile_image_url' : 'cover_image_url', '')
  }

  async function save(e) {
    e.preventDefault(); setSaving(true); setError('')
    const payload = {
      primary_color: form.primary_color || null,
      secondary_color: form.secondary_color || null,
      background_style: form.background_style || null,
      button_style: form.button_style || null,
      page_style: form.page_style || null,
      enable_effects: form.enable_effects,
      show_phone: form.show_phone,
      show_address: form.show_address,
      show_description: form.show_description,
      allow_notes: form.allow_notes,
      profile_image_url: form.profile_image_url || null,
      cover_image_url: form.cover_image_url || null
    }
    const { error: saveError } = await supabase.from('profiles').update(payload).eq('id', profile.id)
    if (saveError) setError(saveError.message)
    else onSaved()
    setSaving(false)
  }

  function resetToDefaults() {
    setForm(current => ({ ...current, ...DEFAULT_CUSTOMIZATION, profile_image_url: '', cover_image_url: '' }))
  }

  return <Editor title="Customize your page" subtitle="Everything here is optional. Leave the defaults for the normal Trimly look.">
    <form className="customization-form" onSubmit={save}>
      <div className="customization-section">
        <div className="customization-heading"><div><h3>Colors</h3><p>Choose the main and accent colors used on your public page.</p></div></div>
        <div className="customization-grid two">
          <ColorField label="Main color" value={form.primary_color} onChange={v => update('primary_color', v)} />
          <ColorField label="Secondary color" value={form.secondary_color} onChange={v => update('secondary_color', v)} />
        </div>
      </div>

      <div className="customization-section">
        <div className="customization-heading"><div><h3>Appearance</h3><p>Small style choices change the personality of the page without changing its layout.</p></div></div>
        <div className="choice-group"><span className="choice-label">Page style</span><div className="choice-row">{[['minimal', 'Minimal'], ['modern', 'Modern'], ['classic', 'Classic'], ['elegant', 'Elegant']].map(([value, label]) => <Choice key={value} label={label} selected={form.page_style === value} onClick={() => update('page_style', value)} />)}</div></div>
        <div className="choice-group"><span className="choice-label">Button style</span><div className="choice-row">{[['rounded', 'Rounded'], ['soft', 'Soft'], ['square', 'Square']].map(([value, label]) => <Choice key={value} label={label} selected={form.button_style === value} onClick={() => update('button_style', value)} />)}</div></div>
        <div className="choice-group"><span className="choice-label">Background</span><div className="choice-row">{[['light', 'Light'], ['warm', 'Warm'], ['cool', 'Cool'], ['dark', 'Dark']].map(([value, label]) => <Choice key={value} label={label} selected={form.background_style === value} onClick={() => update('background_style', value)} />)}</div></div>
        <ToggleRow label="Subtle effects" description="Gentle hover, fade and entrance effects on the public page." checked={form.enable_effects !== false} onChange={v => update('enable_effects', v)} />
      </div>

      <div className="customization-section">
        <div className="customization-heading"><div><h3>Images</h3><p>Both images are optional. If you do not add them, the page uses the normal Trimly design.</p></div></div>
        <div className="image-custom-grid">
          <ImageUpload title="Profile image" value={form.profile_image_url} uploading={uploading === 'profile'} onUpload={file => uploadImage('profile', file)} onClear={() => clearImage('profile')} circle />
          <ImageUpload title="Cover image" value={form.cover_image_url} uploading={uploading === 'cover'} onUpload={file => uploadImage('cover', file)} onClear={() => clearImage('cover')} />
        </div>
      </div>

      <div className="customization-section">
        <div className="customization-heading"><div><h3>Public information</h3><p>Choose which optional business information customers can see.</p></div></div>
        <ToggleRow label="Phone number" description="Show your phone number and call button." checked={form.show_phone !== false} onChange={v => update('show_phone', v)} />
        <ToggleRow label="Address" description="Show your shop address." checked={form.show_address !== false} onChange={v => update('show_address', v)} />
        <ToggleRow label="Description" description="Show your business description below the shop name." checked={form.show_description !== false} onChange={v => update('show_description', v)} />
        <ToggleRow label="Customer notes" description="Let customers add notes when booking." checked={form.allow_notes !== false} onChange={v => update('allow_notes', v)} />
      </div>

      {error && <div className="error">{error}</div>}
      <div className="customization-actions"><button type="button" className="button secondary" onClick={resetToDefaults}>Reset defaults</button><button className="button" disabled={saving || !!uploading}>{saving ? 'Saving…' : 'Save customization'}</button></div>
    </form>
  </Editor>
}

function ColorField({ label, value, onChange }) {
  return <label className="color-field">{label}<div><input className="color-picker" type="color" value={value || '#171717'} onChange={e => onChange(e.target.value)} /><input className="color-text" value={value || ''} onChange={e => onChange(e.target.value)} placeholder="#171717" maxLength="7" /></div></label>
}

function Choice({ label, selected, onClick }) { return <button type="button" className={`choice ${selected ? 'selected' : ''}`} onClick={onClick}>{label}</button> }

function ToggleRow({ label, description, checked, onChange }) {
  return <div className="custom-toggle-row"><div><strong>{label}</strong><span>{description}</span></div><label className="switch"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /><span /></label></div>
}

function ImageUpload({ title, value, uploading, onUpload, onClear, circle = false }) {
  return <div className="image-upload-card">
    <div className={`image-preview ${circle ? 'circle' : ''}`}>{value ? <img src={value} alt="" /> : <span>{circle ? 'Photo' : 'Cover'}</span>}</div>
    <div className="image-upload-info"><strong>{title}</strong><span>Optional · JPG, PNG or WebP · max 5 MB</span><div className="image-upload-actions"><label className="button secondary upload-button">{uploading ? 'Uploading…' : value ? 'Replace' : 'Upload'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { onUpload(e.target.files?.[0]); e.target.value = '' }} disabled={uploading} /></label>{value && <button type="button" className="button ghost" onClick={onClear}>Remove</button>}</div></div>
  </div>
}

function Editor({ title, subtitle, children }) { return <div className="panel editor"><div className="panel-title"><div><h2>{title}</h2><p>{subtitle}</p></div></div>{children}</div> }
function Field({ label, value, onChange, type = 'text', wide = false }) { return <label className={wide ? 'wide' : ''}>{label}<input type={type} value={value} onChange={e => onChange(e.target.value)} required /></label> }
