import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function NavBar() {
  const { user, logout, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleQuickSwitch = async (username, password) => {
    try {
      const u = await login(username, password);
      if (u.role === 'worker') navigate('/worker');
      else if (u.role === 'clinician') navigate('/clinician');
      else if (u.role === 'supervisor') navigate('/supervisor');
    } catch (err) {
      console.error('Fast switch failed:', err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header className="navbar-container">
      {/* Top Prototype & Safety Boundary Notice */}
      <div className="safety-banner">
        <span>⚠️ <strong>PROTOTYPE ONLY</strong> — Synthetic Data. Illustrative rules require clinician approval. Not a diagnostic tool.</span>
      </div>

      <nav className="navbar">
        <div className="navbar-brand">
          <Link to="/" className="brand-logo">
            <span className="logo-icon">🌿</span>
            <div className="brand-text">
              <span className="brand-title">Swasthya Sense</span>
              <span className="brand-subtitle">Frontline Early-Warning Prototype</span>
            </div>
          </Link>
        </div>

        {user && (
          <div className="navbar-links">
            {user.role === 'worker' && (
              <>
                <Link to="/worker" className={`nav-link ${isActive('/worker') ? 'active' : ''}`}>
                  📋 Today's Call List
                </Link>
                <Link to="/patients" className={`nav-link ${isActive('/patients') ? 'active' : ''}`}>
                  👥 Patient Registry
                </Link>
              </>
            )}

            {user.role === 'clinician' && (
              <Link to="/clinician" className={`nav-link ${isActive('/clinician') ? 'active' : ''}`}>
                🩺 Escalation Review Queue
              </Link>
            )}

            {user.role === 'supervisor' && (
              <>
                <Link to="/supervisor" className={`nav-link ${isActive('/supervisor') ? 'active' : ''}`}>
                  📊 Overview & Schedules
                </Link>
                <Link to="/audit" className={`nav-link ${isActive('/audit') ? 'active' : ''}`}>
                  📜 Audit Trail
                </Link>
                <Link to="/messages" className={`nav-link ${isActive('/messages') ? 'active' : ''}`}>
                  💬 Simulated Messages
                </Link>
              </>
            )}
          </div>
        )}

        <div className="navbar-actions">
          {/* Quick Demo Persona Switcher */}
          <div className="persona-switcher">
            <span className="persona-label">Demo Role:</span>
            <button
              className={`persona-btn ${user?.role === 'worker' ? 'current' : ''}`}
              onClick={() => handleQuickSwitch('worker1', 'Worker@123')}
              title="Switch to ASHA Worker (Sunita Devi)"
            >
              👩‍⚕️ ASHA
            </button>
            <button
              className={`persona-btn ${user?.role === 'clinician' ? 'current' : ''}`}
              onClick={() => handleQuickSwitch('dr_sharma', 'Doctor@123')}
              title="Switch to Clinician (Dr. Rajesh Sharma)"
            >
              🩺 Doctor
            </button>
            <button
              className={`persona-btn ${user?.role === 'supervisor' ? 'current' : ''}`}
              onClick={() => handleQuickSwitch('admin_anita', 'Admin@123')}
              title="Switch to Supervisor (Anita Verma)"
            >
              📋 Supervisor
            </button>
          </div>

          {user && (
            <div className="user-profile">
              <span className="user-badge" title={`Role: ${user.role}`}>
                {user.full_name} ({user.role})
              </span>
              <button onClick={handleLogout} className="btn-logout" title="Sign out">
                Sign Out
              </button>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}

