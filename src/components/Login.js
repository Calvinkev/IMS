import React, { useState } from 'react';
import { Package } from 'lucide-react';

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await window.electronAPI.db.get(
        'SELECT * FROM users WHERE username = ? AND password = ? AND is_active = 1',
        [username, password]
      );

      if (result) {
        onLogin({
          id: result.id,
          username: result.username,
          fullName: result.full_name,
          role: result.role
        });
      } else {
        setError('Invalid username or password');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-icon-wrap">
          <Package size={48} color="#0f172a" />
        </div>
        <h2>Shop IMS</h2>
        <p className="login-subtitle">
          Inventory Management System
        </p>
        
        {error && (
          <div className="login-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Enter username"
            />
          </div>
          
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter password"
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary login-submit-btn"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="login-hint">
          Default: admin / admin123
        </p>
      </div>
    </div>
  );
}

export default Login;
