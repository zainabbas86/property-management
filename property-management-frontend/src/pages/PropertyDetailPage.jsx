import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import client from '../api/client'
import ContractPanel from '../components/ContractPanel'

export default function PropertyDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [property, setProperty] = useState(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(null)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const loadProperty = () => {
    setLoading(true)
    client
      .get(`/properties/${id}`)
      .then((res) => {
        setProperty(res.data)
        setForm({
          name: res.data.name,
          address: res.data.address,
          type: res.data.type,
          description: res.data.description ?? '',
        })
      })
      .finally(() => setLoading(false))
  }

  useEffect(loadProperty, [id])

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const res = await client.put(`/properties/${id}`, form)
      setProperty({ ...res.data, contract: property.contract })
    } catch (err) {
      const messages = err.response?.data?.errors
      setError(messages ? Object.values(messages).flat().join(' ') : 'Unable to save changes.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this property and its contract? This cannot be undone.')) {
      return
    }

    await client.delete(`/properties/${id}`)
    navigate('/properties')
  }

  if (loading || !property) {
    return <p className="status">Loading…</p>
  }

  return (
    <div>
      <p><button type="button" className="link" onClick={() => navigate('/properties')}>&larr; Back to properties</button></p>

      <h1>{property.name}</h1>

      <section className="card">
        <h2>Details</h2>
        <form onSubmit={handleSave}>
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
            <input type="text" name="type" value={form.type} onChange={handleChange} required />
          </label>
          <label>
            Description
            <textarea name="description" value={form.description} onChange={handleChange} />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="button-row">
            <button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" className="danger" onClick={handleDelete}>
              Delete property
            </button>
          </div>
        </form>
      </section>

      <ContractPanel
        propertyId={property.id}
        contract={property.contract}
        onChange={(contract) => setProperty({ ...property, contract })}
      />
    </div>
  )
}
