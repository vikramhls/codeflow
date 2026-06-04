import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bug, Plus, ChevronRight, Zap, Clock } from 'lucide-react';
import { issuesApi } from '../lib/api';
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
  const [form, setForm] = useState({ repo_id: searchParams.get('repo_id') || '', file_id: searchParams.get('file_id') || '', title: '', description: '', priority: 'medium', bounty_points: 0, tags: '' });
  const [submitting, setSubmitting] = useState(false);

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

  const handleCreate = async () => {
    if (!form.repo_id || !form.title || !form.description) {
      toast('Please fill in all required fields', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      await issuesApi.create({
        repo_id: form.repo_id,
        file_id: form.file_id || undefined,
        title: form.title,
        description: form.description,
        priority: form.priority,
        bounty_points: Number(form.bounty_points),
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      });
      toast('Issue created!', 'success');
      setShowModal(false);
      setForm({ repo_id: '', file_id: '', title: '', description: '', priority: 'medium', bounty_points: 0, tags: '' });
      load();
    } catch (e: any) {
      toast(e.response?.data?.detail || 'Failed to create issue', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Issues</h1>
          <p>{issues.length} issues found</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
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
          <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ marginTop: '16px' }}>
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

      {/* Create Issue Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Issue</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Repository ID *</label>
                <input className="form-input" placeholder="Repository ID (from URL)" value={form.repo_id} onChange={e => setForm(f => ({ ...f, repo_id: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">File ID (optional)</label>
                <input className="form-input" placeholder="File ID (optional)" value={form.file_id} onChange={e => setForm(f => ({ ...f, file_id: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input className="form-input" placeholder="Describe the bug in one line" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Description *</label>
                <textarea className="form-textarea" style={{ minHeight: '120px' }} placeholder="Detailed description of the issue…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select className="form-select" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Bounty Points</label>
                  <input type="number" className="form-input" min={0} max={1000} value={form.bounty_points} onChange={e => setForm(f => ({ ...f, bounty_points: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Tags (comma-separated)</label>
                <input className="form-input" placeholder="bug, performance, ui" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowModal(false)} className="btn btn-ghost">Cancel</button>
                <button onClick={handleCreate} className="btn btn-primary" disabled={submitting}>
                  {submitting ? <><div className="spinner" style={{ width: '14px', height: '14px' }} /> Creating…</> : <><Plus size={16} /> Create Issue</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
