import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useOffline } from '../context/OfflineContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

export default function NavBar() {
  const { user, logout, login } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const { isOffline, toggleOffline, queueCount } = useOffline();
  const { theme, toggleTheme } = useTheme();
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
      {/* Top Clinical Safety Notice Ribbon */}
      <div className="safety-banner">
        <span className="safety-shield">🛡️</span>
        <span className="safety-text">{t('safety_banner')}</span>
      </div>

      <nav className="navbar">
        <div className="navbar-brand">
          <Link to="/" className="brand-logo">
            <span className="logo-symbol">✚</span>
            <div className="brand-text">
              <div className="brand-title-row">
                <span className="brand-title">Swasthya<span className="brand-accent">Sense</span></span>
                <span className="brand-gov-tag">ABDM</span>
              </div>
              <span className="brand-subtitle">
                {lang === 'hi' ? 'प्राथमिक स्वास्थ्य प्रारंभिक चेतावनी प्रणाली' : 'Frontline Clinical Decision Support'}
              </span>
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
          {/* Quick Demo Persona Switcher */}
          <div className="segmented-role-switch" role="group" aria-label="Demo Role Switcher">
            <button
              type="button"
              className={`role-tab-btn ${user?.role === 'worker' ? 'is-active' : ''}`}
              onClick={() => handleQuickSwitch('worker1', 'Worker@123')}
              title="Switch to ASHA Worker (Sunita Devi)"
            >
              👩‍⚕️ <span className="role-tab-text">{lang === 'hi' ? 'आशा' : 'ASHA'}</span>
            </button>
            <button
              type="button"
              className={`role-tab-btn ${user?.role === 'clinician' ? 'is-active' : ''}`}
              onClick={() => handleQuickSwitch('dr_sharma', 'Doctor@123')}
              title="Switch to Clinician (Dr. Rajesh Sharma)"
            >
              🩺 <span className="role-tab-text">{lang === 'hi' ? 'डॉक्टर' : 'Doctor'}</span>
            </button>
            <button
              type="button"
              className={`role-tab-btn ${user?.role === 'supervisor' ? 'is-active' : ''}`}
              onClick={() => handleQuickSwitch('admin_anita', 'Admin@123')}
              title="Switch to Supervisor (Anita Verma)"
            >
              📋 <span className="role-tab-text">{lang === 'hi' ? 'प्रभारी' : 'In-Charge'}</span>
            </button>
          </div>

          {/* Network State Pill */}
          <button
            type="button"
            className={`network-toggle-btn ${isOffline ? 'btn-net-offline' : 'btn-net-online'}`}
            onClick={toggleOffline}
            title={
              isOffline
                ? 'Simulated Offline Mode Active. Click to switch Online & sync'
                : 'Network Online. Click to simulate rural offline field visit'
            }
          >
            {isOffline ? (
              <span>📡 <strong className="net-status">{lang === 'hi' ? 'ऑफ़लाइन' : 'Offline'} ({queueCount})</strong></span>
            ) : (
              <span><span className="online-dot"></span> <span className="net-status">{lang === 'hi' ? 'ऑनलाइन' : 'Online'}</span></span>
            )}
          </button>

          {/* Language Selector: Clear Two-Pill Segmented Switcher */}
          <div className="language-selector-pills" role="group" aria-label="Language Selector">
            <button
              type="button"
              className={`lang-pill-btn ${lang === 'en' ? 'active-lang' : ''}`}
              onClick={() => setLang('en')}
              title="Switch interface to English"
            >
              EN
            </button>
            <button
              type="button"
              className={`lang-pill-btn ${lang === 'hi' ? 'active-lang' : ''}`}
              onClick={() => setLang('hi')}
              title="इंटरफ़ेस हिंदी में बदलें"
            >
              हिं
            </button>
          </div>

          {/* Modern Dark/Light Mode Switcher */}
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? (lang === 'hi' ? 'लाइट मोड चालू करें' : 'Switch to Light Mode') : (lang === 'hi' ? 'डार्क मोड चालू करें' : 'Switch to Dark Mode')}
            aria-label="Toggle Theme"
          >
            <span className="theme-toggle-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
          </button>

          {user && (
            <div className="user-profile">
              <span className="user-avatar-badge" title={`Role: ${user.role}`}>
                <span className="user-initials">
                  {user.username === 'worker1' ? 'SD' : user.username === 'dr_sharma' ? 'DR' : 'AV'}
                </span>
                <span className="user-name-label">
                  {lang === 'hi'
                    ? user.username === 'worker1'
                      ? 'सुनीता देवी'
                      : user.username === 'dr_sharma'
                      ? 'डॉ. शर्मा'
                      : 'अनिता वर्मा'
                    : user.full_name.split(' ')[0]}
                </span>
              </span>
              <button onClick={handleLogout} className="btn-logout" title={t('sign_out')} aria-label={t('sign_out')}>
                <span className="logout-icon">🚪</span>
              </button>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
