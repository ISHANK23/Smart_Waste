import React, { useContext, useMemo } from 'react';
import { AuthContext } from './AuthContext';
import { SyncContext } from './SyncContext';
import { ConnectivityContext } from './ConnectivityContext';
const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const { data, refresh, loading: syncing, lastSync } = useContext(SyncContext);
  const { online } = useContext(ConnectivityContext);
  const stats = useMemo(() => {
    const bins = data?.bins || [];
    const pickups = data?.pickups || [];
    const collections = data?.collections || [];
    const transactions = data?.transactions || [];
    const today = new Date();
    const isSameDay = (date) => {
      const target = new Date(date);
      return (
        target.getDate() === today.getDate() &&
        target.getMonth() === today.getMonth() &&
        target.getFullYear() === today.getFullYear()
      );
    };
    if (user.role === 'resident') {
      const pendingPickups = pickups.filter((p) => ['pending', 'scheduled'].includes(p.status));
      return {
        bins,
        recentTransactions: transactions.slice(0, 3),
        pendingPickups
      };
    }
    if (user.role === 'staff') {
      const todaysCollections = collections.filter((record) => isSameDay(record.timestamp || record.createdAt));
      const totalWeight = todaysCollections.reduce((sum, record) => sum + (record.weight || 0), 0);
      const pendingPickups = pickups.filter((p) => p.status !== 'completed');
      return {
        todaysCollections: todaysCollections.length,
        totalWeight,
        pendingPickups: pendingPickups.length
      };
    }
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthlyCollections = collections.filter(
      (record) => new Date(record.timestamp || record.createdAt) >= monthStart
    );
    const totalWeight = monthlyCollections.reduce((sum, record) => sum + (record.weight || 0), 0);
    const activeUsers = new Set(collections.map((record) => record.collectedBy?._id || record.collectedBy)).size;
    return {
      monthlyCollections: totalWeight,
      activeUsers
    };
  }, [data, user.role]);
  const renderResident = () => (
    <div className="grid grid-2">
      {(stats.bins || []).map((bin) => (
        <div className="stat-card" key={bin._id || bin.binId}>
          <h3>{bin.type?.toUpperCase() || 'BIN'}</h3>
          <p>Location: {bin.location}</p>
          <p>Current Level: {bin.currentLevel ?? 'N/A'}%</p>
        </div>
      ))}
      <div className="stat-card">
        <h3>Pending Pickups</h3>
        <p>{stats.pendingPickups?.length || 0} scheduled</p>
      </div>
      <div className="stat-card">
        <h3>Recent Transactions</h3>
        <ul>
          {(stats.recentTransactions || []).map((txn) => (
            <li key={txn._id}>{`${txn.type} • ${txn.status} • $${txn.amount ?? 0}`}</li>
          ))}
          {(!stats.recentTransactions || stats.recentTransactions.length === 0) && <li>No recent billing activity.</li>}
        </ul>
      </div>
    </div>
  );
  const renderStaff = () => (
    <div className="grid grid-2">
      <div className="stat-card">
        <h3>Today's Collections</h3>
        <p>Total Scans: {stats.todaysCollections || 0}</p>
        <p>Total Weight: {stats.totalWeight?.toFixed(1) || 0} kg</p>
      </div>
      <div className="stat-card">
        <h3>Pending Pickups</h3>
        <p>{stats.pendingPickups || 0} requests</p>
      </div>
    </div>
  );
  const renderAdmin = () => (
    <div className="grid grid-2">
      <div className="stat-card">
        <h3>Monthly Collections</h3>
        <p>{stats.monthlyCollections?.toFixed(1) || 0} kg processed</p>
      </div>
      <div className="stat-card">
        <h3>Active Collection Staff</h3>
        <p>{stats.activeUsers || 0}</p>
      </div>
    </div>
  );
  return (
    <div className="card">
      <div className="card-header">
        <h2>Dashboard</h2>
        <button className="primary" type="button" onClick={refresh} disabled={syncing || !online}>
          {syncing ? 'Syncing…' : 'Refresh'}
        </button>
      </div>
      <p>Overview tailored for {user.role} accounts.</p>
      {!online && <p style={{ color: '#ad6a00' }}>You are viewing cached data.</p>}
      {user.role === 'resident' && renderResident()}
      {user.role === 'staff' && renderStaff()}
      {user.role === 'admin' && renderAdmin()}
      <p style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: '#0a507a' }}>
        Last updated: {lastSync ? new Date(lastSync).toLocaleString() : 'Not yet synced'}
      </p>
    </div>
  );
};
export default Dashboard;