import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

// Attach JWT token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — try refresh
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem('refresh_token');
        if (refresh) {
          const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refresh_token: refresh });
          localStorage.setItem('access_token', data.access_token);
          localStorage.setItem('refresh_token', data.refresh_token);
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return api(original);
        }
      } catch {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ─────────────────────────────────────────────────────────
export const authApi = {
  githubLogin: () => { window.location.href = `${API_BASE}/auth/github/login`; },
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

// ── Repos ────────────────────────────────────────────────────────
export const reposApi = {
  import: (github_url: string, branch?: string) =>
    api.post('/repos/import', { github_url, branch }),
  list: () => api.get('/repos/my'),
  get: (id: string) => api.get(`/repos/${id}`),
  sync: (id: string) => api.post(`/repos/${id}/sync`),
  delete: (id: string) => api.delete(`/repos/${id}`),
  generateSummaries: (id: string) => api.post(`/repos/${id}/generate-summaries`),
};

// ── Files ────────────────────────────────────────────────────────
export const filesApi = {
  listByRepo: (repoId: string, params?: Record<string, unknown>) =>
    api.get(`/repos/${repoId}/files`, { params }),
  get: (id: string) => api.get(`/files/${id}`),
  content: (id: string) => api.get(`/files/${id}/content`),
  download: (id: string) => api.get(`/files/${id}/download`),
  summary: (id: string) => api.get(`/files/${id}/summary`),
  updateVisibility: (id: string, visibility: string) =>
    api.patch(`/files/${id}/visibility`, { visibility }),
  updateListing: (id: string, is_listed: boolean) =>
    api.patch(`/files/${id}/listing`, { is_listed }),
  explore: (params?: Record<string, unknown>) => api.get('/explore', { params }),
};

// ── Issues ───────────────────────────────────────────────────────
export const issuesApi = {
  create: (data: Record<string, unknown>) => api.post('/issues/', data),
  list: (params?: Record<string, unknown>) => api.get('/issues/', { params }),
  get: (id: string) => api.get(`/issues/${id}`),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/issues/${id}`, data),
  delete: (id: string) => api.delete(`/issues/${id}`),
};

// ── Solutions ────────────────────────────────────────────────────
export const solutionsApi = {
  submit: (issueId: string, formData: FormData) =>
    api.post(`/solutions/issues/${issueId}/submit`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  list: (issueId: string) => api.get(`/solutions/issues/${issueId}/list`),
  get: (id: string) => api.get(`/solutions/${id}`),
  review: (id: string, data: Record<string, unknown>) => api.patch(`/solutions/${id}/review`, data),
};

// ── Users ────────────────────────────────────────────────────────
export const usersApi = {
  dashboard: () => api.get('/users/me/dashboard'),
  leaderboard: (limit?: number) => api.get('/users/leaderboard', { params: { limit } }),
  profile: (id: string) => api.get(`/users/${id}`),
};

export default api;
