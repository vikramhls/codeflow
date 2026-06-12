
import { Component, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import LandingPage from './pages/LandingPage';
import AuthCallback from './pages/AuthCallback';
import DashboardPage from './pages/DashboardPage';
import ReposPage from './pages/ReposPage';
import RepoDetailPage from './pages/RepoDetailPage';
import FileDetailPage from './pages/FileDetailPage';
import IssuesPage from './pages/IssuesPage';
import IssueDetailPage from './pages/IssueDetailPage';
import ExplorePage from './pages/ExplorePage';
import LeaderboardPage from './pages/LeaderboardPage';
import SolutionsPage from './pages/SolutionsPage';
import SolutionDetailPage from './pages/SolutionDetailPage';
import ProfilePage from './pages/ProfilePage';
import DevOpsReportPage from './pages/DevOpsReportPage';
import MockInterviewPage from './pages/MockInterviewPage';
import RepoAskPage from './pages/RepoAskPage';
import RepoMapPage from './pages/RepoMapPage';
import CliLoginPage from './pages/CliLoginPage';

// Layout wrapper with sidebar
import {
  Code2, Home, GitBranch,
  Trophy, Compass, LogOut, ChevronRight, Zap, Bug, Lightbulb
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

// ── Global Error Boundary ─────────────────────────────────────────────
interface EBState { error: Error | null; }
class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', background: '#0a0a0a', color: '#e2e8f0', fontFamily: 'system-ui', gap: '16px', padding: '32px',
        }}>
          <div style={{ fontSize: '32px' }}>⚠️</div>
          <h2 style={{ margin: 0 }}>Something went wrong</h2>
          <pre style={{ fontSize: '12px', color: '#94a3b8', background: '#1e293b', padding: '16px', borderRadius: '8px', maxWidth: '600px', overflow: 'auto', whiteSpace: 'pre-wrap' }}>
            {this.state.error.message}
          </pre>
          <button
            onClick={() => { this.setState({ error: null }); window.location.href = '/dashboard'; }}
            style={{ padding: '10px 20px', borderRadius: '8px', background: '#334155', border: '1px solid #475569', color: '#e2e8f0', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Go to Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const navItems = [
  { path: '/dashboard', icon: Home, label: 'Dashboard' },
  { path: '/repos', icon: GitBranch, label: 'Repositories' },
  { path: '/explore', icon: Compass, label: 'Explore' },
  { path: '/issues', icon: Bug, label: 'Issues' },
  { path: '/solutions', icon: Lightbulb, label: 'Solutions' },
  { path: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
];

function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, bottom: 0, width: '220px',
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ padding: '22px 18px 14px', borderBottom: '1px solid var(--border)' }}>
        <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <div style={{
            width: '34px', height: '34px',
            background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)',
            borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Code2 size={18} style={{ color: 'var(--silver-300)' }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--silver-50)', letterSpacing: '-0.02em' }}>CodeFlow</div>
            <div style={{ fontSize: '9px', color: 'var(--silver-600)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Bug Bounty</div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
        {navItems.map(({ path, icon: Icon, label }) => {
          const active = location.pathname.startsWith(path);
          return (
            <Link
              key={path} to={path}
              style={{
                display: 'flex', alignItems: 'center', gap: '9px',
                padding: '8px 11px', borderRadius: '7px',
                fontSize: '13.5px', fontWeight: active ? 600 : 400,
                color: active ? 'var(--silver-100)' : 'var(--silver-500)',
                background: active ? 'var(--bg-elevated)' : 'transparent',
                border: active ? '1px solid var(--border)' : '1px solid transparent',
                transition: 'all var(--transition)', textDecoration: 'none',
              }}
            >
              <Icon size={15} />
              {label}
              {active && <ChevronRight size={12} style={{ marginLeft: 'auto', color: 'var(--silver-700)' }} />}
            </Link>
          );
        })}
      </div>

      {/* User */}
      {user && (
        <div style={{ padding: '10px', borderTop: '1px solid var(--border)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '9px', padding: '9px 11px',
            borderRadius: '8px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', marginBottom: '6px',
          }}>
            <img src={user.avatar_url} alt={user.username} style={{ width: '30px', height: '30px', borderRadius: '50%', border: '1px solid var(--border)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--silver-100)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name || user.username}</div>
              <div style={{ fontSize: '11px', color: 'var(--silver-600)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Zap size={9} /> {user.points ?? 0} pts
              </div>
            </div>
          </div>
          <button onClick={logout} className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
            <LogOut size={13} /> Sign out
          </button>
        </div>
      )}
    </nav>
  );
}

function AppLayout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: '220px', flex: 1, minWidth: 0 }}>
        <Outlet />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              {/* Public */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/cli-login" element={<CliLoginPage />} />

              {/* Protected — authenticated layout */}
              <Route element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/repos" element={<ReposPage />} />
                <Route path="/repos/:id" element={<RepoDetailPage />} />
                <Route path="/repos/:id/devops" element={<DevOpsReportPage />} />
                <Route path="/repos/:id/map" element={<RepoMapPage />} />
                <Route path="/repos/:id/interview" element={<MockInterviewPage />} />
                <Route path="/repos/:id/ask" element={<RepoAskPage />} />
                <Route path="/files/:id" element={<FileDetailPage />} />
                <Route path="/issues" element={<IssuesPage />} />
                <Route path="/issues/:id" element={<IssueDetailPage />} />
                <Route path="/solutions" element={<SolutionsPage />} />
                <Route path="/solutions/:id" element={<SolutionDetailPage />} />
                <Route path="/explore" element={<ExplorePage />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
                <Route path="/users/:id" element={<ProfilePage />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

