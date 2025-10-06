import React, { useContext } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import CollectionScanner from './components/CollectionScanner';
import PickupScheduler from './components/PickupScheduler';
import Billing from './components/Billing';
import Reports from './components/Reports';
import { AuthContext } from './components/AuthContext';

const App = () => {
  const { user } = useContext(AuthContext);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Smart Waste Management</h1>
        {user && (
          <nav>
            <Link to="/dashboard">Dashboard</Link>
            {(user.role === 'staff' || user.role === 'admin') && (
              <Link to="/collections">Collections</Link>
            )}
            {user.role === 'resident' && <Link to="/pickups">Pickups</Link>}
            <Link to="/billing">Billing</Link>
            {user.role === 'admin' && <Link to="/reports">Reports</Link>}
          </nav>
        )}
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={user ? <Dashboard /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/collections"
            element={
              user && (user.role === 'staff' || user.role === 'admin') ? (
                <CollectionScanner />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            }
          />
          <Route
            path="/pickups"
            element={
              user && user.role === 'resident' ? (
                <PickupScheduler />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            }
          />
          <Route
            path="/billing"
            element={user ? <Billing /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/reports"
            element={
              user && user.role === 'admin' ? (
                <Reports />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            }
          />
          <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
        </Routes>
      </main>
    </div>
  );
};

export default App;
