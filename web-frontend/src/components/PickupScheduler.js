import React, { useContext, useMemo, useState } from 'react';
import apiClient from '../services/apiClient';
import { ConnectivityContext } from './ConnectivityContext';
import { SyncContext } from './SyncContext';
import useOfflineQueue from '../hooks/useOfflineQueue';
const STORAGE_KEY = 'smartwaste_web_pickup_queue';
const PickupScheduler = () => {
  const [form, setForm] = useState({ wasteType: 'general', description: '', scheduledDate: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const { online } = useContext(ConnectivityContext);
  const { data, refresh } = useContext(SyncContext);
  const { queue, enqueue } = useOfflineQueue(
    STORAGE_KEY,
    async (entry) => {
      await apiClient.post('/api/pickups', entry.payload);
      await refresh();
    },
    online
  );
  const requests = useMemo(() => {
    const serverRequests = data?.pickups || [];
    const offlineRequests = queue.map((item) => ({
      ...item.payload,
      status: 'queued',
      _id: item.id,
      isLocal: true
    }));
    return [...offlineRequests, ...serverRequests].sort((a, b) => {
      const aDate = new Date(a.createdAt || a.timestamp || 0).getTime();
      const bDate = new Date(b.createdAt || b.timestamp || 0).getTime();
      return bDate - aDate;
    });
  }, [data?.pickups, queue]);
  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };
  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    setError('');
    const payload = {
      ...form,
      timestamp: new Date().toISOString(),
      clientReference: `pickup-${Date.now()}`
    };
    if (!online) {
      enqueue(payload);
      setMessage('Request saved locally and will sync once you are back online.');
      setForm({ wasteType: 'general', description: '', scheduledDate: '' });
      setSubmitting(false);
      return;
    }
    try {
      await apiClient.post('/api/pickups', payload);
      setMessage('Pickup request submitted!');
      setForm({ wasteType: 'general', description: '', scheduledDate: '' });
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit pickup request.');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="card">
      <h2>Pickup Scheduler</h2>
      <p>Request a special collection for bulk or hazardous waste items.</p>
      <form onSubmit={handleSubmit} className="grid">
        <div className="form-group">
          <label htmlFor="wasteType">Waste Type</label>
          <select id="wasteType" name="wasteType" value={form.wasteType} onChange={handleChange}>
            <option value="general">General Waste</option>
            <option value="recyclable">Recyclable</option>
            <option value="organic">Organic</option>
            <option value="ewaste">Electronic Waste</option>
            <option value="bulky">Bulky Items</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="scheduledDate">Preferred Date</label>
          <input
            id="scheduledDate"
            name="scheduledDate"
            type="date"
            value={form.scheduledDate}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            rows="3"
            value={form.description}
            onChange={handleChange}
            placeholder="Provide additional details"
          />
        </div>
        <button className="primary" type="submit" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Schedule Pickup'}
        </button>
      </form>
      {message && <p style={{ color: '#0c7c59', marginTop: '1rem' }}>{message}</p>}
      {error && <p style={{ color: '#c62828', marginTop: '1rem' }}>{error}</p>}
      <section style={{ marginTop: '2rem' }}>
        <h3>Your Requests</h3>
        {requests.length === 0 ? (
          <p>No pickup requests yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Description</th>
                <th>Status</th>
                <th>Scheduled Date</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request._id || request.clientReference}>
                  <td>{request.wasteType}</td>
                  <td>{request.description || '—'}</td>
                  <td>{request.isLocal ? 'Pending Sync' : request.status}</td>
                  <td>
                    {request.scheduledDate
                      ? new Date(request.scheduledDate).toLocaleDateString()
                      : request.isLocal
                      ? 'Awaiting sync'
                      : 'Pending'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};
export default PickupScheduler;