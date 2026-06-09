import React, { useState } from 'react';
import { Package } from 'lucide-react';

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Fetch the user row by username only — never compare plain-text in SQL
      const result = await window.electronAPI.db.get(
        'SELECT * FROM users WHERE username = ? AND is_active = 1',
        [username]
      );

      if (!result) {
        setError('Invalid username or password.');
        return;
      }

      const passwordMatch = await window.electronAPI.db.verifyPassword(
        password,
        result.password
      );

      if (!passwordMatch) {
        setError('Invalid username or password.');
        return;
      }

      onLogin({
        id:       result.id,
        username: result.username,
        fullName: result.full_name,
        role:     result.role,
      });
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
        <p className="login-subtitle">Inventory Management System</p>

        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="login-username">Username</label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Enter username"
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter password"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary login-submit-btn"
            disabled={loading}
          >
            {loading ? 'Logging in…' : 'Login'}
          </button>
        </form>

        <p className="login-credit-heading">DEVELOPED</p>
        <p className="login-credit-line">by Cal Technologies</p>
      </div>
    </div>
  );
}

export default Login;
