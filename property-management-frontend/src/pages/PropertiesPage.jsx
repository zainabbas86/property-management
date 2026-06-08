import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'

const emptyForm = { name: '', address: '', type: '', description: '' }

export default function PropertiesPage() {
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const loadProperties = () => {
    setLoading(true)
    client
      .get('/properties')
      .then((res) => setProperties(res.data))
      .finally(() => setLoading(false))
  }

  useEffect(loadProperties, [])

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const res = await client.post('/properties', form)
      setProperties([...properties, res.data])
      setForm(emptyForm)
    } catch (err) {
      const messages = err.response?.data?.errors
      setError(messages ? Object.values(messages).flat().join(' ') : 'Unable to create property.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1>Your properties</h1>

      {loading ? (
        <p className="status">Loading…</p>
      ) : properties.length === 0 ? (
        <p className="status">You don't have any properties yet. Add one below.</p>
      ) : (
        <ul className="property-list">
          {properties.map((property) => (
            <li key={property.id}>
              <Link to={`/properties/${property.id}`}>
                <strong>{property.name}</strong>
                <span>{property.address}</span>
                <span className="badge">{property.type}</span>
                <span className={`badge ${property.contract ? 'badge-active' : 'badge-empty'}`}>
                  {property.contract ? `Rented (${property.contract.status})` : 'No contract'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="card">
        <h2>Add a property</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Name
            <input type="text" name="name" value={form.name} onChange={handleChange} required />
          </label>
          <label>
            Address
            <input type="text" name="address" value={form.address} onChange={handleChange} required />
          </label>
          <label>
            Type
            <input type="text" name="type" value={form.type} onChange={handleChange} placeholder="apartment, house, commercial…" required />
          </label>
          <label>
            Description
            <textarea name="description" value={form.description} onChange={handleChange} />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add property'}
          </button>
        </form>
      </section>
    </div>
  )
}
