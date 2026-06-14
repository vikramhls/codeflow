import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Medal, Zap, Award } from 'lucide-react';
import { usersApi } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

interface Entry {
  id: string;
  rank: number;
  username: string;
  avatar_url: string;
  points: number;
  solutions_accepted: number;
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usersApi.leaderboard(50)
      .then(r => setEntries(r.data))
      .catch(() => toast('Failed to load leaderboard', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const rankIcon = (rank: number) => {
    if (rank === 1) return <Trophy size={18} style={{ color: '#FFD700' }} />;
    if (rank === 2) return <Medal size={18} style={{ color: '#C0C0C0' }} />;
    if (rank === 3) return <Award size={18} style={{ color: '#CD7F32' }} />;
    return <span style={{ fontSize: '14px', color: 'var(--silver-600)', width: '18px', textAlign: 'center' }}>{rank}</span>;
  };

  const top3 = entries.slice(0, 3);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Leaderboard</h1>
          <p>Top developers ranked by bounty points earned</p>
        </div>
      </div>

      {/* Top 3 podium */}
      {!loading && top3.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '48px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {/* 2nd */}
          {top3[1] && (
            <div style={{ textAlign: 'center', flex: '0 0 160px' }}>
              <Link to={`/users/${top3[1].id}`} style={{ textDecoration: 'none' }}>
                <img src={top3[1].avatar_url} alt={top3[1].username} style={{ width: '56px', height: '56px', borderRadius: '50%', border: '3px solid #C0C0C0', marginBottom: '8px' }} />
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--silver-200)', marginBottom: '4px' }}>{top3[1].username}</div>
              </Link>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#C0C0C0' }}>{top3[1].points}</div>
              <div style={{ fontSize: '11px', color: 'var(--silver-600)', marginTop: '2px' }}>2nd place</div>
              <div style={{
                height: '80px', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: '8px 8px 0 0', marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Medal size={24} style={{ color: '#C0C0C0' }} />
              </div>
            </div>
          )}

          {/* 1st */}
          {top3[0] && (
            <div style={{ textAlign: 'center', flex: '0 0 180px' }}>
              <Link to={`/users/${top3[0].id}`} style={{ textDecoration: 'none' }}>
                <div style={{ position: 'relative', display: 'inline-block', marginBottom: '8px' }}>
                  <img src={top3[0].avatar_url} alt={top3[0].username} style={{ width: '72px', height: '72px', borderRadius: '50%', border: '3px solid #FFD700' }} />
                  <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', fontSize: '24px' }}>👑</div>
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--silver-50)', marginBottom: '4px' }}>{top3[0].username}</div>
              </Link>
              <div style={{ fontSize: '28px', fontWeight: 900, color: '#FFD700' }}>{top3[0].points}</div>
              <div style={{ fontSize: '11px', color: 'var(--silver-600)', marginTop: '2px' }}>1st place</div>
              <div style={{
                height: '120px', background: 'linear-gradient(to top, var(--bg-elevated), rgba(255,215,0,0.08))',
                border: '1px solid rgba(255,215,0,0.3)',
                borderRadius: '8px 8px 0 0', marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Trophy size={32} style={{ color: '#FFD700' }} />
              </div>
            </div>
          )}

          {/* 3rd */}
          {top3[2] && (
            <div style={{ textAlign: 'center', flex: '0 0 160px' }}>
              <Link to={`/users/${top3[2].id}`} style={{ textDecoration: 'none' }}>
                <img src={top3[2].avatar_url} alt={top3[2].username} style={{ width: '48px', height: '48px', borderRadius: '50%', border: '3px solid #CD7F32', marginBottom: '8px' }} />
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--silver-200)', marginBottom: '4px' }}>{top3[2].username}</div>
              </Link>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#CD7F32' }}>{top3[2].points}</div>
              <div style={{ fontSize: '11px', color: 'var(--silver-600)', marginTop: '2px' }}>3rd place</div>
              <div style={{
                height: '60px', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: '8px 8px 0 0', marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Award size={20} style={{ color: '#CD7F32' }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Full list */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'grid', gridTemplateColumns: '48px 1fr auto auto', gap: '12px', fontSize: '11px', color: 'var(--silver-600)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          <span>Rank</span>
          <span>Developer</span>
          <span>Accepted</span>
          <span>Points</span>
        </div>
        {loading ? (
          <div style={{ padding: '16px' }}>
            {[...Array(10)].map((_, i) => <div key={i} className="skeleton" style={{ height: '56px', marginBottom: '4px', borderRadius: '8px' }} />)}
          </div>
        ) : entries.map(entry => (
          <div
            key={entry.rank}
            style={{
              display: 'grid', gridTemplateColumns: '48px 1fr auto auto', gap: '12px',
              padding: '14px 20px', alignItems: 'center',
              borderBottom: '1px solid var(--border)',
              background: user?.username === entry.username ? 'rgba(255,255,255,0.02)' : 'transparent',
              transition: 'background var(--transition)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
            onMouseLeave={e => (e.currentTarget.style.background = user?.username === entry.username ? 'rgba(255,255,255,0.02)' : 'transparent')}
          >
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              {rankIcon(entry.rank)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src={entry.avatar_url} alt={entry.username} style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid var(--border)' }} />
              <div>
                <Link to={`/users/${entry.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: user?.username === entry.username ? 'var(--silver-50)' : 'var(--silver-200)' }}>
                    {entry.username}
                    {user?.username === entry.username && (
                      <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--silver-600)', fontWeight: 400 }}>you</span>
                    )}
                  </div>
                </Link>
              </div>
            </div>
            <div style={{ fontSize: '14px', color: 'var(--silver-400)', textAlign: 'right' }}>
              {entry.solutions_accepted}
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--warning)', textAlign: 'right', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
              <Zap size={13} /> {entry.points}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
