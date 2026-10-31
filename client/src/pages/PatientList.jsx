import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { getPatientDisplayName, getLocalizedVillage, getLocalizedAgeBand } from '../utils/patientNames.js';

export default function PatientList() {
  const { lang, t } = useLanguage();
  const [patients, setPatients] = useState([]);
  const [cohortFilter, setCohortFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api.patients.getAll()
      .then((res) => setPatients(res.patients || []))
      .catch((err) => setError(err.message || 'Failed to load patient registry'))
      .finally(() => setLoading(false));
  }, []);

  const filteredPatients = patients.filter((p) => {
    const matchesCohort = cohortFilter === 'all' || p.cohort === cohortFilter;
    const term = searchTerm.toLowerCase();
    const nameHi = getPatientDisplayName(p.pseudonym, 'hi').toLowerCase();
    const nameEn = getPatientDisplayName(p.pseudonym, 'en').toLowerCase();
    const pseudo = (p.pseudonym || '').toLowerCase();
    const village = (p.village_or_ward || '').toLowerCase();
    const matchesSearch =
      nameHi.includes(term) ||
      nameEn.includes(term) ||
      pseudo.includes(term) ||
      village.includes(term);
    return matchesCohort && matchesSearch;
  });

  return (
    <div className="page-container">
      {/* Unified Executive Registry Header */}
      <div className="dashboard-hero-header">
        <div className="hero-left">
          <div className="hero-avatar-wrap">
            <span className="hero-avatar-emblem">👥</span>
          </div>
          <div className="hero-meta">
            <div className="hero-title-row">
              <h1 className="hero-title">{lang === 'hi' ? 'मरीज़ रजिस्टर (पंजीकृत नागरिक)' : 'Patient Registry (Cohorts)'}</h1>
              <span className="hero-role-chip">{lang === 'hi' ? 'सीतापुर PHC' : 'PHC Sitapur'}</span>
            </div>
            <p className="hero-subtitle">
              <span>📍 {lang === 'hi' ? 'गर्भवती, उच्च रक्तचाप व मधुमेह कार्यक्रम' : 'Antenatal, Hypertension & Diabetes Programs'}</span>
              <span className="hero-sep">•</span>
              <span>{patients.length} {lang === 'hi' ? 'पंजीकृत मरीज़' : 'Enrolled Patients'}</span>
            </p>
          </div>
        </div>

        <div className="hero-right">
          <Link to="/worker" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            📋 {lang === 'hi' ? 'आज की कॉल सूची पर जाएं' : 'Go to Call List'}
          </Link>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="filter-bar">
        <input
          type="text"
          placeholder="🔍 Search pseudonym or village..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />

        <div className="cohort-filter-buttons">
          <button
            className={`filter-chip ${cohortFilter === 'all' ? 'active' : ''}`}
            onClick={() => setCohortFilter('all')}
          >
            All Cohorts ({patients.length})
          </button>
          <button
            className={`filter-chip ${cohortFilter === 'antenatal' ? 'active' : ''}`}
            onClick={() => setCohortFilter('antenatal')}
          >
            Antenatal (ANC)
          </button>
          <button
            className={`filter-chip ${cohortFilter === 'hypertension' ? 'active' : ''}`}
            onClick={() => setCohortFilter('hypertension')}
          >
            Hypertension (HTN)
          </button>
          <button
            className={`filter-chip ${cohortFilter === 'diabetes' ? 'active' : ''}`}
            onClick={() => setCohortFilter('diabetes')}
          >
            Diabetes (DM)
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">Loading registry...</div>
      ) : (
        <div className="content-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient Pseudonym</th>
                <th>Program Cohort</th>
                <th>Village / Ward</th>
                <th>Age Band</th>
                <th>Messaging Consent</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPatients.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="patient-name-container">
                      <strong>{getPatientDisplayName(p.pseudonym, lang)}</strong>
                      <span className="patient-id-badge">{p.pseudonym}</span>
                    </div>
                  </td>
                  <td>
                    <span className="meta-tag tag-cohort">
                      {p.cohort === 'antenatal'
                        ? (lang === 'hi' ? 'गर्भवती (ANC)' : 'ANTENATAL')
                        : p.cohort === 'hypertension'
                        ? (lang === 'hi' ? 'बीपी (HTN)' : 'HYPERTENSION')
                        : (lang === 'hi' ? 'शुगर (DB)' : 'DIABETES')}
                    </span>
                  </td>
                  <td>📍 {getLocalizedVillage(p.village_or_ward, lang)}</td>
                  <td>👤 {getLocalizedAgeBand(p.age_band, lang)}</td>
                  <td>
                    <span className={`status-pill ${p.consent_status === 'consented' ? 'status-sent' : 'status-suppressed'}`}>
                      {p.consent_status === 'consented' ? '✓ Consented' : '✕ Declined'}
                    </span>
                  </td>
                  <td>
                    <Link to={`/patient/${p.id}`} className="btn btn-sm btn-secondary">
                      View Profile & Timeline
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

