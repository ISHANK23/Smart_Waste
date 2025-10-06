import React, { useState } from 'react';
import apiClient from '../services/apiClient';

const CollectionScanner = () => {
  const [form, setForm] = useState({ binId: '', weight: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const payload = { binId: form.binId, weight: Number(form.weight) };
      await apiClient.post('/api/collections/scan', payload);
      setMessage('Collection recorded successfully!');
      setForm({ binId: '', weight: '' });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to record collection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Collection Scanner</h2>
      <p>Manually record bin collections when QR scanning is unavailable.</p>
      <form onSubmit={handleSubmit} className="grid">
        <div className="form-group">
          <label htmlFor="binId">Bin ID</label>
          <input
            id="binId"
            name="binId"
            value={form.binId}
            onChange={handleChange}
            placeholder="Enter bin identifier"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="weight">Weight (kg)</label>
          <input
            id="weight"
            name="weight"
            type="number"
            min="0"
            step="0.1"
            value={form.weight}
            onChange={handleChange}
            placeholder="Enter collected weight"
            required
          />
        </div>
        <button className="primary" type="submit" disabled={loading}>
          {loading ? 'Saving…' : 'Record Collection'}
        </button>
      </form>
      {message && <p style={{ color: '#0c7c59', marginTop: '1rem' }}>{message}</p>}
      {error && <p style={{ color: '#c62828', marginTop: '1rem' }}>{error}</p>}
    </div>
  );
};

export default CollectionScanner;
