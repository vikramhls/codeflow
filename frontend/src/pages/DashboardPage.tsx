import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GitBranch, Bug, Lightbulb, Zap, ArrowRight, TrendingUp, Clock } from 'lucide-react';
import { usersApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface Dashboard {
  user: Record<string, unknown>;
  stats: Record<string, number>;
  recent_repos: Record<string, unknown>[];
  recent_issues: Record<string, unknown>[];
  recent_solutions: Record<string, unknown>[];
  point_history: Record<string, unknown>[];
}

const statusColor: Record<string, string> = {
  open: 'var(--info)',
  in_progress: 'var(--warning)',
  resolved: 'var(--success)',
  closed: 'var(--silver-600)',
  ready: 'var(--success)',
  importing: 'var(--warning)',
  error: 'var(--error)',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usersApi.dashboard()
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: '100px' }} />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: '200px' }} />
          ))}
        </div>
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Welcome back, <span className="gradient-text">{user?.name || user?.username}</span></h1>
          <p>Here's what's happening with your code today</p>
        </div>
        <Link to="/repos" className="btn btn-primary">
          <GitBranch size={16} /> Import Repository
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid-4" style={{ marginBottom: '32px' }}>
        <div className="stat-card">
          <div className="stat-icon"><GitBranch size={20} /></div>
          <div>
            <div className="stat-value">{stats?.repos_imported ?? 0}</div>
            <div className="stat-label">Repositories</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Bug size={20} /></div>
          <div>
            <div className="stat-value">{stats?.total_issues ?? 0}</div>
            <div className="stat-label">Issues Created</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Lightbulb size={20} /></div>
          <div>
            <div className="stat-value">{stats?.accepted_solutions ?? 0}</div>
            <div className="stat-label">Solutions Accepted</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ color: 'var(--warning)' }}><Zap size={20} /></div>
          <div>
            <div className="stat-value" style={{ color: 'var(--warning)' }}>{stats?.points ?? 0}</div>
            <div className="stat-label">Total Points</div>
          </div>
        </div>
      </div>

      {/* Content grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

        {/* Recent Repos */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GitBranch size={16} style={{ color: 'var(--silver-500)' }} /> Recent Repositories
            </h3>
            <Link to="/repos" style={{ fontSize: '13px', color: 'var(--silver-500)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {data?.recent_repos?.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--silver-600)' }}>
              No repositories yet.{' '}
              <Link to="/repos" style={{ color: 'var(--silver-400)' }}>Import one</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {data?.recent_repos?.map((r: any) => (
                <Link
                  key={r.id}
                  to={`/repos/${r.id}`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'var(--bg-elevated)', borderRadius: '8px',
                    border: '1px solid var(--border)',
                    textDecoration: 'none', transition: 'border-color var(--transition)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-bright)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--silver-100)', fontFamily: 'var(--font-mono)' }}>
                      {r.name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--silver-600)', marginTop: '2px' }}>
                      {r.total_files} files
                    </div>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    fontSize: '11px', fontWeight: 600,
                    color: statusColor[r.status] || 'var(--silver-500)',
                  }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColor[r.status] || 'var(--silver-600)' }} />
                    {r.status}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Issues */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bug size={16} style={{ color: 'var(--silver-500)' }} /> Recent Issues
            </h3>
            <Link to="/issues" style={{ fontSize: '13px', color: 'var(--silver-500)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {data?.recent_issues?.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--silver-600)' }}>
              No issues yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {data?.recent_issues?.map((i: any) => (
                <Link
                  key={i.id}
                  to={`/issues/${i.id}`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'var(--bg-elevated)', borderRadius: '8px',
                    border: '1px solid var(--border)',
                    textDecoration: 'none', transition: 'border-color var(--transition)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-bright)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--silver-100)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {i.title}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--silver-600)', marginTop: '2px', display: 'flex', gap: '12px' }}>
                      <span>{i.solutions_count} solutions</span>
                      {i.bounty_points > 0 && <span style={{ color: 'var(--warning)' }}>⚡ {i.bounty_points} pts</span>}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '11px', fontWeight: 600, marginLeft: '12px', flexShrink: 0,
                    color: statusColor[i.status] || 'var(--silver-500)',
                  }}>
                    {i.status}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Solutions */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lightbulb size={16} style={{ color: 'var(--silver-500)' }} /> Recent Solutions
            </h3>
          </div>
          {data?.recent_solutions?.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--silver-600)' }}>
              No solutions yet.{' '}
              <Link to="/explore" style={{ color: 'var(--silver-400)' }}>Explore issues</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {data?.recent_solutions?.map((s: any) => (
                <Link
                  key={s.id}
                  to={`/issues/${s.issue_id}`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'var(--bg-elevated)', borderRadius: '8px',
                    border: '1px solid var(--border)',
                    textDecoration: 'none', transition: 'border-color var(--transition)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-bright)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <div style={{ fontSize: '12px', color: 'var(--silver-500)', fontFamily: 'var(--font-mono)' }}>
                    Solution #{s.id.slice(-6)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {s.points_awarded > 0 && (
                      <span style={{ fontSize: '12px', color: 'var(--warning)', fontWeight: 600 }}>
                        +{s.points_awarded} pts
                      </span>
                    )}
                    <span style={{
                      fontSize: '11px', fontWeight: 600,
                      color: s.status === 'accepted' ? 'var(--success)' : s.status === 'rejected' ? 'var(--error)' : 'var(--silver-500)',
                    }}>
                      {s.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Point History */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <TrendingUp size={16} style={{ color: 'var(--silver-500)' }} />
            <h3 style={{ fontSize: '16px' }}>Point History</h3>
          </div>
          {data?.point_history?.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--silver-600)' }}>
              No point transactions yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {data?.point_history?.map((p: any) => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'var(--bg-elevated)', borderRadius: '8px',
                  border: '1px solid var(--border)',
                }}>
                  <div>
                    <div style={{ fontSize: '13px', color: 'var(--silver-200)' }}>{p.description}</div>
                    <div style={{ fontSize: '11px', color: 'var(--silver-600)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={10} /> {new Date(p.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--warning)' }}>
                    +{p.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
