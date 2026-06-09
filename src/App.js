import React, { useState, useEffect, Component } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import StaffDashboard from './components/StaffDashboard';
import AdminDashboard from './components/AdminDashboard';
import './index.css';

// ---------- Error Boundary ----------
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      const isApiMissing = !window.electronAPI;
      return (
        <div className="error-boundary-container">
          <div className="error-boundary-box">
            <h2>Something went wrong</h2>
            {isApiMissing ? (
              <p>
                The application failed to connect to the database layer.
                This usually means the app was not launched through Electron.
                Please restart using the desktop shortcut.
              </p>
            ) : (
              <p>
                {this.state.error?.message || 'An unexpected error occurred.'}
              </p>
            )}
            <button
              className="btn btn-primary"
              onClick={() => window.location.reload()}
              style={{ marginTop: '16px' }}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------- App ----------
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
    return (
      <ErrorBoundary>
        <Login onLogin={handleLogin} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route
            path="/"
            element={
              user.role === 'admin'
                ? <AdminDashboard user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
                : <StaffDashboard user={user} onLogout={handleLogout} />
            }
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
