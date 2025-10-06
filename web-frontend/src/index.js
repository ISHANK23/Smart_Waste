import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './App.css';
import { AuthProvider } from './components/AuthContext';
import { ConnectivityProvider } from './components/ConnectivityContext';
import { SyncProvider } from './components/SyncContext';
const container = document.getElementById('root');
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ConnectivityProvider>
        <AuthProvider>
          <SyncProvider>
            <App />
          </SyncProvider>
        </AuthProvider>
      </ConnectivityProvider>
    </BrowserRouter>
  </React.StrictMode>
);