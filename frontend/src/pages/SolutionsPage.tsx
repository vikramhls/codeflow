import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Lightbulb, ExternalLink, Zap, Clock, CheckCircle,
  XCircle, Loader2, ChevronRight, GitBranch, Filter,
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { usersApi, getApiError } from '../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface MySolution {
  id: string;
  issue_id: string;
  status: string;
  points_awarded: number;
  created_at: string;
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_TABS = [
  { key: 'all',      label: 'All' },
  { key: 'pending',  label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'rejected', label: 'Rejected' },
];

function statusStyle(status: string) {
  if (status === 'accepted') return { bg: 'var(--success-dim)', color: 'var(--success)' };
  if (status === 'rejected') return { bg: 'var(--error-dim)',   color: 'var(--error)' };
  return { bg: 'var(--bg-elevated)', color: 'var(--silver-400)' };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SolutionsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [solutions, setSolutions] = useState<MySolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  // Stats derived from solutions
  const stats = {
    total:    solutions.length,
    accepted: solutions.filter(s => s.status === 'accepted').length,
    pending:  solutions.filter(s => s.status === 'pending').length,
    rejected: solutions.filter(s => s.status === 'rejected').length,
    points:   solutions.reduce((sum, s) => sum + (s.points_awarded || 0), 0),
  };

  useEffect(() => {
    usersApi.dashboard()
      .then(r => {
        // dashboard gives recent_solutions; for full list we use it too
        // (Solutions full list API requires per-issue, so dashboard is the best source)
        setSolutions(r.data.recent_solutions || []);
      })
      .catch(e => toast(getApiError(e, 'Failed to load solutions'), 'error'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = activeTab === 'all'
    ? solutions
    : solutions.filter(s => s.status === activeTab);

  const totalPoints = stats.points;

  return (
    <div className="page">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1>My Solutions</h1>
          <p>Track your submissions, review outcomes, and view earned points.</p>
        </div>
        <Link to="/issues" className="btn btn-primary btn-sm">
          <Lightbulb size={14} /> Browse Issues
        </Link>
      </div>

      {/* ── Stats row ─────────────────────────────────────────────────── */}
      {!loading && solutions.length > 0 && (
        <div className="grid-4" style={{ marginBottom: '28px' }}>
          {[
            { label: 'Total Submitted', value: stats.total, icon: <Lightbulb size={18} />, color: 'var(--silver-400)' },
            { label: 'Accepted',        value: stats.accepted, icon: <CheckCircle size={18} />, color: 'var(--success)' },
            { label: 'Pending Review',  value: stats.pending, icon: <Loader2 size={18} />, color: 'var(--warning)' },
            { label: 'Points Earned',   value: totalPoints, icon: <Zap size={18} />, color: 'var(--warning)' },
          ].map(stat => (
            <div key={stat.label} className="stat-card">
              <div className="stat-icon" style={{ color: stat.color }}>
                {stat.icon}
              </div>
              <div>
                <div className="stat-value" style={{ color: stat.color }}>{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Filter tabs ───────────────────────────────────────────────── */}
      {!loading && solutions.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <Filter size={13} style={{ color: 'var(--silver-600)' }} />
          {STATUS_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="btn btn-sm"
              style={{
                background: activeTab === tab.key ? 'var(--bg-elevated)' : 'transparent',
                color: activeTab === tab.key ? 'var(--silver-100)' : 'var(--silver-500)',
                border: activeTab === tab.key ? '1px solid var(--border-bright)' : '1px solid transparent',
                fontSize: '12px',
              }}
            >
              {tab.label}
              {tab.key !== 'all' && (
                <span style={{
                  marginLeft: '4px', padding: '0 6px', borderRadius: '999px',
                  background: 'var(--bg-base)', fontSize: '10px', fontWeight: 700,
                  color: tab.key === 'accepted' ? 'var(--success)' : tab.key === 'rejected' ? 'var(--error)' : 'var(--silver-500)',
                }}>
                  {solutions.filter(s => s.status === tab.key).length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Content ───────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: '84px', borderRadius: '12px' }} />
          ))}
        </div>
      ) : solutions.length === 0 ? (
        <div className="empty-state">
          <Lightbulb />
          <h3>No solutions yet</h3>
          <p>Browse open issues and submit your first fix to earn bounty points!</p>
          <Link to="/issues" className="btn btn-primary" style={{ marginTop: '20px', display: 'inline-flex' }}>
            <Lightbulb size={15} /> Browse Issues
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: '48px' }}>
          <Filter style={{ width: '40px', height: '40px' }} />
          <h3>No {activeTab} solutions</h3>
          <p>You have no solutions with this status yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map((sol) => {
            const ss = statusStyle(sol.status);
            return (
              <Link
                key={sol.id}
                to={`/solutions/${sol.id}`}
                style={{ textDecoration: 'none', display: 'block' }}
              >
                <div
                  className="card"
                  style={{
                    padding: '16px 20px',
                    borderColor: sol.status === 'accepted'
                      ? 'rgba(74,222,128,0.18)'
                      : sol.status === 'rejected'
                        ? 'rgba(248,113,113,0.18)'
                        : 'var(--border)',
                    cursor: 'pointer', transition: 'all var(--transition)',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor =
                      sol.status === 'accepted' ? 'rgba(74,222,128,0.4)'
                      : sol.status === 'rejected' ? 'rgba(248,113,113,0.4)'
                      : 'var(--border-bright)';
                    (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-elevated)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor =
                      sol.status === 'accepted' ? 'rgba(74,222,128,0.18)'
                      : sol.status === 'rejected' ? 'rgba(248,113,113,0.18)'
                      : 'var(--border)';
                    (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-surface)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    {/* Left side */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                      <div style={{
                        width: '38px', height: '38px', borderRadius: '9px', flexShrink: 0,
                        background: ss.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: `1px solid ${ss.color}33`,
                      }}>
                        {sol.status === 'accepted'
                          ? <CheckCircle size={16} style={{ color: ss.color }} />
                          : sol.status === 'rejected'
                            ? <XCircle size={16} style={{ color: ss.color }} />
                            : <Lightbulb size={16} style={{ color: ss.color }} />
                        }
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--silver-200)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
                          Solution #{sol.id?.slice(-8)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--silver-600)', flexWrap: 'wrap' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <GitBranch size={10} /> Issue #{sol.issue_id?.slice(-8)}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={10} /> {new Date(sol.created_at).toLocaleDateString()}
                          </span>
                          <ExternalLink size={10} />
                        </div>
                      </div>
                    </div>

                    {/* Right side */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                      {sol.points_awarded > 0 && (
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Zap size={13} /> +{sol.points_awarded} pts
                        </span>
                      )}
                      <span style={{
                        padding: '3px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
                        background: ss.bg, color: ss.color, textTransform: 'capitalize',
                        border: `1px solid ${ss.color}33`,
                      }}>
                        {sol.status}
                      </span>
                      <ChevronRight size={15} style={{ color: 'var(--silver-600)' }} />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── Tips banner ───────────────────────────────────────────────── */}
      {!loading && solutions.length > 0 && (
        <div style={{
          marginTop: '32px', padding: '16px 20px', borderRadius: '12px',
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          fontSize: '13px', color: 'var(--silver-500)', display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <Zap size={14} style={{ color: 'var(--warning)', flexShrink: 0 }} />
          <span>
            Earn more points by submitting high-quality code patches with your solutions.
            Repo owners award bonus points for accepted fixes!{' '}
            <Link to="/issues" style={{ color: 'var(--silver-400)' }}>Browse open issues →</Link>
          </span>
        </div>
      )}
    </div>
  );
}
