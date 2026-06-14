import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Zap, Clock, CheckCircle, XCircle,
  GitBranch, MessageSquare, Send, Loader2, Wand2,
  ChevronDown, ChevronUp, ExternalLink, FileCode, Bug,
} from 'lucide-react';
import { solutionsApi, issuesApi, getApiError } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────
interface SolutionComment {
  author_id: string;
  author_username: string;
  body: string;
  created_at: string;
}

interface Solution {
  id: string;
  issue_id: string;
  author_id: string;
  author_username: string;
  repo_id: string;
  description: string;
  file_patch?: string;
  requested_points: number;
  uploaded_filename?: string;
  status: string;
  review?: { notes: string; status: string; reviewer_id: string };
  points_awarded: number;
  is_synced_to_github: boolean;
  github_pr_url?: string;
  comments: SolutionComment[];
  created_at: string;
  updated_at: string;
}

interface Issue {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  bounty_points: number;
  author_id: string;
  repo_name: string;
  file_id?: string;
  file_path?: string;
  tags: string[];
  solutions_count: number;
  repo_id: string;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function Avatar({ name }: { name: string }) {
  const initials = name.slice(0, 2).toUpperCase();
  const hue = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{
      width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
      background: `hsl(${hue}, 55%, 35%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '11px', fontWeight: 700, color: '#fff',
    }}>
      {initials}
    </div>
  );
}

const statusConfig: Record<string, { bg: string; color: string; label: string }> = {
  pending:  { bg: 'var(--bg-elevated)', color: 'var(--silver-400)', label: 'Pending Review' },
  accepted: { bg: 'var(--success-dim)', color: 'var(--success)', label: 'Accepted' },
  rejected: { bg: 'var(--error-dim)',   color: 'var(--error)',   label: 'Rejected' },
};

// ── Main Component ─────────────────────────────────────────────────────────
export default function SolutionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();

  const [solution, setSolution] = useState<Solution | null>(null);
  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);

  // Review state
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewPoints, setReviewPoints] = useState(0);
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  // Comment state
  const [commentBody, setCommentBody] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(true);

  // GitHub sync state
  const [syncing, setSyncing] = useState(false);

  // Patch view
  const [patchExpanded, setPatchExpanded] = useState(false);

  // ── Load data ──────────────────────────────────────────────────────────
  const load = async () => {
    if (!id) return;
    try {
      const solRes = await solutionsApi.get(id);
      const sol: Solution = solRes.data;
      setSolution(sol);
      setReviewPoints(sol.requested_points || 0);

      // Load related issue
      try {
        const issueRes = await issuesApi.get(sol.issue_id);
        setIssue(issueRes.data);
      } catch {
        // Issue may be deleted — that's OK
      }
    } catch (e: unknown) {
      toast(getApiError(e, 'Failed to load solution'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  // ── Review ─────────────────────────────────────────────────────────────
  const handleReview = async (status: 'accepted' | 'rejected') => {
    if (!solution) return;
    setReviewing(true);
    try {
      const res = await solutionsApi.review(solution.id, {
        status,
        notes: reviewNotes,
        points_to_award: reviewPoints,
      });
      setSolution(res.data);
      toast(`Solution ${status}!`, status === 'accepted' ? 'success' : 'info');
      setShowReviewPanel(false);
    } catch (e: unknown) {
      toast(getApiError(e, 'Review failed'), 'error');
    } finally {
      setReviewing(false);
    }
  };

  // ── Comment ────────────────────────────────────────────────────────────
  const handleAddComment = async () => {
    if (!solution || !commentBody.trim()) return;
    setCommentSubmitting(true);
    try {
      const res = await solutionsApi.addComment(solution.id, commentBody.trim());
      setSolution(res.data);
      setCommentBody('');
      toast('Comment posted!', 'success');
    } catch (e: unknown) {
      toast(getApiError(e, 'Failed to post comment'), 'error');
    } finally {
      setCommentSubmitting(false);
    }
  };

  // ── GitHub Sync ────────────────────────────────────────────────────────
  const handleSyncGitHub = async () => {
    if (!solution) return;
    setSyncing(true);
    try {
      const res = await solutionsApi.syncToGithub(solution.id);
      setSolution(res.data);
      toast('Pull Request created on GitHub!', 'success');
    } catch (e: unknown) {
      toast(getApiError(e, 'GitHub sync failed'), 'error');
    } finally {
      setSyncing(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────
  const isIssueAuthor = user && issue && user.id === issue.author_id;
  const isSolutionAuthor = user && solution && user.id === solution.author_id;
  const statusCfg = solution ? (statusConfig[solution.status] ?? statusConfig.pending) : statusConfig.pending;

  // ── Render ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: '40px', width: '200px', marginBottom: '28px' }} />
        <div className="skeleton" style={{ height: '160px', marginBottom: '20px' }} />
        <div className="skeleton" style={{ height: '280px', marginBottom: '20px' }} />
        <div className="skeleton" style={{ height: '200px' }} />
      </div>
    );
  }

  if (!solution) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: '80px' }}>
        <Bug size={48} style={{ color: 'var(--silver-700)', margin: '0 auto 16px', display: 'block' }} />
        <h2>Solution not found</h2>
        <p style={{ color: 'var(--silver-500)', marginTop: '8px' }}>This solution may have been removed.</p>
        <Link to="/solutions" className="btn btn-secondary" style={{ marginTop: '24px', display: 'inline-flex' }}>
          <ArrowLeft size={14} /> Back to Solutions
        </Link>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: '860px' }}>
      {/* ── Back nav ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Link
          to="/solutions"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--silver-500)', fontSize: '13px' }}
        >
          <ArrowLeft size={14} /> All Solutions
        </Link>
        {issue && (
          <>
            <span style={{ color: 'var(--silver-700)' }}>/</span>
            <Link
              to={`/issues/${issue.id}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--silver-500)', fontSize: '13px' }}
            >
              <Bug size={13} /> {issue.title}
            </Link>
          </>
        )}
      </div>

      {/* ── Solution Header Card ────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '20px', padding: '24px' }}>
        {/* Status + points row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{
              padding: '4px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: 700,
              background: statusCfg.bg, color: statusCfg.color, letterSpacing: '0.04em',
              border: `1px solid ${statusCfg.color}33`,
            }}>
              {statusCfg.label}
            </span>
            {solution.points_awarded > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px', fontWeight: 700, color: 'var(--warning)' }}>
                <Zap size={14} /> +{solution.points_awarded} pts awarded
              </span>
            )}
            {solution.status === 'pending' && solution.requested_points > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', fontWeight: 600, color: 'var(--warning)', opacity: 0.8 }}>
                <Zap size={13} /> Bidding {solution.requested_points} pts
              </span>
            )}
          </div>
          {solution.is_synced_to_github && solution.github_pr_url && (
            <a
              href={solution.github_pr_url}
              target="_blank"
              rel="noreferrer"
              className="btn btn-sm"
              style={{ background: '#24292e', color: '#fff', border: '1px solid #30363d', gap: '6px' }}
            >
              <GitBranch size={13} /> View Pull Request <ExternalLink size={11} />
            </a>
          )}
        </div>

        {/* Author + meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <Avatar name={solution.author_username} />
          <div>
            <Link to={`/users/${solution.author_id}`} style={{ fontWeight: 600, fontSize: '14px', color: 'var(--silver-200)' }}>
              {solution.author_username}
            </Link>
            <div style={{ fontSize: '12px', color: 'var(--silver-600)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <Clock size={11} /> Submitted {new Date(solution.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: solution.file_patch ? '20px' : '0' }}>
          <div style={{ fontSize: '12px', color: 'var(--silver-600)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px', fontWeight: 600 }}>
            Solution Description
          </div>
          <p style={{ color: 'var(--silver-300)', lineHeight: 1.8, fontSize: '14px', whiteSpace: 'pre-wrap' }}>
            {solution.description}
          </p>
        </div>

        {/* Code Patch */}
        {solution.file_patch && (
          <div style={{ marginTop: '20px' }}>
            <button
              onClick={() => setPatchExpanded(p => !p)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '12px', fontWeight: 600, color: 'var(--silver-400)',
                textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-sans)',
                padding: 0,
              }}
            >
              <FileCode size={14} /> Code Patch
              {patchExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {patchExpanded && (
              <pre style={{
                background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '8px',
                padding: '16px', fontFamily: 'var(--font-mono)', fontSize: '12px',
                color: 'var(--silver-300)', overflowX: 'auto', lineHeight: 1.7,
                maxHeight: '400px', overflowY: 'auto',
              }}>
                {solution.file_patch.split('\n').map((line, i) => {
                  const isAdd = line.startsWith('+') && !line.startsWith('+++');
                  const isDel = line.startsWith('-') && !line.startsWith('---');
                  return (
                    <span
                      key={i}
                      style={{
                        display: 'block',
                        color: isAdd ? 'var(--success)' : isDel ? 'var(--error)' : 'var(--silver-400)',
                        background: isAdd ? 'rgba(74,222,128,0.05)' : isDel ? 'rgba(248,113,113,0.05)' : 'transparent',
                      }}
                    >
                      {line}
                    </span>
                  );
                })}
              </pre>
            )}
          </div>
        )}

        {/* Uploaded file */}
        {solution.uploaded_filename && (
          <div style={{ marginTop: '16px', padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--silver-400)' }}>
            <FileCode size={14} />
            <span>Attached file: <strong style={{ color: 'var(--silver-200)' }}>{solution.uploaded_filename}</strong></span>
          </div>
        )}
      </div>

      {/* ── Review Notes (if reviewed) ──────────────────────────────────── */}
      {solution.review && (
        <div className="card" style={{ marginBottom: '20px', borderColor: solution.status === 'accepted' ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            {solution.status === 'accepted'
              ? <CheckCircle size={16} style={{ color: 'var(--success)' }} />
              : <XCircle size={16} style={{ color: 'var(--error)' }} />
            }
            <span style={{ fontWeight: 600, fontSize: '14px', color: solution.status === 'accepted' ? 'var(--success)' : 'var(--error)' }}>
              Review: {solution.status === 'accepted' ? 'Accepted' : 'Rejected'}
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--silver-400)', lineHeight: 1.6 }}>
            {solution.review.notes || 'No additional notes provided.'}
          </p>
        </div>
      )}

      {/* ── Issue Context Card ──────────────────────────────────────────── */}
      {issue && (
        <div className="card" style={{ marginBottom: '20px', background: 'var(--bg-elevated)' }}>
          <div style={{ fontSize: '12px', color: 'var(--silver-600)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: '10px' }}>
            Related Issue
          </div>
          <Link to={`/issues/${issue.id}`} style={{ textDecoration: 'none' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--silver-100)', marginBottom: '8px', lineHeight: 1.4 }}>
              {issue.title}
            </h3>
          </Link>
          <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--silver-600)', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <GitBranch size={11} />
              <span style={{ fontFamily: 'var(--font-mono)' }}>{issue.repo_name}</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Zap size={11} style={{ color: 'var(--warning)' }} /> {issue.bounty_points} bounty pts
            </span>
            <span style={{
              padding: '1px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
              background: issue.status === 'resolved' ? 'var(--success-dim)' : 'var(--bg-hover)',
              color: issue.status === 'resolved' ? 'var(--success)' : 'var(--silver-400)',
            }}>
              {issue.status}
            </span>
          </div>
        </div>
      )}

      {/* ── Review Panel (repo owner only, solution still pending) ──────── */}
      {isIssueAuthor && solution.status === 'pending' && (
        <div className="card" style={{ marginBottom: '20px', borderColor: 'rgba(251,191,36,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showReviewPanel ? '16px' : '0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={16} style={{ color: 'var(--warning)' }} />
              <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--warning)' }}>Review this Solution</span>
            </div>
            <button
              onClick={() => setShowReviewPanel(p => !p)}
              className="btn btn-sm btn-ghost"
            >
              {showReviewPanel ? 'Cancel' : 'Open Review'}
            </button>
          </div>

          {showReviewPanel && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Review Notes (optional)</label>
                <textarea
                  className="form-textarea"
                  style={{ minHeight: '80px' }}
                  placeholder="Leave feedback for the solution author…"
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Zap size={13} style={{ color: 'var(--warning)' }} /> Points to Award
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="number"
                    className="form-input"
                    style={{ width: '130px' }}
                    min="0"
                    max={issue?.bounty_points || 1000}
                    value={reviewPoints}
                    onChange={e => setReviewPoints(parseInt(e.target.value) || 0)}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--silver-600)' }}>
                    Bounty pool: {issue?.bounty_points || 0} pts
                    {solution.requested_points > 0 && ` · Solver bid: ${solution.requested_points} pts`}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => handleReview('accepted')}
                  disabled={reviewing}
                  className="btn btn-sm"
                  style={{ background: 'var(--success-dim)', color: 'var(--success)', border: '1px solid rgba(74,222,128,0.3)' }}
                >
                  {reviewing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={13} />}
                  Accept Solution
                </button>
                <button
                  onClick={() => handleReview('rejected')}
                  disabled={reviewing}
                  className="btn btn-danger btn-sm"
                >
                  {reviewing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <XCircle size={13} />}
                  Reject
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── GitHub Sync (issue author, accepted solution with file_patch) ── */}
      {solution.status === 'accepted' && issue?.file_id && solution.file_patch && isIssueAuthor && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '12px', color: 'var(--silver-600)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: '12px' }}>
            GitHub Integration
          </div>
          {solution.is_synced_to_github && solution.github_pr_url ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--success)', fontSize: '14px' }}>
              <GitBranch size={16} />
              <span>Pull Request created:</span>
              <a href={solution.github_pr_url} target="_blank" rel="noreferrer" style={{ color: 'var(--info)', textDecoration: 'underline' }}>
                {solution.github_pr_url}
              </a>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <button
                onClick={handleSyncGitHub}
                disabled={syncing}
                className="btn btn-sm"
                style={{ background: '#24292e', color: '#fff', border: '1px solid #30363d', gap: '6px' }}
              >
                {syncing
                  ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Creating PR…</>
                  : <><GitBranch size={13} /> Sync to GitHub (Create PR)</>
                }
              </button>
              <span style={{ fontSize: '12px', color: 'var(--silver-500)', maxWidth: '400px', lineHeight: 1.5 }}>
                This will create a new branch and open a Pull Request on GitHub with the solution's code patch.
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Comments Section ────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <button
          onClick={() => setCommentsOpen(p => !p)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
            padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--silver-400)', fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600,
          }}
        >
          <MessageSquare size={15} style={{ color: 'var(--silver-500)' }} />
          {solution.comments.length > 0
            ? `${solution.comments.length} Comment${solution.comments.length > 1 ? 's' : ''}`
            : 'Comments'}
          <span style={{ marginLeft: 'auto' }}>
            {commentsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>

        {commentsOpen && (
          <div style={{ borderTop: '1px solid var(--border)', padding: '20px' }}>
            {/* Existing comments */}
            {solution.comments.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                {solution.comments.map((c, idx) => {
                  const isAI = c.author_username === 'CodeFlow AI';
                  return (
                    <div key={idx} style={{ display: 'flex', gap: '12px' }}>
                      <Avatar name={c.author_username} />
                      <div style={{
                        flex: 1,
                        background: isAI ? 'rgba(56,189,248,0.05)' : 'var(--bg-elevated)',
                        borderRadius: '10px', padding: '12px 16px',
                        border: isAI ? '1px solid rgba(56,189,248,0.25)' : '1px solid var(--border)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: isAI ? '#38bdf8' : 'var(--silver-200)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            {isAI && <Wand2 size={12} />}
                            {isAI ? c.author_username : (
                              <Link to={`/users/${c.author_id}`} style={{ color: 'var(--silver-200)', textDecoration: 'none' }}>
                                {c.author_username}
                              </Link>
                            )}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--silver-600)' }}>
                            {new Date(c.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p style={{ fontSize: '13px', color: isAI ? 'var(--silver-300)' : 'var(--silver-400)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                          {c.body}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* New comment form */}
            {user ? (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <Avatar name={user.username || 'U'} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <textarea
                    id="new-comment-input"
                    className="form-textarea"
                    style={{ minHeight: '80px', fontSize: '13px' }}
                    placeholder="Add a comment, ask a question, or leave feedback…"
                    value={commentBody}
                    onChange={e => setCommentBody(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddComment();
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--silver-600)' }}>⌘ + Enter to submit</span>
                    <button
                      id="post-comment-btn"
                      className="btn btn-primary btn-sm"
                      onClick={handleAddComment}
                      disabled={commentSubmitting || !commentBody.trim()}
                    >
                      {commentSubmitting
                        ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Posting…</>
                        : <><Send size={12} /> Post Comment</>
                      }
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: 'var(--silver-600)', textAlign: 'center', padding: '20px 0' }}>
                <Link to="/" style={{ color: 'var(--silver-400)' }}>Sign in</Link> to leave a comment.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Spacer */}
      <div style={{ height: '48px' }} />
    </div>
  );
}
