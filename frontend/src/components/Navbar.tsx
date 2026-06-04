
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Code2, Home, GitBranch,
  Bug, Lightbulb, Trophy, Compass, LogOut, ChevronRight, Zap
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { path: '/dashboard', icon: Home, label: 'Dashboard' },
  { path: '/repos', icon: GitBranch, label: 'Repositories' },
  { path: '/explore', icon: Compass, label: 'Explore' },
  { path: '/issues', icon: Bug, label: 'Issues' },
  { path: '/solutions', icon: Lightbulb, label: 'Solutions' },
  { path: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <>
      <nav style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: '240px',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        transition: 'transform var(--transition)',
      }}>
        {/* Logo */}
        <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid var(--border)' }}>
          <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-bright)',
              borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Code2 size={20} style={{ color: 'var(--silver-200)' }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--silver-50)', letterSpacing: '-0.02em' }}>
                CodeFlow
              </div>
              <div style={{ fontSize: '10px', color: 'var(--silver-600)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Bug Bounty Platform
              </div>
            </div>
          </Link>
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
          {navItems.map(({ path, icon: Icon, label }) => {
            const active = location.pathname.startsWith(path);
            return (
              <Link
                key={path}
                to={path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: active ? 600 : 500,
                  color: active ? 'var(--silver-100)' : 'var(--silver-500)',
                  background: active ? 'var(--bg-elevated)' : 'transparent',
                  border: active ? '1px solid var(--border)' : '1px solid transparent',
                  transition: 'all var(--transition)',
                  textDecoration: 'none',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.color = 'var(--silver-200)';
                    (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)';
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.color = 'var(--silver-500)';
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }
                }}
              >
                <Icon size={16} />
                {label}
                {active && <ChevronRight size={14} style={{ marginLeft: 'auto', color: 'var(--silver-600)' }} />}
              </Link>
            );
          })}
        </div>

        {/* User section */}
        {user && (
          <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              marginBottom: '8px',
            }}>
              <img
                src={user.avatar_url}
                alt={user.username}
                style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid var(--border)' }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--silver-100)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.name || user.username}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--silver-600)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Zap size={10} /> {user.points ?? 0} pts
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="btn btn-ghost btn-sm"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        )}
      </nav>

      {/* Main content offset */}
      <div style={{ marginLeft: '240px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      </div>
    </>
  );
}
