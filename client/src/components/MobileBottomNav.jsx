import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useOffline } from '../context/OfflineContext.jsx';

/**
 * Mobile Bottom Navigation Bar
 * Optimized for field workers holding a smartphone with one hand.
 * Automatically hidden on desktop (≥ 992px).
 */
export default function MobileBottomNav() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const { queueCount, openSimulator } = useOffline();

  if (!user) return null;

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
      <NavLink
        to="/worker"
        className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
        title={lang === 'hi' ? 'आज का काम (कॉल सूची)' : 'Today\'s Call List'}
      >
        <span className="mobile-nav-icon">🏠</span>
        <span className="mobile-nav-label">{lang === 'hi' ? 'आज का काम' : 'Call List'}</span>
      </NavLink>

      <NavLink
        to="/patients"
        className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
        title={lang === 'hi' ? 'मरीज़ रजिस्टर' : 'Patient Registry'}
      >
        <span className="mobile-nav-icon">👥</span>
        <span className="mobile-nav-label">{lang === 'hi' ? 'मरीज़' : 'Patients'}</span>
      </NavLink>

      <NavLink
        to="/clinician"
        className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
        title={lang === 'hi' ? 'सरकारी डॉक्टर समीक्षा' : 'Clinician Review Queue'}
      >
        <span className="mobile-nav-icon">🩺</span>
        <span className="mobile-nav-label">{lang === 'hi' ? 'डॉक्टर' : 'Doctor'}</span>
      </NavLink>

      <NavLink
        to="/supervisor"
        className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
        title={lang === 'hi' ? 'प्रभारी ऑडिट व रिपोर्ट' : 'Supervisor & Audit'}
      >
        <span className="mobile-nav-icon">📋</span>
        <span className="mobile-nav-label">{lang === 'hi' ? 'प्रभारी' : 'In-Charge'}</span>
      </NavLink>

      <button
        type="button"
        className="mobile-nav-item mobile-nav-btn"
        onClick={openSimulator}
        title={lang === 'hi' ? 'ऑफ़लाइन सिंक सिम्युलेटर' : 'Offline Sync Simulator'}
      >
        <span className="mobile-nav-icon">
          📡{queueCount > 0 && <span className="mobile-nav-badge">{queueCount}</span>}
        </span>
        <span className="mobile-nav-label">{lang === 'hi' ? 'सिंक' : 'Sync'}</span>
      </button>
    </nav>
  );
}
