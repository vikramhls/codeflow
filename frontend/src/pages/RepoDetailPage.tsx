import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { GitBranch, FileCode, Eye, EyeOff, List, ListX,
  RefreshCw, Wand2, ArrowLeft, Star, GitFork, Search, Globe, Lock, Server, Map, Flame, Bot } from 'lucide-react';
import { reposApi, filesApi, getApiError } from '../lib/api';
import { useToast } from '../contexts/ToastContext';

interface RepoDetail {
  id: string;
  github_owner: string;
  github_repo: string;
  github_url: string;
  branch: string;
  description?: string;
  language?: string;
  stars: number;
  forks: number;
  status: string;
  total_files: number;
  public_files_count: number;
  private_files_count: number;
  listed_files_count: number;
  owner_id?: string;
}

interface RepoFile {
  id: string;
  path: string;
  filename: string;
  language: string;
  size_bytes: number;
  visibility: string;
  is_listed: boolean;
  summary?: string;
  download_count: number;
  view_count: number;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export default function RepoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [repo, setRepo] = useState<RepoDetail | null>(null);
  const [files, setFiles] = useState<RepoFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [visFilter, setVisFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showVisModal, setShowVisModal] = useState(false);
  const [bulkVisLoading, setBulkVisLoading] = useState(false);

  const load = async () => {
    if (!id) return;
    try {
      const [repoRes, filesRes] = await Promise.all([
        reposApi.get(id),
        filesApi.listByRepo(id),
      ]);
      setRepo(repoRes.data);
      setFiles(filesRes.data.files);
    } catch {
      toast('Failed to load repository', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const toggleSelect = (fid: string) => {
    setSelectedIds(s => {
      const n = new Set(s);
      n.has(fid) ? n.delete(fid) : n.add(fid);
      return n;
    });
  };

  const handleVisibility = async (fileId: string, vis: string) => {
    try {
      await filesApi.updateVisibility(fileId, vis);
      setFiles(f => f.map(x => x.id === fileId ? { ...x, visibility: vis } : x));
    } catch {
      toast('Failed to update visibility', 'error');
    }
  };

  const handleListing = async (fileId: string, listed: boolean) => {
    try {
      await filesApi.updateListing(fileId, listed);
      setFiles(f => f.map(x => x.id === fileId ? { ...x, is_listed: listed } : x));
    } catch {
      toast('Failed to update listing', 'error');
    }
  };

  const handleGenerateSummaries = async () => {
    if (!id) return;
    try {
      await reposApi.generateSummaries(id);
      toast('AI summary generation started!', 'success');
    } catch (e: any) {
      toast(getApiError(e, 'Failed'), 'error');
    }
  };

  const handleBulkVisibility = async (visibility: 'public' | 'private', listFiles: boolean) => {
    if (!id) return;
    setBulkVisLoading(true);
    try {
      const res = await reposApi.bulkVisibility(id, visibility, listFiles);
      toast(res.data.message, 'success');
      setShowVisModal(false);
      // Update local file states and repo counts
      setFiles(f => f.map(x => ({
        ...x,
        visibility,
        is_listed: visibility === 'public' ? (listFiles ? true : x.is_listed) : false,
      })));
      setRepo(r => r ? {
        ...r,
        public_files_count: res.data.public_files_count,
        private_files_count: res.data.private_files_count,
        listed_files_count: res.data.listed_files_count,
      } : r);
    } catch (e: any) {
      toast(getApiError(e, 'Failed to update visibility'), 'error');
    } finally {
      setBulkVisLoading(false);
    }
  };

  const filtered = files.filter(f => {
    const matchSearch = !search || f.path.toLowerCase().includes(search.toLowerCase());
    const matchVis = !visFilter || f.visibility === visFilter;
    return matchSearch && matchVis;
  });

  if (loading) {
    return <div className="page"><div className="skeleton" style={{ height: '200px', marginBottom: '24px' }} /><div className="skeleton" style={{ height: '400px' }} /></div>;
  }

  if (!repo) return <div className="page"><p>Repository not found.</p></div>;

  return (
    <div className="page">
      {/* Back */}
      <Link to="/repos" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--silver-500)', fontSize: '13px', marginBottom: '24px' }}>
        <ArrowLeft size={14} /> All Repositories
      </Link>

      {/* Repo header */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <GitBranch size={20} style={{ color: 'var(--silver-500)' }} />
              <h1 style={{ fontSize: '20px', fontFamily: 'var(--font-mono)' }}>
                <a href={repo.github_url} target="_blank" rel="noreferrer" style={{ color: 'var(--silver-50)' }}>
                  {repo.github_owner}/{repo.github_repo}
                </a>
              </h1>
              <span className="badge badge-silver">{repo.branch}</span>
              <span className={`badge ${repo.status === 'ready' ? 'badge-success' : repo.status === 'error' ? 'badge-error' : 'badge-warning'}`}>
                {repo.status}
              </span>
            </div>
            {repo.description && (
              <p style={{ color: 'var(--silver-500)', fontSize: '14px', marginBottom: '12px' }}>{repo.description}</p>
            )}
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', color: 'var(--silver-600)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Star size={12} /> {repo.stars}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--silver-600)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <GitFork size={12} /> {repo.forks}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--silver-600)' }}>{repo.total_files} total files</span>
              <span style={{ fontSize: '13px', color: 'var(--success)' }}>{repo.public_files_count} public</span>
              <span style={{ fontSize: '13px', color: 'var(--silver-500)' }}>{repo.private_files_count} private</span>
              <span style={{ fontSize: '13px', color: 'var(--info)' }}>{repo.listed_files_count} listed</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={() => setShowVisModal(true)} className="btn btn-secondary btn-sm" id="bulk-visibility-btn">
              <Globe size={13} /> Make All Public
            </button>
            <button onClick={handleGenerateSummaries} className="btn btn-ghost btn-sm">
              <Wand2 size={13} /> AI Summaries
            </button>
            <button onClick={() => { reposApi.sync(id!); toast('Sync started', 'info'); load(); }} className="btn btn-ghost btn-sm">
              <RefreshCw size={13} /> Sync
            </button>
            <Link to={`/issues?repo_id=${id}`} className="btn btn-secondary btn-sm">
              View Issues
            </Link>
            <Link
              to={`/repos/${id}/map`}
              className="btn btn-sm"
              style={{
                background: 'linear-gradient(135deg, rgba(34,211,238,0.15), rgba(0,255,157,0.15))',
                border: '1px solid rgba(34,211,238,0.3)',
                color: 'var(--acc)',
              }}
            >
              <Map size={13} /> Repo Map
            </Link>
            <Link
              to={`/repos/${id}/devops`}
              className="btn btn-sm"
              id="devops-expert-btn"
              style={{
                background: 'linear-gradient(135deg, rgba(96,165,250,0.15), rgba(167,139,250,0.15))',
                border: '1px solid rgba(96,165,250,0.3)',
                color: '#93bbfc',
              }}
            >
              <Server size={13} /> DevOps Expert
            </Link>
            <Link
              to={`/repos/${id}/interview`}
              className="btn btn-sm"
              id="grill-me-btn"
              style={{
                background: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(249,115,22,0.15))',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#fca5a5',
              }}
            >
              <Flame size={13} /> Grill Me!
            </Link>
            <Link
              to={`/repos/${id}/ask`}
              className="btn btn-sm"
              id="ask-codebase-btn"
              style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(52,211,153,0.15))',
                border: '1px solid rgba(16,185,129,0.3)',
                color: '#6ee7b7',
              }}
            >
              <Bot size={13} /> Ask Codebase
            </Link>
          </div>
        </div>
      </div>

      {/* File list */}
      <div className="card">
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileCode size={16} style={{ color: 'var(--silver-500)' }} /> Files
            <span style={{ fontSize: '13px', color: 'var(--silver-600)', fontWeight: 400 }}>({filtered.length})</span>
          </h3>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--silver-600)' }} />
              <input
                className="form-input"
                style={{ paddingLeft: '32px', width: '200px' }}
                placeholder="Search files…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select className="form-select" style={{ width: '130px' }} value={visFilter} onChange={e => setVisFilter(e.target.value)}>
              <option value="">All visibility</option>
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <FileCode />
            <h3>No files</h3>
            <p>Files will appear here once the import is complete</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {filtered.map(file => (
              <div
                key={file.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: `1px solid ${selectedIds.has(file.id) ? 'var(--border-bright)' : 'transparent'}`,
                  background: selectedIds.has(file.id) ? 'var(--bg-elevated)' : 'transparent',
                  transition: 'background var(--transition)',
                }}
                onMouseEnter={e => { if (!selectedIds.has(file.id)) (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; }}
                onMouseLeave={e => { if (!selectedIds.has(file.id)) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(file.id)}
                  onChange={() => toggleSelect(file.id)}
                  style={{ accentColor: 'var(--silver-400)', flexShrink: 0 }}
                />

                <Link to={`/files/${file.id}`} style={{ flex: 1, minWidth: 0, textDecoration: 'none' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--silver-100)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.path}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--silver-600)', marginTop: '2px', display: 'flex', gap: '12px' }}>
                    <span>{file.language}</span>
                    <span>{formatSize(file.size_bytes)}</span>
                    <span>{file.view_count} views</span>
                  </div>
                </Link>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  {/* Visibility toggle */}
                  <button
                    onClick={() => handleVisibility(file.id, file.visibility === 'public' ? 'private' : 'public')}
                    title={`Make ${file.visibility === 'public' ? 'private' : 'public'}`}
                    style={{
                      background: 'none', border: '1px solid var(--border)', borderRadius: '6px',
                      padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                      fontSize: '11px', fontWeight: 500,
                      color: file.visibility === 'public' ? 'var(--success)' : 'var(--silver-500)',
                      transition: 'all var(--transition)',
                    }}
                  >
                    {file.visibility === 'public' ? <Eye size={11} /> : <EyeOff size={11} />}
                    {file.visibility}
                  </button>

                  {/* Listed toggle */}
                  {file.visibility === 'public' && (
                    <button
                      onClick={() => handleListing(file.id, !file.is_listed)}
                      title={file.is_listed ? 'Remove from explore' : 'Add to explore'}
                      style={{
                        background: 'none', border: '1px solid var(--border)', borderRadius: '6px',
                        padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                        fontSize: '11px', fontWeight: 500,
                        color: file.is_listed ? 'var(--info)' : 'var(--silver-600)',
                        transition: 'all var(--transition)',
                      }}
                    >
                      {file.is_listed ? <List size={11} /> : <ListX size={11} />}
                      {file.is_listed ? 'listed' : 'unlisted'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Bulk Visibility Modal ──────────────────────────────────────── */}
      {showVisModal && (
        <div className="modal-overlay" onClick={() => !bulkVisLoading && setShowVisModal(false)}>
          <div className="modal" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Set Repository Visibility</h2>
              <button className="modal-close" onClick={() => setShowVisModal(false)} disabled={bulkVisLoading}>✕</button>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--silver-400)', marginBottom: '24px', lineHeight: 1.7 }}>
              This will update <strong>all {repo?.total_files} files</strong> in this repository at once.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {/* Make Public */}
              <button
                id="make-all-public-btn"
                onClick={() => handleBulkVisibility('public', false)}
                disabled={bulkVisLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '16px 18px', borderRadius: '10px', cursor: 'pointer',
                  background: 'var(--success-dim)', border: '1px solid rgba(74,222,128,0.3)',
                  color: 'var(--silver-100)', fontFamily: 'var(--font-sans)', textAlign: 'left',
                  opacity: bulkVisLoading ? 0.5 : 1,
                }}
              >
                <Eye size={20} style={{ color: 'var(--success)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>Make All Public</div>
                  <div style={{ fontSize: '12px', color: 'var(--silver-500)' }}>File content becomes readable by anyone with the link</div>
                </div>
              </button>

              {/* Make Public + Listed */}
              <button
                id="make-all-public-listed-btn"
                onClick={() => handleBulkVisibility('public', true)}
                disabled={bulkVisLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '16px 18px', borderRadius: '10px', cursor: 'pointer',
                  background: 'rgba(99,179,237,0.1)', border: '1px solid rgba(99,179,237,0.3)',
                  color: 'var(--silver-100)', fontFamily: 'var(--font-sans)', textAlign: 'left',
                  opacity: bulkVisLoading ? 0.5 : 1,
                }}
              >
                <List size={20} style={{ color: 'var(--info)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>Make All Public + Listed</div>
                  <div style={{ fontSize: '12px', color: 'var(--silver-500)' }}>Public and discoverable on the Explore page</div>
                </div>
              </button>

              {/* Make Private */}
              <button
                id="make-all-private-btn"
                onClick={() => handleBulkVisibility('private', false)}
                disabled={bulkVisLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '16px 18px', borderRadius: '10px', cursor: 'pointer',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  color: 'var(--silver-100)', fontFamily: 'var(--font-sans)', textAlign: 'left',
                  opacity: bulkVisLoading ? 0.5 : 1,
                }}
              >
                <Lock size={20} style={{ color: 'var(--silver-500)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>Make All Private</div>
                  <div style={{ fontSize: '12px', color: 'var(--silver-500)' }}>Only you can view file content</div>
                </div>
              </button>
            </div>
            {bulkVisLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--silver-500)', fontSize: '13px' }}>
                <div className="spinner" style={{ width: '14px', height: '14px' }} />
                Updating all files…
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
