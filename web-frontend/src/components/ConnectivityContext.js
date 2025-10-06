import React, { createContext, useEffect, useMemo, useState } from 'react';
export const ConnectivityContext = createContext({ online: true, lastChanged: null });
export const ConnectivityProvider = ({ children }) => {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [lastChanged, setLastChanged] = useState(() => new Date().toISOString());
  useEffect(() => {
    const updateStatus = () => {
      setOnline(navigator.onLine);
      setLastChanged(new Date().toISOString());
    };
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);
  const value = useMemo(() => ({ online, lastChanged }), [online, lastChanged]);
  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
};