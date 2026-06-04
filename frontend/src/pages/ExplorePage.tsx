import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Compass, Search, Download, FileCode } from 'lucide-react';
import { filesApi } from '../lib/api';
import { useToast } from '../contexts/ToastContext';

interface ExploreFile {
  id: string;
  repo_id: string;
  repo_name: string;
  owner_username: string;
  path: string;
  filename: string;
  language: string;
  size_bytes: number;
  summary?: string;
  download_count: number;
}

const LANGUAGES = ['', 'Python', 'JavaScript', 'TypeScript', 'Java', 'Go', 'Rust', 'C++', 'C', 'Ruby'];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

const langDot: Record<string, string> = {
  Python: '#3572A5', JavaScript: '#f1e05a', TypeScript: '#2b7489',
  Java: '#b07219', Go: '#00ADD8', Rust: '#dea584', 'C++': '#f34b7d',
};

export default function ExplorePage() {
  const { toast } = useToast();
  const [files, setFiles] = useState<ExploreFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lang, setLang] = useState('');
  const [page, setPage] = useState(0);

  const load = (s = search, l = lang, p = page) => {
    setLoading(true);
    const params: Record<string, unknown> = { skip: p * 20, limit: 20 };
    if (s) params.search = s;
    if (l) params.language = l;
    filesApi.explore(params)
      .then(r => setFiles(r.data))
      .catch(() => toast('Failed to load files', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [lang]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(search, lang, 0);
    setPage(0);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Explore</h1>
          <p>Browse publicly listed files from the community</p>
        </div>
      </div>

      {/* Search + filter */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--silver-600)' }} />
          <input
            className="form-input"
            style={{ paddingLeft: '36px' }}
            placeholder="Search filenames…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="form-select" style={{ width: '150px' }} value={lang} onChange={e => { setLang(e.target.value); setPage(0); }}>
          {LANGUAGES.map(l => <option key={l} value={l}>{l || 'All languages'}</option>)}
        </select>
        <button type="submit" className="btn btn-secondary">
          <Search size={14} /> Search
        </button>
      </form>

      {/* Language chips */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '28px', flexWrap: 'wrap' }}>
        {LANGUAGES.filter(l => l).map(l => (
          <button
            key={l}
            onClick={() => { setLang(l === lang ? '' : l); setPage(0); }}
            style={{
              padding: '5px 14px', borderRadius: '999px', border: '1px solid',
              fontSize: '12px', fontWeight: 500, cursor: 'pointer', background: 'none',
              fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: '6px',
              borderColor: lang === l ? 'var(--silver-400)' : 'var(--border)',
              color: lang === l ? 'var(--silver-100)' : 'var(--silver-500)',
              transition: 'all var(--transition)',
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: langDot[l] || 'var(--silver-600)', display: 'inline-block' }} />
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid-2">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: '160px' }} />)}
        </div>
      ) : files.length === 0 ? (
        <div className="empty-state">
          <Compass />
          <h3>No files found</h3>
          <p>Try a different search or language filter</p>
        </div>
      ) : (
        <div className="grid-2">
          {files.map(file => (
            <Link key={file.id} to={`/files/${file.id}`} style={{ textDecoration: 'none' }}>
              <div
                className="card"
                style={{ height: '100%', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-bright)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                  <div style={{
                    width: '36px', height: '36px', flexShrink: 0,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <FileCode size={16} style={{ color: 'var(--silver-500)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600, color: 'var(--silver-100)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.filename}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--silver-600)', marginTop: '2px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{file.repo_name}</span>
                      <span>by {file.owner_username}</span>
                    </div>
                  </div>
                </div>

                {file.summary && (
                  <p style={{ fontSize: '13px', color: 'var(--silver-500)', lineHeight: 1.5, marginBottom: '12px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {file.summary}
                  </p>
                )}

                <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--silver-600)', flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: langDot[file.language] || 'var(--silver-600)', display: 'inline-block' }} />
                    {file.language}
                  </span>
                  <span>{formatSize(file.size_bytes)}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Download size={10} /> {file.download_count}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {files.length === 20 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '32px' }}>
          <button
            onClick={() => { const p = Math.max(0, page - 1); setPage(p); load(search, lang, p); }}
            disabled={page === 0}
            className="btn btn-ghost"
          >
            Previous
          </button>
          <span style={{ alignSelf: 'center', color: 'var(--silver-500)', fontSize: '13px' }}>Page {page + 1}</span>
          <button
            onClick={() => { const p = page + 1; setPage(p); load(search, lang, p); }}
            className="btn btn-ghost"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
