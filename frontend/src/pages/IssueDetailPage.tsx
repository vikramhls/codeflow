import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Bug, Zap, Clock, Plus, CheckCircle, XCircle, FileCode, GitBranch } from 'lucide-react';
import { issuesApi, solutionsApi } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

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

interface Solution {
  id: string;
  author_id: string;
  author_username: string;
  description: string;
  file_patch?: string;
  uploaded_filename?: string;
  status: string;
  review?: { notes: string; status: string };
  points_awarded: number;
  created_at: string;
}

const priorityColors: Record<string, string> = {
  high: 'var(--error)', medium: 'var(--warning)', low: 'var(--success)'
};
const statusColors: Record<string, string> = {
  open: 'var(--info)', in_progress: 'var(--warning)', resolved: 'var(--success)', closed: 'var(--silver-600)'
};

export default function IssueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ description: '', file_patch: '' });

  const load = async () => {
    if (!id) return;
    try {
      const [issueRes, solsRes] = await Promise.all([
        issuesApi.get(id),
        solutionsApi.list(id),
      ]);
      setIssue(issueRes.data);
      setSolutions(solsRes.data.solutions);
    } catch {
      toast('Failed to load issue', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleSubmitSolution = async () => {
    if (!form.description) { toast('Description is required', 'warning'); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('description', form.description);
      if (form.file_patch) fd.append('file_patch', form.file_patch);
      await solutionsApi.submit(id!, fd);
      toast('Solution submitted!', 'success');
      setShowSubmit(false);
      setForm({ description: '', file_patch: '' });
      load();
    } catch (e: any) {
      toast(e.response?.data?.detail || 'Submission failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (solutionId: string, status: 'accepted' | 'rejected', points: number) => {
    try {
      await solutionsApi.review(solutionId, { status, notes: '', points_to_award: points });
      toast(`Solution ${status}`, status === 'accepted' ? 'success' : 'info');
      load();
    } catch (e: any) {
      toast(e.response?.data?.detail || 'Review failed', 'error');
    }
  };

  if (loading) return <div className="page"><div className="skeleton" style={{ height: '200px' }} /></div>;
  if (!issue) return <div className="page"><p>Issue not found.</p></div>;

  const isAuthor = user?.id === issue.author_id;

  return (
    <div className="page">
      <Link to="/issues" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--silver-500)', fontSize: '13px', marginBottom: '24px' }}>
        <ArrowLeft size={14} /> All Issues
      </Link>

      {/* Issue header */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '999px', background: 'var(--bg-elevated)', color: priorityColors[issue.priority] || 'var(--silver-500)', border: '1px solid var(--border)' }}>
            {issue.priority}
          </span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: statusColors[issue.status] || 'var(--silver-500)' }}>
            ● {issue.status}
          </span>
          {issue.bounty_points > 0 && (
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Zap size={13} /> {issue.bounty_points} bounty points
            </span>
          )}
        </div>

        <h1 style={{ fontSize: '22px', marginBottom: '16px', lineHeight: 1.3 }}>{issue.title}</h1>

        <p style={{ color: 'var(--silver-300)', lineHeight: 1.8, fontSize: '14px', marginBottom: '20px' }}>{issue.description}</p>

        <div style={{ display: 'flex', gap: '20px', fontSize: '13px', color: 'var(--silver-600)', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <GitBranch size={12} />
            <span style={{ fontFamily: 'var(--font-mono)' }}>{issue.repo_name}</span>
          </span>
          {issue.file_path && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <FileCode size={12} />
              <Link to={`/files/${issue.file_id}`} style={{ fontFamily: 'var(--font-mono)', color: 'var(--silver-400)' }}>{issue.file_path}</Link>
            </span>
          )}
          <span>by <strong style={{ color: 'var(--silver-400)' }}>{issue.author_username}</strong></span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={12} /> {new Date(issue.created_at).toLocaleDateString()}
          </span>
        </div>

        {issue.tags.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', marginTop: '16px', flexWrap: 'wrap' }}>
            {issue.tags.map(t => <span key={t} className="badge badge-silver">{t}</span>)}
          </div>
        )}
      </div>

      {/* Solutions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '18px' }}>Solutions ({solutions.length})</h2>
        {issue.status !== 'closed' && issue.status !== 'resolved' && (
          <button onClick={() => setShowSubmit(true)} className="btn btn-primary btn-sm">
            <Plus size={14} /> Submit Solution
          </button>
        )}
      </div>

      {solutions.length === 0 ? (
        <div className="empty-state" style={{ padding: '48px' }}>
          <Bug />
          <h3>No solutions yet</h3>
          <p>Be the first to submit a fix and earn the bounty!</p>
          <button onClick={() => setShowSubmit(true)} className="btn btn-primary" style={{ marginTop: '16px' }}>
            <Plus size={16} /> Submit Solution
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {solutions.map(sol => (
            <div key={sol.id} className="card" style={{
              borderColor: sol.status === 'accepted' ? 'rgba(74,222,128,0.3)' : sol.status === 'rejected' ? 'rgba(248,113,113,0.3)' : 'var(--border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--silver-300)' }}>{sol.author_username}</span>
                  <span style={{ fontSize: '12px', color: 'var(--silver-600)' }}>
                    {new Date(sol.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {sol.points_awarded > 0 && (
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Zap size={12} /> +{sol.points_awarded} pts
                    </span>
                  )}
                  <span style={{
                    fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '999px',
                    background: sol.status === 'accepted' ? 'var(--success-dim)' : sol.status === 'rejected' ? 'var(--error-dim)' : 'var(--bg-elevated)',
                    color: sol.status === 'accepted' ? 'var(--success)' : sol.status === 'rejected' ? 'var(--error)' : 'var(--silver-400)',
                  }}>
                    {sol.status}
                  </span>
                </div>
              </div>

              <p style={{ color: 'var(--silver-300)', lineHeight: 1.7, fontSize: '14px', marginBottom: sol.file_patch ? '16px' : '0' }}>
                {sol.description}
              </p>

              {sol.file_patch && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--silver-600)', marginBottom: '6px' }}>Code patch:</div>
                  <pre style={{
                    background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '8px',
                    padding: '12px', fontFamily: 'var(--font-mono)', fontSize: '12px',
                    color: 'var(--silver-300)', overflowX: 'auto', maxHeight: '200px', overflowY: 'auto'
                  }}>
                    {sol.file_patch}
                  </pre>
                </div>
              )}

              {sol.review && (
                <div style={{ marginTop: '12px', padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--silver-600)', marginBottom: '4px' }}>Review note:</div>
                  <p style={{ fontSize: '13px', color: 'var(--silver-400)' }}>{sol.review.notes || 'No notes provided.'}</p>
                </div>
              )}

              {/* Review actions for repo owner */}
              {isAuthor && sol.status === 'pending' && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                  <button
                    onClick={() => handleReview(sol.id, 'accepted', issue.bounty_points)}
                    className="btn btn-sm"
                    style={{ background: 'var(--success-dim)', color: 'var(--success)', border: '1px solid rgba(74,222,128,0.3)' }}
                  >
                    <CheckCircle size={13} /> Accept
                  </button>
                  <button
                    onClick={() => handleReview(sol.id, 'rejected', 0)}
                    className="btn btn-danger btn-sm"
                  >
                    <XCircle size={13} /> Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Submit Solution Modal */}
      {showSubmit && (
        <div className="modal-overlay" onClick={() => setShowSubmit(false)}>
          <div className="modal" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Submit Solution</h2>
              <button className="modal-close" onClick={() => setShowSubmit(false)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Description *</label>
                <textarea className="form-textarea" style={{ minHeight: '120px' }} placeholder="Explain your solution approach…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Code Patch (optional)</label>
                <textarea
                  className="form-textarea"
                  style={{ minHeight: '150px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                  placeholder={`--- a/file.py\n+++ b/file.py\n@@ -1,3 +1,3 @@`}
                  value={form.file_patch}
                  onChange={e => setForm(f => ({ ...f, file_patch: e.target.value }))}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowSubmit(false)} className="btn btn-ghost">Cancel</button>
                <button onClick={handleSubmitSolution} className="btn btn-primary" disabled={submitting}>
                  {submitting ? <><div className="spinner" style={{ width: '14px', height: '14px' }} /> Submitting…</> : 'Submit Solution'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
