import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lightbulb, ExternalLink, Zap, Clock } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { usersApi } from '../lib/api';

export default function SolutionsPage() {
  const { toast } = useToast();
  const [solutions, setSolutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usersApi.dashboard()
      .then(r => setSolutions(r.data.recent_solutions))
      .catch(() => toast('Failed to load solutions', 'error'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>My Solutions</h1>
          <p>Solutions you've submitted across all issues</p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: '80px' }} />)}
        </div>
      ) : solutions.length === 0 ? (
        <div className="empty-state">
          <Lightbulb />
          <h3>No solutions yet</h3>
          <p>Browse issues and submit your first fix to earn bounty points!</p>
          <Link to="/issues" className="btn btn-primary" style={{ marginTop: '16px', display: 'inline-flex' }}>
            Browse Issues
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {solutions.map((sol: any) => (
            <Link key={sol.id} to={`/issues/${sol.issue_id}`} style={{ textDecoration: 'none' }}>
              <div
                className="card"
                style={{
                  padding: '16px 20px',
                  borderColor: sol.status === 'accepted' ? 'rgba(74,222,128,0.2)' : sol.status === 'rejected' ? 'rgba(248,113,113,0.2)' : 'var(--border)',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = sol.status === 'accepted' ? 'rgba(74,222,128,0.4)' : 'var(--border-bright)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = sol.status === 'accepted' ? 'rgba(74,222,128,0.2)' : 'var(--border)')}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Lightbulb size={16} style={{ color: 'var(--silver-500)', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--silver-200)', fontFamily: 'var(--font-mono)' }}>
                        Solution #{sol.id?.slice(-6)}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--silver-600)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={10} /> {new Date(sol.created_at).toLocaleDateString()}
                        <ExternalLink size={10} /> Issue #{sol.issue_id?.slice(-6)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {sol.points_awarded > 0 && (
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Zap size={12} /> +{sol.points_awarded} pts
                      </span>
                    )}
                    <span style={{
                      padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                      background: sol.status === 'accepted' ? 'var(--success-dim)' : sol.status === 'rejected' ? 'var(--error-dim)' : 'var(--bg-elevated)',
                      color: sol.status === 'accepted' ? 'var(--success)' : sol.status === 'rejected' ? 'var(--error)' : 'var(--silver-400)',
                    }}>
                      {sol.status}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
