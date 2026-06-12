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
  bulkVisibility: (id: string, visibility: 'public' | 'private', list_files = false) =>
    api.patch(`/repos/${id}/visibility`, { visibility, list_files }),
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
  pledge: (id: string, amount: number) => api.post(`/issues/${id}/pledge`, { amount }),
};

// ── Solutions ────────────────────────────────────────────────────
export const solutionsApi = {
  submit: (issueId: string, formData: FormData) =>
    api.post(`/solutions/issues/${issueId}/submit`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  list: (issueId: string) => api.get(`/solutions/issues/${issueId}/list`),
  get: (id: string) => api.get(`/solutions/${id}`),
  review: (id: string, data: any) => api.patch(`/solutions/${id}/review`, data),
  addComment: (id: string, body: string) => api.post(`/solutions/${id}/comments`, { body }),
  syncToGithub: (id: string) => api.post(`/solutions/${id}/sync-github`),
};

// ── DevOps Expert ────────────────────────────────────────────────
export const devopsApi = {
  analyze: (repoId: string) => api.post(`/devops/repos/${repoId}/analyze`),
  report: (repoId: string) => api.get(`/devops/repos/${repoId}/report`),
};

// ── Interviews ───────────────────────────────────────────────────
export const interviewsApi = {
  generate: (repoId: string) => api.post(`/interviews/repos/${repoId}/generate`),
  get: (repoId: string) => api.get(`/interviews/repos/${repoId}`),
};

// ── Knowledge ───────────────────────────────────────────────────
export const knowledgeApi = {
  index: (repoId: string) => api.post(`/knowledge/repos/${repoId}/index`),
  ask: (repoId: string, query: string) => api.post(`/knowledge/repos/${repoId}/ask`, { query }),
};

// ── Users ────────────────────────────────────────────────────────
export const usersApi = {
  dashboard: () => api.get('/users/me/dashboard'),
  leaderboard: (limit?: number) => api.get('/users/leaderboard', { params: { limit } }),
  profile: (id: string) => api.get(`/users/${id}`),
  solutions: (id: string) => api.get(`/users/${id}/solutions`),
};

/**
 * Safely extract a human-readable error message from any Axios error.
 * Handles:
 *  - Plain string detail: "Repository not found"
 *  - Pydantic v2 array:   [{type, loc, msg, input, ctx}, ...]
 *  - Network errors / no response
 */
export function getApiError(e: unknown, fallback = 'An error occurred'): string {
  const detail = (e as any)?.response?.data?.detail;
  if (!detail) return (e as any)?.message || fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d: any) => {
        const loc = Array.isArray(d.loc) ? d.loc.slice(1).join(' → ') : '';
        const msg = d.msg || JSON.stringify(d);
        return loc ? `${loc}: ${msg}` : msg;
      })
      .join(' | ');
  }
  return fallback;
}

export default api;
