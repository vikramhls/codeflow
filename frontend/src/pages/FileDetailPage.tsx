import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Eye, EyeOff, List, ListX, Download, Bug, FileCode,
  Copy, CheckCheck, Wand2, Loader2
} from 'lucide-react';
import { filesApi } from '../lib/api';
import { useToast } from '../contexts/ToastContext';

interface FileDetail {
  id: string;
  repo_id: string;
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

export default function FileDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [file, setFile] = useState<FileDetail | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'code' | 'summary'>('code');

  useEffect(() => {
    if (!id) return;
    filesApi.get(id)
      .then(r => {
        setFile(r.data);
        // Load content
        setContentLoading(true);
        return filesApi.content(id);
      })
      .then(r => setContent(r.data.content))
      .catch(() => { /* private file — no content */ })
      .finally(() => {
        setLoading(false);
        setContentLoading(false);
      });
  }, [id]);

  const handleCopy = () => {
    if (content) {
      navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = async () => {
    if (!id) return;
    try {
      const r = await filesApi.download(id);
      const blob = new Blob([r.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file?.filename || 'file';
      a.click();
    } catch {
      toast('Cannot download private file', 'error');
    }
  };

  const handleVisibility = async () => {
    if (!file) return;
    const newVis = file.visibility === 'public' ? 'private' : 'public';
    try {
      await filesApi.updateVisibility(file.id, newVis);
      setFile(f => f ? { ...f, visibility: newVis } : f);
      toast(`File is now ${newVis}`, 'success');
    } catch {
      toast('Failed to update visibility', 'error');
    }
  };

  const handleListing = async () => {
    if (!file) return;
    try {
      await filesApi.updateListing(file.id, !file.is_listed);
      setFile(f => f ? { ...f, is_listed: !f.is_listed } : f);
      toast(`File ${!file.is_listed ? 'added to' : 'removed from'} explore`, 'success');
    } catch {
      toast('Failed to update listing', 'error');
    }
  };

  if (loading) return <div className="page"><div className="skeleton" style={{ height: '100px', marginBottom: '24px' }} /><div className="skeleton" style={{ height: '500px' }} /></div>;
  if (!file) return <div className="page"><p>File not found.</p></div>;

  return (
    <div className="page">
      {/* Back */}
      <Link
        to={`/repos/${file.repo_id}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--silver-500)', fontSize: '13px', marginBottom: '24px' }}
      >
        <ArrowLeft size={14} /> Back to Repository
      </Link>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <FileCode size={18} style={{ color: 'var(--silver-500)' }} />
            <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', wordBreak: 'break-all' }}>{file.path}</h1>
          </div>
          <div style={{ display: 'flex', gap: '16px', color: 'var(--silver-600)', fontSize: '13px', flexWrap: 'wrap' }}>
            <span>{file.language}</span>
            <span>{formatSize(file.size_bytes)}</span>
            <span>{file.view_count} views</span>
            <span>{file.download_count} downloads</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={handleVisibility} className={`btn btn-ghost btn-sm`}>
            {file.visibility === 'public' ? <Eye size={13} /> : <EyeOff size={13} />}
            {file.visibility}
          </button>
          {file.visibility === 'public' && (
            <button onClick={handleListing} className="btn btn-ghost btn-sm">
              {file.is_listed ? <List size={13} /> : <ListX size={13} />}
              {file.is_listed ? 'listed' : 'unlisted'}
            </button>
          )}
          <button onClick={handleDownload} className="btn btn-ghost btn-sm">
            <Download size={13} /> Download
          </button>
          <Link to={`/issues?file_id=${file.id}&repo_id=${file.repo_id}`} className="btn btn-secondary btn-sm">
            <Bug size={13} /> Issues
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'code' ? 'active' : ''}`} onClick={() => setTab('code')}>
          <FileCode size={13} style={{ display: 'inline', marginRight: '6px' }} /> Code
        </button>
        <button className={`tab ${tab === 'summary' ? 'active' : ''}`} onClick={() => setTab('summary')}>
          <Wand2 size={13} style={{ display: 'inline', marginRight: '6px' }} /> AI Summary
        </button>
      </div>

      {tab === 'code' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Code toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderBottom: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
          }}>
            <span style={{ fontSize: '12px', color: 'var(--silver-600)', fontFamily: 'var(--font-mono)' }}>
              {file.filename}
            </span>
            <button onClick={handleCopy} className="btn btn-ghost btn-sm" disabled={!content}>
              {copied ? <><CheckCheck size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
            </button>
          </div>

          {contentLoading ? (
            <div style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--silver-600)' }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              Loading content…
            </div>
          ) : content ? (
            <pre style={{
              padding: '20px',
              overflowX: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              lineHeight: 1.7,
              color: 'var(--silver-300)',
              background: 'var(--bg-base)',
              margin: 0,
              maxHeight: '600px',
              overflowY: 'auto',
            }}>
              <code>{content}</code>
            </pre>
          ) : (
            <div style={{ padding: '48px', textAlign: 'center' }}>
              <EyeOff size={32} style={{ color: 'var(--silver-700)', margin: '0 auto 16px', display: 'block' }} />
              <p style={{ color: 'var(--silver-500)' }}>
                {file.visibility === 'private'
                  ? 'This file is private. Only the owner can view its content.'
                  : 'Content not available.'}
              </p>
            </div>
          )}
        </div>
      )}

      {tab === 'summary' && (
        <div className="card">
          {file.summary ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Wand2 size={16} style={{ color: 'var(--silver-500)' }} />
                <h3 style={{ fontSize: '15px' }}>AI-Generated Summary</h3>
              </div>
              <p style={{ color: 'var(--silver-300)', lineHeight: 1.8, fontSize: '14px' }}>{file.summary}</p>
            </>
          ) : (
            <div className="empty-state">
              <Wand2 />
              <h3>No summary yet</h3>
              <p>Go to the repository page and click "AI Summaries" to generate one.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
