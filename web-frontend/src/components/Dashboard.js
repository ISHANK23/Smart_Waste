import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from './AuthContext';
import apiClient from '../services/apiClient';

const Dashboard = () => {
  const { user, logout } = useContext(AuthContext);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchSummary = async () => {
      setLoading(true);
      setError('');
      try {
        let endpoint = '/api/collections/stats';
        if (user.role === 'resident') {
          endpoint = '/api/bins?includeStatus=true';
        } else if (user.role === 'staff') {
          endpoint = '/api/collections/stats?scope=today';
        }
        const { data } = await apiClient.get(endpoint);
        if (isMounted) {
          setSummary(data);
        }
      } catch (err) {
        if (err.response?.status === 401) {
          logout();
        } else if (isMounted) {
          setError('Unable to load dashboard data.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchSummary();

    return () => {
      isMounted = false;
    };
  }, [user, logout]);

  const renderResident = () => (
    <div className="grid grid-2">
      {(summary?.bins || []).map((bin) => (
        <div className="stat-card" key={bin.binId}>
          <h3>{bin.type.toUpperCase()} Bin</h3>
          <p>Location: {bin.location}</p>
          <p>Current Level: {bin.currentLevel}%</p>
        </div>
      ))}
      <div className="stat-card">
        <h3>Quick Actions</h3>
        <ul>
          <li>Request special pickup</li>
          <li>View upcoming collections</li>
          <li>Review billing history</li>
        </ul>
      </div>
    </div>
  );

  const renderStaff = () => (
    <div className="grid grid-2">
      <div className="stat-card">
        <h3>Today's Collections</h3>
        <p>Total Scans: {summary?.totalScans || 0}</p>
        <p>Total Weight: {summary?.totalWeight || 0} kg</p>
      </div>
      <div className="stat-card">
        <h3>Pending Pickups</h3>
        <p>{summary?.pendingPickups || 0} requests</p>
      </div>
    </div>
  );

  const renderAdmin = () => (
    <div className="grid grid-2">
      <div className="stat-card">
        <h3>Monthly Collections</h3>
        <p>{summary?.monthlyCollections || 0} tonnes processed</p>
      </div>
      <div className="stat-card">
        <h3>Active Users</h3>
        <p>{summary?.activeUsers || 0}</p>
      </div>
    </div>
  );

  return (
    <div className="card">
      <h2>Dashboard</h2>
      <p>Overview tailored for {user.role} accounts.</p>
      {loading && <p>Loading insights…</p>}
      {error && <p style={{ color: '#c62828' }}>{error}</p>}
      {!loading && !error && (
        <>
          {user.role === 'resident' && renderResident()}
          {user.role === 'staff' && renderStaff()}
          {user.role === 'admin' && renderAdmin()}
        </>
      )}
    </div>
  );
};

export default Dashboard;
