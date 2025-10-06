import React, { useContext, useMemo, useState } from 'react';
import apiClient from '../services/apiClient';
import { ConnectivityContext } from './ConnectivityContext';
import { SyncContext } from './SyncContext';
import useOfflineQueue from '../hooks/useOfflineQueue';
const PAYMENT_QUEUE_KEY = 'smartwaste_web_payment_queue';
const Billing = () => {
  const [form, setForm] = useState({ amount: '', method: 'card' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { online } = useContext(ConnectivityContext);
  const { data, refresh } = useContext(SyncContext);
  const { queue: paymentQueue, enqueue } = useOfflineQueue(
    PAYMENT_QUEUE_KEY,
    async (entry) => {
      await apiClient.post('/api/transactions/pay', entry.payload);
      await refresh();
    },
    online
  );
  const transactions = useMemo(() => {
    const records = data?.transactions || [];
    return records.sort((a, b) => new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0));
  }, [data?.transactions]);
  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };
  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    setError('');
    const payload = { amount: Number(form.amount), method: form.method, clientReference: `payment-${Date.now()}` };
    if (!online) {
      enqueue(payload);
      setMessage('Payment saved offline. It will process automatically when you reconnect.');
      setForm({ amount: '', method: 'card' });
      setSubmitting(false);
      return;
    }
    try {
      await apiClient.post('/api/transactions/pay', payload);
      setMessage('Payment processed successfully!');
      setForm({ amount: '', method: 'card' });
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Payment failed.');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="card">
      <h2>Billing & Payments</h2>
      <p>Review your transaction history and make new payments.</p>
      <form onSubmit={handleSubmit} className="grid grid-2" style={{ marginBottom: '2rem' }}>
        <div className="form-group">
          <label htmlFor="amount">Amount</label>
          <input
            id="amount"
            name="amount"
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={handleChange}
            placeholder="Enter amount"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="method">Payment Method</label>
          <select id="method" name="method" value={form.method} onChange={handleChange}>
            <option value="card">Credit Card</option>
            <option value="wallet">Wallet</option>
            <option value="cash">Cash</option>
          </select>
        </div>
        <button className="primary" type="submit" disabled={submitting}>
          {submitting ? 'Processing…' : 'Pay Now'}
        </button>
      </form>
      {message && <p style={{ color: '#0c7c59', marginTop: '-1rem' }}>{message}</p>}
      {error && <p style={{ color: '#c62828', marginTop: '-1rem' }}>{error}</p>}
      {paymentQueue.length > 0 && (
        <p style={{ color: '#ad6a00', marginTop: '0.5rem' }}>
          {paymentQueue.length} payment(s) pending sync.
        </p>
      )}
      <section style={{ marginTop: '2rem' }}>
        <h3>Transaction History</h3>
        {transactions.length === 0 ? (
          <p>No transactions yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction._id || transaction.clientReference}>
                  <td>{transaction.type}</td>
                  <td>${transaction.amount?.toFixed ? transaction.amount.toFixed(2) : transaction.amount}</td>
                  <td>{transaction.status}</td>
                  <td>{new Date(transaction.createdAt || transaction.updatedAt || Date.now()).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};
export default Billing;