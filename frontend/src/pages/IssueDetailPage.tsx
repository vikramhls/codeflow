import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Bug, Zap, Clock, Plus, CheckCircle, XCircle,
  FileCode, GitBranch, ChevronDown, ChevronUp, Wand2,
  MessageSquare, Send, Loader2,
} from 'lucide-react';
import { issuesApi, solutionsApi, filesApi, getApiError } from '../lib/api';
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

interface SolutionComment {
  author_id: string;
  author_username: string;
  body: string;
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
  requested_points: number;
  is_synced_to_github?: boolean;
  github_pr_url?: string;
  comments: SolutionComment[];
  created_at: string;
}

const priorityColors: Record<string, string> = {
  high: 'var(--error)', medium: 'var(--warning)', low: 'var(--success)'
};
const statusColors: Record<string, string> = {
  open: 'var(--info)', in_progress: 'var(--warning)', resolved: 'var(--success)', closed: 'var(--silver-600)'
};

// ── Helpers ──────────────────────────────────────────────────────────────
function Avatar({ name }: { name: string }) {
  const initials = name.slice(0, 2).toUpperCase();
  const hue = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{
      width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
      background: `hsl(${hue}, 60%, 35%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '11px', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-sans)',
    }}>
      {initials}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export default function IssueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();

  const [issue, setIssue] = useState<Issue | null>(null);
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ description: '', file_patch: '', requested_points: 0 });

  // File summary
  const [fileSummary, setFileSummary] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(true);

  // Comments: per-solution comment draft + submitting state
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [commentSubmitting, setCommentSubmitting] = useState<Record<string, boolean>>({});
  const [syncLoading, setSyncLoading] = useState<Record<string, boolean>>({});
  const [commentOpen, setCommentOpen] = useState<Record<string, boolean>>({});

  // Pledge state
  const [showPledge, setShowPledge] = useState(false);
  const [pledgeAmount, setPledgeAmount] = useState(10);
  const [pledgeSubmitting, setPledgeSubmitting] = useState(false);

  const load = async () => {
    if (!id) return;
    try {
      const [issueRes, solsRes] = await Promise.all([
        issuesApi.get(id),
        solutionsApi.list(id),
      ]);
      const loadedIssue: Issue = issueRes.data;
      setIssue(loadedIssue);
      setSolutions(solsRes.data.solutions);

      // If issue has a linked file, try loading its AI summary
      if (loadedIssue.file_id) {
        try {
          const summaryRes = await filesApi.summary(loadedIssue.file_id);
          setFileSummary(summaryRes.data?.summary || null);
        } catch {
          setFileSummary(null);
        }
      }
    } catch {
      toast('Failed to load issue', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  // ── Submit solution ───────────────────────────────────────────────────
  const handleSubmitSolution = async () => {
    if (!form.description) { toast('Description is required', 'warning'); return; }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('description', form.description);
      if (form.file_patch) formData.append('file_patch', form.file_patch);
      formData.append('requested_points', form.requested_points.toString());
      
      await solutionsApi.submit(id!, formData);
      toast('Solution submitted successfully!', 'success');
      setShowSubmit(false);
      setForm({ description: '', file_patch: '', requested_points: 0 });
      load();
    } catch (e: unknown) {
      toast(getApiError(e, 'Submission failed'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Review solution ───────────────────────────────────────────────────
  const handleReview = async (solutionId: string, status: 'accepted' | 'rejected', points: number) => {
    try {
      await solutionsApi.review(solutionId, { status, notes: '', points_to_award: points });
      toast(`Solution ${status}`, status === 'accepted' ? 'success' : 'info');
      load();
    } catch (e: unknown) {
      toast(getApiError(e, 'Review failed'), 'error');
    }
  };

  // ── Add comment ───────────────────────────────────────────────────────
  const handleAddComment = async (solutionId: string) => {
    const body = (commentDraft[solutionId] || '').trim();
    if (!body) { toast('Comment cannot be empty', 'warning'); return; }
    setCommentSubmitting(prev => ({ ...prev, [solutionId]: true }));
    try {
      const res = await solutionsApi.addComment(solutionId, body);
      // Update only the affected solution in state
      setSolutions(prev => prev.map(s => s.id === solutionId ? res.data : s));
      setCommentDraft(prev => ({ ...prev, [solutionId]: '' }));
      toast('Comment added', 'success');
    } catch (e: unknown) {
      toast(getApiError(e, 'Failed to add comment'), 'error');
    } finally {
      setCommentSubmitting(prev => ({ ...prev, [solutionId]: false }));
    }
  };

  const handleSyncToGithub = async (solutionId: string) => {
    setSyncLoading(prev => ({ ...prev, [solutionId]: true }));
    try {
      const res = await solutionsApi.syncToGithub(solutionId);
      setSolutions(prev => prev.map(s => s.id === solutionId ? res.data : s));
      toast('GitHub PR created successfully!', 'success');
    } catch (e: unknown) {
      toast(getApiError(e, 'Failed to sync to GitHub'), 'error');
    } finally {
      setSyncLoading(prev => ({ ...prev, [solutionId]: false }));
    }
  };

  const handlePledge = async () => {
    if (pledgeAmount <= 0) return;
    setPledgeSubmitting(true);
    try {
      const res = await issuesApi.pledge(issue!.id, pledgeAmount);
      setIssue(prev => prev ? { ...prev, bounty_points: res.data.new_bounty } : null);
      toast('Bounty boosted successfully!', 'success');
      setShowPledge(false);
    } catch (e: unknown) {
      toast(getApiError(e, 'Failed to pledge points'), 'error');
    } finally {
      setPledgeSubmitting(false);
    }
  };

  if (loading) return (
    <div className="page">
      <div className="skeleton" style={{ height: '200px', marginBottom: '16px' }} />
      <div className="skeleton" style={{ height: '120px', marginBottom: '16px' }} />
      <div className="skeleton" style={{ height: '300px' }} />
    </div>
  );
  if (!issue) return <div className="page"><p>Issue not found.</p></div>;

  const isAuthor = user?.id === issue.author_id;

  return (
    <div className="page">
      <Link to="/issues" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--silver-500)', fontSize: '13px', marginBottom: '24px' }}>
        <ArrowLeft size={14} /> All Issues
      </Link>

      {/* ── Issue header ─────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '999px', background: 'var(--bg-elevated)', color: priorityColors[issue.priority] || 'var(--silver-500)', border: '1px solid var(--border)' }}>
            {issue.priority}
          </span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: statusColors[issue.status] || 'var(--silver-500)' }}>
            ● {issue.status}
          </span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Zap size={13} /> {issue.bounty_points} bounty points
            </span>
          {user && !isAuthor && issue.status !== 'closed' && issue.status !== 'resolved' && (
            <button onClick={() => setShowPledge(true)} className="btn btn-sm" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', marginLeft: 'auto', color: 'var(--silver-200)', gap: '4px' }}>
              <Zap size={13} style={{ color: 'var(--warning)' }} /> Boost Bounty
            </button>
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
          <span>by <Link to={`/users/${issue.author_id}`} style={{ color: 'var(--silver-400)', textDecoration: 'none', fontWeight: 'bold' }}>{issue.author_username}</Link></span>
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

      {/* ── File Summary Panel ───────────────────────────────────────── */}
      {issue.file_id && (
        <div className="card" style={{ marginBottom: '20px', padding: 0, overflow: 'hidden' }}>
          {/* Collapsible header */}
          <button
            id="file-summary-toggle"
            onClick={() => setSummaryOpen(o => !o)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--silver-200)', fontFamily: 'var(--font-sans)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Wand2 size={15} style={{ color: 'var(--silver-500)' }} />
              <span style={{ fontWeight: 600, fontSize: '14px' }}>File Summary</span>
              {issue.file_path && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--silver-600)' }}>
                  — {issue.file_path}
                </span>
              )}
            </div>
            {summaryOpen ? <ChevronUp size={15} style={{ color: 'var(--silver-600)' }} /> : <ChevronDown size={15} style={{ color: 'var(--silver-600)' }} />}
          </button>

          {summaryOpen && (
            <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border)' }}>
              {fileSummary ? (
                <p style={{ color: 'var(--silver-300)', lineHeight: 1.8, fontSize: '14px', marginTop: '14px', whiteSpace: 'pre-wrap' }}>
                  {fileSummary}
                </p>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px', color: 'var(--silver-600)', fontSize: '13px' }}>
                  <Wand2 size={14} />
                  No AI summary yet — open the repository page and click "AI Summaries" to generate one.
                </div>
              )}
              <Link
                to={`/files/${issue.file_id}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '14px', fontSize: '12px', color: 'var(--silver-500)' }}
              >
                <FileCode size={12} /> View full file →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── Solutions header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '18px' }}>Solutions ({solutions.length})</h2>
        {issue.status !== 'closed' && issue.status !== 'resolved' && (
          <button onClick={() => setShowSubmit(true)} className="btn btn-primary btn-sm" id="submit-solution-btn">
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {solutions.map(sol => (
            <div key={sol.id} className="card" style={{
              borderColor: sol.status === 'accepted' ? 'rgba(74,222,128,0.3)' : sol.status === 'rejected' ? 'rgba(248,113,113,0.3)' : 'var(--border)',
              padding: 0, overflow: 'hidden',
            }}>
              {/* Solution body */}
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Avatar name={sol.author_username} />
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
                    {sol.status === 'pending' && sol.requested_points > 0 && (
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '4px' }} title="Points requested by the solver">
                        <Zap size={12} /> Bidding: {sol.requested_points} pts
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

                {/* Review actions for repo author */}
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

                {/* GitHub Sync Section */}
                {sol.status === 'accepted' && issue.file_id && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                    {sol.is_synced_to_github && sol.github_pr_url ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--success)' }}>
                        <GitBranch size={14} />
                        <span>Synced to GitHub:</span>
                        <a href={sol.github_pr_url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
                          View Pull Request
                        </a>
                      </div>
                    ) : (
                      isAuthor && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <button
                            onClick={() => handleSyncToGithub(sol.id)}
                            disabled={syncLoading[sol.id]}
                            className="btn btn-sm"
                            style={{ background: '#24292e', color: 'white', border: '1px solid #1b1f23', gap: '6px' }}
                          >
                            {syncLoading[sol.id] ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <GitBranch size={13} />}
                            Sync to GitHub (Create PR)
                          </button>
                          <span style={{ fontSize: '12px', color: 'var(--silver-500)' }}>
                            Automatically creates a new branch and Pull Request on GitHub with this solution's code.
                          </span>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>

              {/* ── Comments section ────────────────────────────────── */}
              <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                {/* Comments toggle */}
                <button
                  onClick={() => setCommentOpen(prev => ({ ...prev, [sol.id]: !prev[sol.id] }))}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--silver-500)', fontSize: '13px', fontFamily: 'var(--font-sans)',
                  }}
                >
                  <MessageSquare size={13} />
                  <span>{sol.comments.length > 0 ? `${sol.comments.length} comment${sol.comments.length > 1 ? 's' : ''}` : 'Add comment'}</span>
                  {sol.comments.length > 0 && (
                    commentOpen[sol.id]
                      ? <ChevronUp size={13} style={{ marginLeft: 'auto' }} />
                      : <ChevronDown size={13} style={{ marginLeft: 'auto' }} />
                  )}
                </button>

                {(commentOpen[sol.id] || sol.comments.length === 0) && (
                  <div style={{ padding: '0 20px 16px' }}>
                    {/* Existing comments */}
                    {sol.comments.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                        {sol.comments.map((c, idx) => {
                          const isAI = c.author_username === 'CodeFlow AI';
                          return (
                            <div key={idx} style={{ display: 'flex', gap: '10px' }}>
                              <Avatar name={c.author_username} />
                              <div style={{
                                flex: 1, background: isAI ? 'rgba(56, 189, 248, 0.05)' : 'var(--bg-base)', borderRadius: '10px',
                                padding: '10px 14px', border: isAI ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid var(--border)',
                              }}>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '6px' }}>
                                  <span style={{ fontSize: '12px', fontWeight: 600, color: isAI ? '#38bdf8' : 'var(--silver-300)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    {isAI && <Wand2 size={12} />} {c.author_username}
                                  </span>
                                  <span style={{ fontSize: '11px', color: 'var(--silver-600)' }}>
                                    {new Date(c.created_at).toLocaleString()}
                                  </span>
                                </div>
                                <p style={{ fontSize: '13px', color: isAI ? 'var(--silver-300)' : 'var(--silver-400)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{c.body}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* New comment form */}
                    {user ? (
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <Avatar name={user.username || user.email || 'U'} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <textarea
                            id={`comment-input-${sol.id}`}
                            className="form-textarea"
                            style={{ minHeight: '72px', fontSize: '13px', resize: 'vertical' }}
                            placeholder="I solved this by… / Here are the errors I encountered…"
                            value={commentDraft[sol.id] || ''}
                            onChange={e => setCommentDraft(prev => ({ ...prev, [sol.id]: e.target.value }))}
                          />
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              id={`comment-submit-${sol.id}`}
                              className="btn btn-primary btn-sm"
                              onClick={() => handleAddComment(sol.id)}
                              disabled={commentSubmitting[sol.id] || !commentDraft[sol.id]?.trim()}
                            >
                              {commentSubmitting[sol.id]
                                ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Posting…</>
                                : <><Send size={12} /> Post Comment</>}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p style={{ fontSize: '13px', color: 'var(--silver-600)', textAlign: 'center', padding: '12px 0' }}>
                        <Link to="/" style={{ color: 'var(--silver-400)' }}>Sign in</Link> to leave a comment.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Submit Solution Modal ───────────────────────────────────── */}
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
                <textarea
                  className="form-textarea"
                  style={{ minHeight: '120px' }}
                  placeholder="Explain your solution approach, what errors you found, and how you fixed them…"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
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
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Zap size={14} style={{ color: 'var(--warning)' }} /> Requested Points (Bid)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="number"
                    className="form-input"
                    style={{ width: '150px' }}
                    min="0"
                    max={issue?.bounty_points || 1000}
                    value={form.requested_points}
                    onChange={e => setForm(f => ({ ...f, requested_points: parseInt(e.target.value) || 0 }))}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--silver-500)' }}>
                    Ask for a specific amount of points from the issue's bounty. (Max: {issue?.bounty_points || 0})
                  </span>
                </div>
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

      {/* Pledge Modal */}
      {showPledge && (
        <div className="modal-overlay" onClick={() => setShowPledge(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h2 style={{ fontSize: '18px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={20} style={{ color: 'var(--warning)' }} /> Boost Bounty
            </h2>
            <p style={{ color: 'var(--silver-400)', fontSize: '14px', marginBottom: '20px', lineHeight: 1.5 }}>
              Pledge your own reputation points to increase the bounty on this issue and incentivize a faster fix.
            </p>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--silver-300)', fontWeight: 500 }}>Points to pledge</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {[10, 50, 100].map(amt => (
                  <button
                    key={amt}
                    onClick={() => setPledgeAmount(amt)}
                    className="btn"
                    style={{ flex: 1, background: pledgeAmount === amt ? 'var(--warning)' : 'var(--bg-base)', color: pledgeAmount === amt ? '#000' : 'var(--silver-200)', border: pledgeAmount === amt ? '1px solid var(--warning)' : '1px solid var(--border)', fontWeight: 600 }}
                  >
                    +{amt}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="1"
                value={pledgeAmount}
                onChange={e => setPledgeAmount(parseInt(e.target.value) || 0)}
                className="form-input"
                style={{ marginTop: '12px' }}
                placeholder="Custom amount..."
              />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setShowPledge(false)} className="btn" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}>Cancel</button>
              <button onClick={handlePledge} disabled={pledgeSubmitting || pledgeAmount <= 0} className="btn btn-primary" style={{ background: 'var(--warning)', color: '#000' }}>
                {pledgeSubmitting ? 'Pledging...' : `Pledge ${pledgeAmount} points`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
