const BASE_URL = '/api';

/**
 * Generic request helper with automatic Authorization header injection.
 */
async function request(endpoint, options = {}) {
  const token = localStorage.getItem('swasthya_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // Auth API
  auth: {
    login: (username, password) =>
      request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }),
    getMe: () => request('/auth/me'),
    getDemoUsers: () => request('/auth/demo-users'),
  },

  // Patients API
  patients: {
    getCallList: (filter = 'all') => request(`/patients/call-list?filter=${filter}`),
    getAll: () => request('/patients'),
    getById: (id) => request(`/patients/${id}`),
    toggleConsent: (id, consent_status) =>
      request(`/patients/${id}/consent`, {
        method: 'PATCH',
        body: JSON.stringify({ consent_status }),
      }),
  },

  // Check-Ins API
  checkins: {
    submit: (data) =>
      request('/checkins', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getHistory: (patientId) => request(`/checkins/patient/${patientId}`),
  },

  // Flags API
  flags: {
    getAll: (params = '') => request(`/flags${params ? `?${params}` : ''}`),
    updateStatus: (id, status) =>
      request(`/flags/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
  },

  // Escalations API
  escalations: {
    create: (data) =>
      request('/escalations', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getQueue: (status = 'all') => request(`/escalations/queue?status=${status}`),
    review: (id, data) =>
      request(`/escalations/${id}/review`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },

  // Schedules API
  schedules: {
    getAll: () => request('/schedules'),
    update: (cohort, data) =>
      request(`/schedules/${cohort}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  // Audit Log API
  audit: {
    getAll: (params = '') => request(`/audit${params ? `?${params}` : ''}`),
    getSummary: () => request('/audit/summary'),
  },

  // Simulated Messages API
  messages: {
    getAll: (params = '') => request(`/messages${params ? `?${params}` : ''}`),
  },
};
