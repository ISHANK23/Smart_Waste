import React, { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';

const PickupScheduler = () => {
  const [form, setForm] = useState({ wasteType: 'general', description: '', scheduledDate: '' });
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const fetchRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get('/api/pickups');
      setRequests(data);
    } catch (err) {
      setError('Unable to load pickup requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    setError('');
    try {
      await apiClient.post('/api/pickups', form);
      setMessage('Pickup request submitted!');
      setForm({ wasteType: 'general', description: '', scheduledDate: '' });
      fetchRequests();
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
            <option value="hazardous">Hazardous</option>
            <option value="organic">Organic</option>
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
        {loading ? (
          <p>Loading requests…</p>
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
                <tr key={request._id}>
                  <td>{request.wasteType}</td>
                  <td>{request.description || '—'}</td>
                  <td>{request.status}</td>
                  <td>{request.scheduledDate ? new Date(request.scheduledDate).toLocaleDateString() : 'Pending'}</td>
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
