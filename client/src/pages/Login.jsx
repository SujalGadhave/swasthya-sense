import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(username, password);
      redirectUser(user.role);
    } catch (err) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (user, pass) => {
    setError('');
    setLoading(true);
    try {
      const u = await login(user, pass);
      redirectUser(u.role);
    } catch (err) {
      setError(err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  const redirectUser = (role) => {
    if (role === 'worker') navigate('/worker');
    else if (role === 'clinician') navigate('/clinician');
    else if (role === 'supervisor') navigate('/supervisor');
    else navigate('/');
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">🌿</div>
          <h2>Swasthya Sense</h2>
          <p className="login-subtitle">
            Follow-Up & Early-Warning Tool for High-Risk Patients
          </p>
        </div>

        <div className="prototype-notice-box">
          <strong>⚠️ Safety & Prototype Notice</strong>
          <p>
            This system is a hackathon prototype designed for authorized health staff. All patient data is entirely <strong>synthetic</strong>. Rules are illustrative and require clinician approval. This tool <strong>does not diagnose or prescribe</strong>.
          </p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {/* 1-Click Demo Persona Switcher */}
        <div className="demo-personas-section">
          <label className="section-title">Select Demo Persona (1-Click Instant Login):</label>
          <div className="persona-cards-grid">
            <button
              type="button"
              className="persona-card card-worker"
              onClick={() => handleDemoLogin('worker1', 'Worker@123')}
            >
              <div className="persona-icon">👩‍⚕️</div>
              <div className="persona-info">
                <strong>Sunita Devi (ASHA)</strong>
                <span className="persona-role">Role: Health Worker</span>
                <span className="persona-desc">Call list, vital check-in, alert escalation</span>
              </div>
            </button>

            <button
              type="button"
              className="persona-card card-clinician"
              onClick={() => handleDemoLogin('dr_sharma', 'Doctor@123')}
            >
              <div className="persona-icon">🩺</div>
              <div className="persona-info">
                <strong>Dr. Rajesh Sharma (MO)</strong>
                <span className="persona-role">Role: Clinician</span>
                <span className="persona-desc">Escalated case review, clinical notes & closure</span>
              </div>
            </button>

            <button
              type="button"
              className="persona-card card-supervisor"
              onClick={() => handleDemoLogin('admin_anita', 'Admin@123')}
            >
              <div className="persona-icon">📋</div>
              <div className="persona-info">
                <strong>Anita Verma (PHC In-Charge)</strong>
                <span className="persona-role">Role: Supervisor</span>
                <span className="persona-desc">Cohort schedules, audit trail, simulated messages</span>
              </div>
            </button>
          </div>
        </div>

        <div className="divider-or">
          <span>or sign in with credentials</span>
        </div>

        {/* Manual Login Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. worker1, dr_sharma, admin_anita"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
