import React, { useEffect, useMemo, useState } from 'react';
import apiClient from '../services/apiClient';

const Reports = () => {
  const [range, setRange] = useState('monthly');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReports = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: stats } = await apiClient.get('/api/collections/stats', { params: { range } });
      setData(stats.trends || []);
    } catch (err) {
      setError('Unable to load reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [range]);

  const maxValue = useMemo(() => data.reduce((max, item) => Math.max(max, item.value || 0), 0), [data]);

  return (
    <div className="card">
      <h2>Analytics & Reports</h2>
      <p>Monitor collection efficiency and resource utilization across the city.</p>
      <div className="form-group" style={{ maxWidth: '240px' }}>
        <label htmlFor="range">Reporting Range</label>
        <select id="range" value={range} onChange={(event) => setRange(event.target.value)}>
          <option value="weekly">Last 7 days</option>
          <option value="monthly">Last 30 days</option>
          <option value="quarterly">Last quarter</option>
        </select>
      </div>
      {loading && <p>Loading analytics…</p>}
      {error && <p style={{ color: '#c62828' }}>{error}</p>}
      {!loading && !error && (
        <div>
          <div className="grid grid-2" style={{ marginTop: '1.5rem' }}>
            {data.map((item) => (
              <div key={item.label} className="stat-card" style={{ background: 'white' }}>
                <h3 style={{ color: 'var(--secondary)' }}>{item.label}</h3>
                <div
                  style={{
                    background: 'linear-gradient(135deg, var(--secondary), var(--primary))',
                    height: '12px',
                    borderRadius: '999px',
                    width: `${maxValue ? Math.round((item.value / maxValue) * 100) : 0}%`,
                    transition: 'width 0.3s ease',
                    margin: '1rem 0',
                  }}
                />
                <p style={{ margin: 0, fontWeight: 600 }}>{item.value} kg collected</p>
              </div>
            ))}
          </div>
          <section style={{ marginTop: '2rem' }}>
            <h3>Insights</h3>
            <ul>
              <li>Peak collection days help schedule staff more efficiently.</li>
              <li>Compare recyclable vs general waste to adjust bin placements.</li>
              <li>Monitor outstanding pickup requests to improve response time.</li>
            </ul>
          </section>
        </div>
      )}
    </div>
  );
};

export default Reports;
