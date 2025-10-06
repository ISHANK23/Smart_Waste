import React, { useContext, useState } from 'react';
import apiClient from '../services/apiClient';
import { ConnectivityContext } from './ConnectivityContext';
import { SyncContext } from './SyncContext';
import useOfflineQueue from '../hooks/useOfflineQueue';
const STORAGE_KEY = 'smartwaste_web_collection_queue';
const CollectionScanner = () => {
  const [form, setForm] = useState({ binId: '', weight: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { online } = useContext(ConnectivityContext);
  const { refresh } = useContext(SyncContext);
  const { queue, enqueue } = useOfflineQueue(
    STORAGE_KEY,
    async (entry) => {
      await apiClient.post('/api/collections/scan', {
        ...entry.payload,
        timestamp: entry.payload.timestamp,
        clientReference: entry.payload.clientReference
      });
      await refresh();
    },
    online
  );
  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };
  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');
    const payload = {
      binId: form.binId,
      weight: Number(form.weight),
      timestamp: new Date().toISOString(),
      clientReference: `${form.binId}-${Date.now()}`
    };
    if (!online) {
      enqueue(payload);
      setForm({ binId: '', weight: '' });
      setMessage('You are offline. The collection has been queued and will sync when reconnected.');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/api/collections/scan', payload);
      setMessage('Collection recorded successfully!');
      setForm({ binId: '', weight: '' });
      await refresh();
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
      {queue.length > 0 && (
        <p style={{ marginTop: '1rem', color: '#ad6a00' }}>
          {queue.length} collection(s) pending sync.
        </p>
      )}
    </div>
  );
};
export default CollectionScanner;