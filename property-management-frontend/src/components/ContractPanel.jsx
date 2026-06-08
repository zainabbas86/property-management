import { useState } from 'react'
import client from '../api/client'

const blankForm = { tenant_name: '', start_date: '', end_date: '', rent_amount: '', status: 'active' }

const toFormState = (contract) => contract
  ? {
      tenant_name: contract.tenant_name,
      start_date: contract.start_date.slice(0, 10),
      end_date: contract.end_date.slice(0, 10),
      rent_amount: contract.rent_amount,
      status: contract.status,
    }
  : blankForm

export default function ContractPanel({ propertyId, contract, onChange }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(() => toFormState(contract))
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const startEditing = () => {
    setForm(toFormState(contract))
    setError(null)
    setEditing(true)
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const url = `/properties/${propertyId}/contract`
      const res = contract
        ? await client.put(url, form)
        : await client.post(url, form)

      onChange(res.data)
      setEditing(false)
    } catch (err) {
      const messages = err.response?.data?.errors
      setError(messages ? Object.values(messages).flat().join(' ') : 'Unable to save contract.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this contract? This cannot be undone.')) {
      return
    }

    await client.delete(`/properties/${propertyId}/contract`)
    onChange(null)
  }

  return (
    <section className="card">
      <h2>Contract</h2>

      {!contract && !editing && (
        <>
          <p className="status">This property has no active contract.</p>
          <button type="button" onClick={startEditing}>Add contract</button>
        </>
      )}

      {contract && !editing && (
        <>
          <dl className="contract-summary">
            <dt>Tenant</dt>
            <dd>{contract.tenant_name}</dd>
            <dt>Term</dt>
            <dd>{contract.start_date.slice(0, 10)} &rarr; {contract.end_date.slice(0, 10)}</dd>
            <dt>Rent</dt>
            <dd>${Number(contract.rent_amount).toFixed(2)} / month</dd>
            <dt>Status</dt>
            <dd className="badge">{contract.status}</dd>
          </dl>
          <div className="button-row">
            <button type="button" onClick={startEditing}>Edit contract</button>
            <button type="button" className="danger" onClick={handleDelete}>Delete contract</button>
          </div>
        </>
      )}

      {editing && (
        <form onSubmit={handleSubmit}>
          <label>
            Tenant name
            <input type="text" name="tenant_name" value={form.tenant_name} onChange={handleChange} required />
          </label>
          <label>
            Start date
            <input type="date" name="start_date" value={form.start_date} onChange={handleChange} required />
          </label>
          <label>
            End date
            <input type="date" name="end_date" value={form.end_date} onChange={handleChange} required />
          </label>
          <label>
            Rent amount (monthly)
            <input type="number" name="rent_amount" min="0" step="0.01" value={form.rent_amount} onChange={handleChange} required />
          </label>
          {contract && (
            <label>
              Status
              <select name="status" value={form.status} onChange={handleChange}>
                <option value="active">Active</option>
                <option value="terminated">Terminated</option>
                <option value="expired">Expired</option>
              </select>
            </label>
          )}
          {error && <p className="error">{error}</p>}
          <div className="button-row">
            <button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save contract'}
            </button>
            <button type="button" className="link" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      )}
    </section>
  )
}
