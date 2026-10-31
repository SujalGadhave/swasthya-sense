const BASE_URL = '/api';

async function request(endpoint, options = {}, retries = 2) {
  const token = localStorage.getItem('swasthya_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      // If server is restarting (500, 502, 503) and we have retries left, pause and retry
      if (retries > 0 && (response.status === 500 || response.status === 502 || response.status === 503)) {
        await new Promise((r) => setTimeout(r, 350));
        return request(endpoint, options, retries - 1);
      }
      const errorMsg = data.error || `Request failed with status ${response.status}`;
      throw new Error(errorMsg);
    }

    return data;
  } catch (err) {
    if (retries > 0 && err.name !== 'AbortError') {
      await new Promise((r) => setTimeout(r, 350));
      return request(endpoint, options, retries - 1);
    }
    throw err;
  }
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

