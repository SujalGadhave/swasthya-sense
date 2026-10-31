import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/api.js';

export default function PatientList() {
  const [patients, setPatients] = useState([]);
  const [cohortFilter, setCohortFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api.patients.getAll()
      .then((res) => setPatients(res.patients || []))
      .catch((err) => setError(err.message || 'Failed to load patient registry'))
      .finally(() => setLoading(false));
  }, []);

  const filteredPatients = patients.filter((p) => {
    const matchesCohort = cohortFilter === 'all' || p.cohort === cohortFilter;
    const matchesSearch =
      p.pseudonym?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.village_or_ward?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCohort && matchesSearch;
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>Patient Registry (Synthetic Cohorts)</h2>
          <p className="page-subtitle">
            Complete Registry of Registered Patients across Antenatal, Hypertension, and Diabetes Programs
          </p>
        </div>
        <Link to="/worker" className="btn btn-primary">
          📋 Go to Prioritized Call List
        </Link>
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
                    <strong>{p.pseudonym}</strong>
                  </td>
                  <td>
                    <span className="meta-tag tag-cohort">{p.cohort?.toUpperCase()}</span>
                  </td>
                  <td>📍 {p.village_or_ward}</td>
                  <td>👤 {p.age_band}</td>
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

