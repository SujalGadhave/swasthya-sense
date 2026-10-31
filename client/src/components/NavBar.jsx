import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function NavBar() {
  const { user, logout, login } = useAuth();
  const { lang, toggleLang, t } = useLanguage();
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
        <span>{t('safety_banner')}</span>
      </div>

      <nav className="navbar">
        <div className="navbar-brand">
          <Link to="/" className="brand-logo">
            <span className="logo-icon">🌿</span>
            <div className="brand-text">
              <span className="brand-title">{t('brand_title')}</span>
              <span className="brand-subtitle">{t('brand_subtitle')}</span>
            </div>
          </Link>
        </div>

        {user && (
          <div className="navbar-links">
            {user.role === 'worker' && (
              <>
                <Link to="/worker" className={`nav-link ${isActive('/worker') ? 'active' : ''}`}>
                  {t('nav_call_list')}
                </Link>
                <Link to="/patients" className={`nav-link ${isActive('/patients') ? 'active' : ''}`}>
                  {t('nav_registry')}
                </Link>
              </>
            )}

            {user.role === 'clinician' && (
              <Link to="/clinician" className={`nav-link ${isActive('/clinician') ? 'active' : ''}`}>
                {t('nav_clinician_queue')}
              </Link>
            )}

            {user.role === 'supervisor' && (
              <>
                <Link to="/supervisor" className={`nav-link ${isActive('/supervisor') ? 'active' : ''}`}>
                  {t('nav_supervisor_overview')}
                </Link>
                <Link to="/audit" className={`nav-link ${isActive('/audit') ? 'active' : ''}`}>
                  {t('nav_audit_trail')}
                </Link>
                <Link to="/messages" className={`nav-link ${isActive('/messages') ? 'active' : ''}`}>
                  {t('nav_messages')}
                </Link>
              </>
            )}
          </div>
        )}

        <div className="navbar-actions">
          {/* Language Toggle Button */}
          <button
            type="button"
            className="lang-toggle-btn"
            onClick={toggleLang}
            title={lang === 'en' ? 'हिंदी में बदलें (Switch to Hindi)' : 'Switch to English'}
          >
            🌐 <strong className="lang-text">{lang === 'en' ? 'हिंदी' : 'English'}</strong>
          </button>

          {/* Quick Demo Persona Switcher */}
          <div className="persona-switcher">
            <span className="persona-label">{t('demo_role_label')}</span>
            <button
              className={`persona-btn ${user?.role === 'worker' ? 'current' : ''}`}
              onClick={() => handleQuickSwitch('worker1', 'Worker@123')}
              title="Switch to ASHA Worker (Sunita Devi)"
            >
              {lang === 'hi' ? '👩‍⚕️ आशा' : '👩‍⚕️ ASHA'}
            </button>
            <button
              className={`persona-btn ${user?.role === 'clinician' ? 'current' : ''}`}
              onClick={() => handleQuickSwitch('dr_sharma', 'Doctor@123')}
              title="Switch to Clinician (Dr. Rajesh Sharma)"
            >
              {lang === 'hi' ? '🩺 डॉक्टर' : '🩺 Doctor'}
            </button>
            <button
              className={`persona-btn ${user?.role === 'supervisor' ? 'current' : ''}`}
              onClick={() => handleQuickSwitch('admin_anita', 'Admin@123')}
              title="Switch to Supervisor (Anita Verma)"
            >
              {lang === 'hi' ? '📋 प्रभारी' : '📋 In-Charge'}
            </button>
          </div>

          {user && (
            <div className="user-profile">
              <span className="user-badge" title={`Role: ${user.role}`}>
                {user.full_name}
              </span>
              <button onClick={handleLogout} className="btn-logout" title={t('sign_out')}>
                {t('sign_out')}
              </button>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
