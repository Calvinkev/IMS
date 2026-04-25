import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import StaffDashboard from './components/StaffDashboard';
import AdminDashboard from './components/AdminDashboard';
import './index.css';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Always force fresh authentication when the app starts.
    localStorage.removeItem('ims_user');
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('ims_user');
  };

  const handleUserUpdate = (updates) => {
    setUser((prev) => {
      if (!prev) return prev;
      return { ...prev, ...updates };
    });
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
      <Routes>
        <Route 
          path="/" 
          element={
            user.role === 'admin' ? 
              <AdminDashboard user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} /> :
              <StaffDashboard user={user} onLogout={handleLogout} />
          } 
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
