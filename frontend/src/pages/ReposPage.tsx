import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GitBranch, Plus, Trash2, RefreshCw, FileCode, Loader2, CheckCircle, XCircle, Clock, Star, GitFork } from 'lucide-react';
import { reposApi } from '../lib/api';
import { useToast } from '../contexts/ToastContext';

interface Repo {
  id: string;
  github_url: string;
  github_owner: string;
  github_repo: string;
  branch: string;
  description?: string;
  language?: string;
  stars: number;
  forks: number;
  status: string;
  total_files: number;
  public_files_count: number;
  listed_files_count: number;
  is_synced: boolean;
  created_at: string;
}

const statusIcon: Record<string, React.ReactNode> = {
  ready: <CheckCircle size={14} style={{ color: 'var(--success)' }} />,
  importing: <Loader2 size={14} style={{ color: 'var(--warning)', animation: 'spin 1s linear infinite' }} />,
  syncing: <Loader2 size={14} style={{ color: 'var(--info)', animation: 'spin 1s linear infinite' }} />,
  error: <XCircle size={14} style={{ color: 'var(--error)' }} />,
};

const langColors: Record<string, string> = {
  Python: '#3572A5', JavaScript: '#f1e05a', TypeScript: '#2b7489',
  Java: '#b07219', Go: '#00ADD8', Rust: '#dea584', 'C++': '#f34b7d',
  C: '#555555', Ruby: '#701516', PHP: '#4F5D95', Swift: '#ffac45',
};

export default function ReposPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [url, setUrl] = useState('');
  const [branch, setBranch] = useState('');
  const { toast } = useToast();

  const load = () => {
    reposApi.list()
      .then(r => setRepos(r.data.repos))
      .catch(() => toast('Failed to load repositories', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleImport = async () => {
    if (!url.trim()) return;
    setImporting(true);
    try {
      await reposApi.import(url.trim(), branch.trim() || undefined);
      toast('Repository import started!', 'success');
      setShowModal(false);
      setUrl('');
      setBranch('');
      load();
    } catch (e: any) {
      toast(e.response?.data?.detail || 'Import failed', 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}?`)) return;
    try {
      await reposApi.delete(id);
      toast('Repository deleted', 'success');
      setRepos(r => r.filter(x => x.id !== id));
    } catch {
      toast('Failed to delete', 'error');
    }
  };

  const handleSync = async (id: string) => {
    try {
      await reposApi.sync(id);
      toast('Sync started', 'info');
      load();
    } catch (e: any) {
      toast(e.response?.data?.detail || 'Sync failed', 'error');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Repositories</h1>
          <p>{repos.length} repositories imported</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={16} /> Import Repository
        </button>
      </div>

      {loading ? (
        <div className="grid-2">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: '180px' }} />)}
        </div>
      ) : repos.length === 0 ? (
        <div className="empty-state">
          <GitBranch />
          <h3>No repositories yet</h3>
          <p>Import a GitHub repository to get started</p>
          <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ marginTop: '16px' }}>
            <Plus size={16} /> Import your first repo
          </button>
        </div>
      ) : (
        <div className="grid-2">
          {repos.map(repo => (
            <div key={repo.id} className="card" style={{ position: 'relative' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                <Link
                  to={`/repos/${repo.id}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
                >
                  <GitBranch size={16} style={{ color: 'var(--silver-500)', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 600, color: 'var(--silver-100)' }}>
                      {repo.github_owner}/{repo.github_repo}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--silver-600)', marginTop: '2px' }}>
                      {repo.branch}
                    </div>
                  </div>
                </Link>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {statusIcon[repo.status] || <Clock size={14} style={{ color: 'var(--silver-600)' }} />}
                  <span style={{ fontSize: '12px', color: 'var(--silver-600)', fontWeight: 500 }}>{repo.status}</span>
                </div>
              </div>

              {repo.description && (
                <p style={{ fontSize: '13px', color: 'var(--silver-500)', marginBottom: '16px', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {repo.description}
                </p>
              )}

              {/* Stats */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', color: 'var(--silver-600)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <FileCode size={12} /> {repo.total_files} files
                </span>
                <span style={{ fontSize: '12px', color: 'var(--silver-600)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Star size={12} /> {repo.stars}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--silver-600)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <GitFork size={12} /> {repo.forks}
                </span>
                {repo.language && (
                  <span style={{ fontSize: '12px', color: 'var(--silver-400)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: langColors[repo.language] || 'var(--silver-600)', display: 'inline-block' }} />
                    {repo.language}
                  </span>
                )}
              </div>

              <hr className="divider" />

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Link to={`/repos/${repo.id}`} className="btn btn-ghost btn-sm">
                  <FileCode size={12} /> Browse Files
                </Link>
                <button
                  onClick={() => handleSync(repo.id)}
                  className="btn btn-ghost btn-sm"
                  disabled={repo.status === 'importing' || repo.status === 'syncing'}
                >
                  <RefreshCw size={12} /> Sync
                </button>
                <button
                  onClick={() => handleDelete(repo.id, `${repo.github_owner}/${repo.github_repo}`)}
                  className="btn btn-danger btn-sm"
                  style={{ marginLeft: 'auto' }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Import Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Import Repository</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-group">
                <label className="form-label">GitHub URL *</label>
                <input
                  className="form-input"
                  placeholder="https://github.com/owner/repo"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleImport()}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Branch (optional)</label>
                <input
                  className="form-input"
                  placeholder="main"
                  value={branch}
                  onChange={e => setBranch(e.target.value)}
                />
              </div>

              <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', padding: '12px 16px', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: '12px', color: 'var(--silver-500)', lineHeight: 1.6 }}>
                  Files will be imported in the background. All files start as <strong style={{ color: 'var(--silver-400)' }}>private</strong>. You control which files become public or listed.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowModal(false)} className="btn btn-ghost">
                  Cancel
                </button>
                <button onClick={handleImport} className="btn btn-primary" disabled={importing || !url.trim()}>
                  {importing ? <><div className="spinner" style={{ width: '14px', height: '14px' }} /> Importing…</> : <><Plus size={16} /> Import</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
