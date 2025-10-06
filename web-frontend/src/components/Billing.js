import React, { useEffect, useState } from 'react';
import apiClient from '../services/apiClient';

const Billing = () => {
  const [transactions, setTransactions] = useState([]);
  const [form, setForm] = useState({ amount: '', method: 'card' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchTransactions = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get('/api/transactions');
      setTransactions(data);
    } catch (err) {
      setError('Unable to load transactions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
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
      await apiClient.post('/api/transactions/pay', { amount: Number(form.amount), method: form.method });
      setMessage('Payment processed successfully!');
      setForm({ amount: '', method: 'card' });
      fetchTransactions();
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
      <section style={{ marginTop: '2rem' }}>
        <h3>Transaction History</h3>
        {loading ? (
          <p>Loading transactions…</p>
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
                <tr key={transaction._id}>
                  <td>{transaction.type}</td>
                  <td>${transaction.amount?.toFixed ? transaction.amount.toFixed(2) : transaction.amount}</td>
                  <td>{transaction.status}</td>
                  <td>{transaction.timestamp ? new Date(transaction.timestamp).toLocaleDateString() : '—'}</td>
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
