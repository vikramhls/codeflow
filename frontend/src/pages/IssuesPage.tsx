import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bug, Plus, ChevronRight, Zap, Clock, Loader2 } from 'lucide-react';
import { issuesApi, reposApi, filesApi, getApiError } from '../lib/api';
import { useToast } from '../contexts/ToastContext';

interface Issue {
  id: string;
  repo_id: string;
  file_id?: string;
  author_id: string;
  author_username: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  bounty_points: number;
  tags: string[];
  solutions_count: number;
  file_path?: string;
  repo_name: string;
  created_at: string;
}

interface Repo {
  id: string;
  github_owner: string;
  github_repo: string;
  status: string;
}

interface RepoFile {
  id: string;
  path: string;
  filename: string;
}

const priorityStyles: Record<string, { color: string; bg: string }> = {
  high: { color: 'var(--error)', bg: 'var(--error-dim)' },
  medium: { color: 'var(--warning)', bg: 'var(--warning-dim)' },
  low: { color: 'var(--success)', bg: 'var(--success-dim)' },
};

const statusStyles: Record<string, { color: string }> = {
  open: { color: 'var(--info)' },
  in_progress: { color: 'var(--warning)' },
  resolved: { color: 'var(--success)' },
  closed: { color: 'var(--silver-600)' },
};

export default function IssuesPage() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    repo_id: searchParams.get('repo_id') || '',
    file_id: searchParams.get('file_id') || '',
    title: '',
    description: '',
    priority: 'medium',
    bounty_points: 0,
    tags: '',
  });

  // Repo + file dropdowns
  const [repos, setRepos] = useState<Repo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [repoFiles, setRepoFiles] = useState<RepoFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);

  const load = () => {
    const params: Record<string, string> = {};
    if (searchParams.get('repo_id')) params.repo_id = searchParams.get('repo_id')!;
    if (searchParams.get('file_id')) params.file_id = searchParams.get('file_id')!;
    if (statusFilter) params.status = statusFilter;

    issuesApi.list(params)
      .then(r => setIssues(r.data.issues))
      .catch(() => toast('Failed to load issues', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter]);

  // Load repos when modal opens
  const openModal = async () => {
    setShowModal(true);
    setReposLoading(true);
    try {
      const r = await reposApi.list();
      const readyRepos: Repo[] = (r.data.repos || []).filter((x: Repo) => x.status === 'ready');
      setRepos(readyRepos);

      // If pre-populated repo_id, load its files
      const preRepo = searchParams.get('repo_id');
      if (preRepo && readyRepos.find(x => x.id === preRepo)) {
        loadFilesForRepo(preRepo);
      }
    } catch {
      toast('Failed to load your repositories', 'error');
    } finally {
      setReposLoading(false);
    }
  };

  const loadFilesForRepo = async (repoId: string) => {
    if (!repoId) { setRepoFiles([]); return; }
    setFilesLoading(true);
    try {
      const r = await filesApi.listByRepo(repoId);
      setRepoFiles(r.data.files || []);
    } catch {
      setRepoFiles([]);
    } finally {
      setFilesLoading(false);
    }
  };

  const handleRepoChange = (repoId: string) => {
    setForm(f => ({ ...f, repo_id: repoId, file_id: '' }));
    loadFilesForRepo(repoId);
  };

  const handleCreate = async () => {
    if (!form.repo_id) { toast('Please select a repository', 'warning'); return; }
    if (!form.title.trim()) { toast('Title is required', 'warning'); return; }
    if (!form.description.trim()) { toast('Description is required', 'warning'); return; }

    setSubmitting(true);
    try {
      await issuesApi.create({
        repo_id: form.repo_id,
        file_id: form.file_id || undefined,
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        bounty_points: Number(form.bounty_points),
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      });
      toast('Issue created!', 'success');
      setShowModal(false);
      setForm({ repo_id: '', file_id: '', title: '', description: '', priority: 'medium', bounty_points: 0, tags: '' });
      setRepoFiles([]);
      load();
    } catch (e: unknown) {
      toast(getApiError(e, 'Failed to create issue'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    if (submitting) return;
    setShowModal(false);
    setRepoFiles([]);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Issues</h1>
          <p>{issues.length} issues found</p>
        </div>
        <button onClick={openModal} className="btn btn-primary" id="new-issue-btn">
          <Plus size={16} /> New Issue
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {['', 'open', 'in_progress', 'resolved', 'closed'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '6px 14px', borderRadius: '999px', border: '1px solid',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'none',
              fontFamily: 'var(--font-sans)',
              borderColor: statusFilter === s ? 'var(--silver-400)' : 'var(--border)',
              color: statusFilter === s ? 'var(--silver-100)' : 'var(--silver-500)',
              transition: 'all var(--transition)',
            }}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: '100px' }} />)}
        </div>
      ) : issues.length === 0 ? (
        <div className="empty-state">
          <Bug />
          <h3>No issues found</h3>
          <p>Create the first issue to get started</p>
          <button onClick={openModal} className="btn btn-primary" style={{ marginTop: '16px' }}>
            <Plus size={16} /> New Issue
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {issues.map(issue => (
            <Link
              key={issue.id}
              to={`/issues/${issue.id}`}
              style={{ textDecoration: 'none' }}
            >
              <div
                className="card"
                style={{ padding: '16px 20px', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-bright)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                        background: priorityStyles[issue.priority]?.bg || 'var(--bg-elevated)',
                        color: priorityStyles[issue.priority]?.color || 'var(--silver-500)',
                      }}>
                        {issue.priority}
                      </span>
                      <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--silver-100)' }}>
                        {issue.title}
                      </h3>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--silver-500)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {issue.description}
                    </p>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '12px', color: 'var(--silver-600)', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{issue.repo_name}</span>
                      {issue.file_path && <span style={{ fontFamily: 'var(--font-mono)' }}>{issue.file_path}</span>}
                      <span>by {issue.author_username}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={10} /> {new Date(issue.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {issue.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                        {issue.tags.map(tag => (
                          <span key={tag} className="badge badge-silver">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: statusStyles[issue.status]?.color || 'var(--silver-500)' }}>
                      {issue.status}
                    </span>
                    {issue.bounty_points > 0 && (
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Zap size={12} /> {issue.bounty_points} pts
                      </span>
                    )}
                    <span style={{ fontSize: '12px', color: 'var(--silver-600)' }}>
                      {issue.solutions_count} solutions
                    </span>
                    <ChevronRight size={14} style={{ color: 'var(--silver-700)' }} />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ── Create Issue Modal ─────────────────────────────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Issue</h2>
              <button className="modal-close" onClick={closeModal} disabled={submitting}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Repository selector */}
              <div className="form-group">
                <label className="form-label">Repository *</label>
                {reposLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--silver-500)', fontSize: '13px', padding: '10px 0' }}>
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading your repositories…
                  </div>
                ) : repos.length === 0 ? (
                  <div style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', color: 'var(--silver-500)' }}>
                    No imported repositories found. <Link to="/repos" style={{ color: 'var(--silver-300)' }}>Import a repository first →</Link>
                  </div>
                ) : (
                  <select
                    id="issue-repo-select"
                    className="form-select"
                    value={form.repo_id}
                    onChange={e => handleRepoChange(e.target.value)}
                  >
                    <option value="">— Select a repository —</option>
                    {repos.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.github_owner}/{r.github_repo}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* File selector (optional, loads once repo is picked) */}
              <div className="form-group">
                <label className="form-label">
                  Specific File&nbsp;
                  <span style={{ fontWeight: 400, color: 'var(--silver-600)' }}>(optional)</span>
                </label>
                {filesLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--silver-500)', fontSize: '13px', padding: '6px 0' }}>
                    <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Loading files…
                  </div>
                ) : (
                  <select
                    id="issue-file-select"
                    className="form-select"
                    value={form.file_id}
                    onChange={e => setForm(f => ({ ...f, file_id: e.target.value }))}
                    disabled={!form.repo_id || repoFiles.length === 0}
                  >
                    <option value="">— None (repo-level issue) —</option>
                    {repoFiles.map(f => (
                      <option key={f.id} value={f.id}>{f.path}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Title */}
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input
                  id="issue-title"
                  className="form-input"
                  placeholder="Describe the bug in one line"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="form-label">Description *</label>
                <textarea
                  id="issue-description"
                  className="form-textarea"
                  style={{ minHeight: '120px' }}
                  placeholder="Detailed description of the issue, what you expected vs what happened…"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              {/* Priority + Bounty */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select
                    id="issue-priority"
                    className="form-select"
                    value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Bounty Points</label>
                  <input
                    id="issue-bounty"
                    type="number"
                    className="form-input"
                    min={0}
                    max={1000}
                    value={form.bounty_points}
                    onChange={e => setForm(f => ({ ...f, bounty_points: Number(e.target.value) }))}
                  />
                </div>
              </div>

              {/* Tags */}
              <div className="form-group">
                <label className="form-label">Tags <span style={{ fontWeight: 400, color: 'var(--silver-600)' }}>(comma-separated)</span></label>
                <input
                  id="issue-tags"
                  className="form-input"
                  placeholder="bug, performance, ui"
                  value={form.tags}
                  onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button onClick={closeModal} className="btn btn-ghost" disabled={submitting}>Cancel</button>
                <button
                  id="create-issue-submit"
                  onClick={handleCreate}
                  className="btn btn-primary"
                  disabled={submitting || !form.repo_id || !form.title.trim() || !form.description.trim()}
                >
                  {submitting
                    ? <><div className="spinner" style={{ width: '14px', height: '14px' }} /> Creating…</>
                    : <><Plus size={16} /> Create Issue</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
