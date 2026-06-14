import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Server, Shield, Database, Zap, DollarSign,
  AlertTriangle, TrendingUp, GitBranch, RefreshCw, Cpu,
  HardDrive, Network, Layers, Workflow, Lock, Cloud,
  Activity, BarChart3, ChevronRight, Box
} from 'lucide-react';
import { devopsApi, reposApi, getApiError } from '../lib/api';
import { useToast } from '../contexts/ToastContext';

// ─── Types ───────────────────────────────────────────────────────────

interface ServerInfo {
  count: number;
  type: string;
  specs: string;
  purpose: string;
}

interface DevOpsReport {
  architecture_type: string;
  architecture_reasoning: string;
  servers: Record<string, ServerInfo>;
  load_balancer: {
    needed: boolean;
    type: string;
    reason: string;
  };
  database: {
    engine: string;
    type: string;
    storage_gb: number;
    replicas: number;
    backup_strategy: string;
    connection_pool: number;
  };
  caching: {
    needed: boolean;
    service: string;
    type: string;
    use_cases: string[];
  };
  estimated_monthly_cost: {
    low_traffic: { amount: string; users: string };
    medium_traffic: { amount: string; users: string };
    high_traffic: { amount: string; users: string };
  };
  bottlenecks: Array<{
    component: string;
    trigger: string;
    severity: string;
    mitigation: string;
  }>;
  scaling_recommendations: string[];
  ci_cd_suggestions: string[];
  security_notes?: string[];
  summary: string;
  _meta?: {
    generated_by: string;
    model: string | null;
    detected_stack: { frameworks: string[]; databases: string[]; infrastructure: string[] };
    languages: Record<string, number>;
    file_count: number;
    total_size_bytes: number;
    route_count: number;
    generated_at: string;
  };
}

interface ReportResponse {
  repo_id: string;
  repo_name: string;
  status: string | null;
  report: DevOpsReport | null;
  analyzed_at: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────

const archIcons: Record<string, typeof Layers> = {
  monolith: Box,
  microservices: Layers,
  serverless: Cloud,
  hybrid: Network,
};

const archColors: Record<string, string> = {
  monolith: 'var(--info)',
  microservices: 'var(--success)',
  serverless: 'var(--warning)',
  hybrid: '#a78bfa',
};

const severityColors: Record<string, string> = {
  low: 'var(--success)',
  medium: 'var(--warning)',
  high: 'var(--error)',
  critical: '#ef4444',
};

const severityBg: Record<string, string> = {
  low: 'var(--success-dim)',
  medium: 'var(--warning-dim)',
  high: 'var(--error-dim)',
  critical: 'rgba(239,68,68,0.2)',
};

function SectionTitle({ icon: Icon, title, subtitle }: { icon: Icon; title: string; subtitle?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
      <div style={{
        width: '40px', height: '40px', borderRadius: '10px',
        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={18} style={{ color: 'var(--silver-400)' }} />
      </div>
      <div>
        <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--silver-50)' }}>{title}</h3>
        {subtitle && <p style={{ fontSize: '12px', color: 'var(--silver-600)', marginTop: '2px' }}>{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Architecture Diagram Component ─────────────────────────────────────

function ArchitectureDiagram({ report }: { report: DevOpsReport }) {
  return (
    <div className="card" style={{ marginBottom: '24px', overflowX: 'auto', padding: '32px' }}>
      <SectionTitle icon={Network} title="System Architecture Blueprint" subtitle="Visual deployment topology generated for your repository" />
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '30px', minWidth: '700px', padding: '20px 0', marginTop: '16px' }}>
        
        {/* 1. Users / Internet */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', zIndex: 2 }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--bg-elevated)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={24} style={{ color: 'var(--info)' }} />
          </div>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--silver-400)' }}>Internet</span>
        </div>

        {/* Arrow */}
        <div style={{ height: '2px', width: '40px', background: 'var(--border)', position: 'relative' }}>
          <div style={{ position: 'absolute', right: '-4px', top: '-4px', borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '5px solid var(--border)' }} />
        </div>

        {/* 2. Load Balancer (Conditional) */}
        {report.load_balancer.needed && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', zIndex: 2 }}>
              <div style={{ width: '70px', height: '70px', borderRadius: '12px', background: 'var(--success-dim)', border: '2px solid var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Network size={28} style={{ color: 'var(--success)' }} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--silver-200)' }}>Load Balancer</span>
              <span style={{ fontSize: '10px', color: 'var(--silver-500)', background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: '4px' }}>{report.load_balancer.type}</span>
            </div>

            {/* Arrow */}
            <div style={{ height: '2px', width: '40px', background: 'var(--border)', position: 'relative' }}>
              <div style={{ position: 'absolute', right: '-4px', top: '-4px', borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '5px solid var(--border)' }} />
            </div>
          </>
        )}

        {/* 3. App Servers Group */}
        <div style={{ padding: '16px', borderRadius: '16px', background: 'var(--bg-elevated)', border: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', zIndex: 2 }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--silver-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Application Tier</span>
          
          <div style={{ display: 'flex', gap: '16px' }}>
            {Object.entries(report.servers).map(([role, server]) => (
              <div key={role} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <div style={{ position: 'relative', marginTop: '8px', marginRight: '8px' }}>
                  {/* Stacked instances effect */}
                  {server.count > 1 && <div style={{ position: 'absolute', top: '-4px', right: '-4px', width: '60px', height: '60px', borderRadius: '10px', background: 'var(--bg-surface)', border: '1px solid var(--border)', zIndex: 0 }} />}
                  {server.count > 2 && <div style={{ position: 'absolute', top: '-8px', right: '-8px', width: '60px', height: '60px', borderRadius: '10px', background: 'var(--bg-surface)', border: '1px solid var(--border)', zIndex: -1 }} />}
                  
                  <div style={{ width: '60px', height: '60px', borderRadius: '10px', background: 'var(--bg-surface)', border: '2px solid var(--info)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
                    <Server size={24} style={{ color: 'var(--info)' }} />
                    <div style={{ position: 'absolute', bottom: '-8px', right: '-8px', background: 'var(--info)', color: '#000', fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '10px' }}>
                      x{server.count}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--silver-300)', marginTop: '8px' }}>{role}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Arrow to Data Tier */}
        <div style={{ height: '2px', width: '40px', background: 'var(--border)', position: 'relative' }}>
          <div style={{ position: 'absolute', right: '-4px', top: '-4px', borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '5px solid var(--border)' }} />
        </div>

        {/* 4. Data Tier (DB + Cache) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Database */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', zIndex: 2 }}>
             <div style={{ position: 'relative', marginTop: '6px', marginRight: '6px' }}>
                {report.database.replicas > 0 && <div style={{ position: 'absolute', top: '-6px', right: '-6px', width: '70px', height: '70px', borderRadius: '12px', background: 'var(--bg-surface)', border: '1px dashed var(--border)', zIndex: 0 }} />}
                <div style={{ width: '70px', height: '70px', borderRadius: '12px', background: 'var(--bg-surface)', border: '2px solid #a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
                  <Database size={28} style={{ color: '#a78bfa' }} />
                  {report.database.replicas > 0 && (
                    <div style={{ position: 'absolute', bottom: '-8px', right: '-8px', background: '#a78bfa', color: '#000', fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '10px', whiteSpace: 'nowrap' }}>
                      +{report.database.replicas} Rep
                    </div>
                  )}
                </div>
             </div>
             <div style={{ display: 'flex', flexDirection: 'column' }}>
               <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--silver-200)' }}>{report.database.engine}</span>
               <span style={{ fontSize: '11px', color: 'var(--silver-500)' }}>{report.database.type}</span>
             </div>
          </div>

          {/* Cache */}
          {report.caching.needed && (
             <div style={{ display: 'flex', alignItems: 'center', gap: '16px', zIndex: 2 }}>
                <div style={{ width: '70px', height: '70px', borderRadius: '12px', background: 'var(--bg-surface)', border: '2px solid var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={28} style={{ color: 'var(--warning)' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--silver-200)' }}>{report.caching.service}</span>
                  <span style={{ fontSize: '11px', color: 'var(--silver-500)' }}>Cache Layer</span>
                </div>
             </div>
          )}

        </div>

      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export default function DevOpsReportPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [polling, setPolling] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!id) return;
    try {
      const res = await devopsApi.report(id);
      setData(res.data);
      return res.data;
    } catch {
      // No report yet, that's fine
      setData({ repo_id: id, repo_name: '', status: null, report: null, analyzed_at: null });
      return null;
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // Poll while pending
  useEffect(() => {
    if (data?.status !== 'pending') {
      setPolling(false);
      return;
    }
    setPolling(true);
    const interval = setInterval(async () => {
      const result = await fetchReport();
      if (result && result.status !== 'pending') {
        setPolling(false);
        setAnalyzing(false);
        clearInterval(interval);
        if (result.status === 'done') {
          toast('DevOps analysis complete!', 'success');
        } else if (result.status === 'failed') {
          toast('Analysis failed. Try again.', 'error');
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [data?.status, fetchReport, toast]);

  const handleAnalyze = async () => {
    if (!id) return;
    setAnalyzing(true);
    try {
      await devopsApi.analyze(id);
      toast('DevOps analysis started — this may take a moment', 'info');
      setData(prev => prev ? { ...prev, status: 'pending' } : prev);
    } catch (e: any) {
      toast(getApiError(e, 'Failed to start analysis'), 'error');
      setAnalyzing(false);
    }
  };

  const report = data?.report as DevOpsReport | null;
  const isPending = data?.status === 'pending' || analyzing;

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: '60px', marginBottom: '24px' }} />
        <div className="skeleton" style={{ height: '200px', marginBottom: '20px' }} />
        <div className="grid-3">
          <div className="skeleton" style={{ height: '180px' }} />
          <div className="skeleton" style={{ height: '180px' }} />
          <div className="skeleton" style={{ height: '180px' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: '1100px' }}>
      {/* Back nav */}
      <Link to={id ? `/repos/${id}` : '/repos'} style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        color: 'var(--silver-500)', fontSize: '13px', marginBottom: '24px',
      }}>
        <ArrowLeft size={14} /> Back to Repository
      </Link>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '16px', marginBottom: '32px',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(96,165,250,0.2), rgba(167,139,250,0.2))',
              border: '1px solid rgba(96,165,250,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Server size={20} style={{ color: '#60a5fa' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.03em' }}>
                DevOps Expert
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--silver-500)', marginTop: '2px' }}>
                {data?.repo_name || 'Repository'} — Infrastructure Blueprint
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {data?.analyzed_at && (
            <span style={{ fontSize: '11px', color: 'var(--silver-600)', marginRight: '4px' }}>
              Last analyzed: {new Date(data.analyzed_at).toLocaleDateString()}
            </span>
          )}
          <button
            onClick={handleAnalyze}
            disabled={isPending}
            className={`btn ${report ? 'btn-secondary' : 'btn-primary'}`}
            id="analyze-devops-btn"
          >
            {isPending ? (
              <><div className="spinner" style={{ width: '14px', height: '14px' }} /> Analyzing…</>
            ) : report ? (
              <><RefreshCw size={14} /> Re-analyze</>
            ) : (
              <><Cpu size={14} /> Analyze Infrastructure</>
            )}
          </button>
        </div>
      </div>

      {/* ── Pending State ──────────────────────────────────────────── */}
      {isPending && !report && (
        <div className="card" style={{ textAlign: 'center', padding: '80px 32px' }}>
          <div className="spinner" style={{ width: '32px', height: '32px', margin: '0 auto 20px' }} />
          <h3 style={{ fontSize: '18px', color: 'var(--silver-200)', marginBottom: '8px' }}>
            Analyzing your repository…
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--silver-500)', maxWidth: '420px', margin: '0 auto' }}>
            Our AI is scanning your files, detecting your tech stack, and generating a deployment blueprint. This usually takes 10–30 seconds.
          </p>
        </div>
      )}

      {/* ── Empty State ────────────────────────────────────────────── */}
      {!report && !isPending && (
        <div className="card" style={{ textAlign: 'center', padding: '80px 32px' }}>
          <Server size={48} style={{ color: 'var(--silver-700)', margin: '0 auto 16px', display: 'block' }} />
          <h3 style={{ fontSize: '20px', color: 'var(--silver-300)', marginBottom: '8px' }}>
            No analysis yet
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--silver-500)', maxWidth: '460px', margin: '0 auto 24px' }}>
            Click <strong>"Analyze Infrastructure"</strong> to let our AI DevOps expert scan your codebase and generate a comprehensive deployment blueprint.
          </p>
          <button onClick={handleAnalyze} className="btn btn-primary btn-lg" id="analyze-empty-btn">
            <Cpu size={16} /> Analyze Infrastructure
          </button>
        </div>
      )}

      {/* ── Report ─────────────────────────────────────────────────── */}
      {report && !('error' in report && !report.summary) && (
        <>
          {/* Meta banner — generated by */}
          {report._meta && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
              marginBottom: '24px', padding: '12px 18px',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: '10px', fontSize: '12px', color: 'var(--silver-500)',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Activity size={12} /> Generated by: <strong style={{ color: 'var(--silver-300)' }}>{report._meta.generated_by === 'ai' ? `AI (${report._meta.model})` : 'Heuristic engine'}</strong>
              </span>
              <span>Files: <strong style={{ color: 'var(--silver-300)' }}>{report._meta.file_count}</strong></span>
              <span>Routes: <strong style={{ color: 'var(--silver-300)' }}>{report._meta.route_count}</strong></span>
              <span>Size: <strong style={{ color: 'var(--silver-300)' }}>{(report._meta.total_size_bytes / 1024).toFixed(0)} KB</strong></span>
            </div>
          )}

          {/* Executive Summary */}
          <div className="card" style={{
            marginBottom: '24px',
            background: 'linear-gradient(135deg, rgba(96,165,250,0.06), rgba(167,139,250,0.06))',
            borderColor: 'rgba(96,165,250,0.2)',
          }}>
            <p style={{ fontSize: '15px', lineHeight: 1.8, color: 'var(--silver-200)' }}>
              {report.summary}
            </p>
          </div>

          {/* ── Architecture Diagram ──────────────────────────────────── */}
          <ArchitectureDiagram report={report} />

          {/* ── Architecture + Tech Stack ────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            {/* Architecture Type */}
            <div className="card">
              <SectionTitle icon={archIcons[report.architecture_type] || Layers} title="Architecture" subtitle="Recommended pattern" />
              <div style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '16px', borderRadius: '12px',
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              }}>
                <div style={{
                  width: '50px', height: '50px', borderRadius: '12px',
                  background: `${archColors[report.architecture_type] || 'var(--info)'}20`,
                  border: `1px solid ${archColors[report.architecture_type] || 'var(--info)'}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {(() => {
                    const ArchIcon = archIcons[report.architecture_type] || Layers;
                    return <ArchIcon size={22} style={{ color: archColors[report.architecture_type] || 'var(--info)' }} />;
                  })()}
                </div>
                <div>
                  <div style={{
                    fontSize: '18px', fontWeight: 800, color: 'var(--silver-50)',
                    textTransform: 'capitalize', marginBottom: '3px',
                  }}>
                    {report.architecture_type}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--silver-500)', lineHeight: 1.5 }}>
                    {report.architecture_reasoning}
                  </div>
                </div>
              </div>
            </div>

            {/* Detected Stack */}
            {report._meta?.detected_stack && (
              <div className="card">
                <SectionTitle icon={BarChart3} title="Detected Stack" subtitle="Auto-detected from your code" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {report._meta.detected_stack.frameworks.length > 0 && (
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--silver-600)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Frameworks</div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {report._meta.detected_stack.frameworks.map(f => (
                          <span key={f} className="badge badge-info">{f}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {report._meta.detected_stack.databases.length > 0 && (
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--silver-600)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Databases</div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {report._meta.detected_stack.databases.map(d => (
                          <span key={d} className="badge badge-success">{d}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {report._meta.detected_stack.infrastructure.length > 0 && (
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--silver-600)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Infrastructure</div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {report._meta.detected_stack.infrastructure.map(i => (
                          <span key={i} className="badge badge-warning">{i}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Server Sizing ────────────────────────────────────────── */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <SectionTitle icon={Server} title="Server Sizing" subtitle="Recommended compute resources" />
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(Object.keys(report.servers).length, 3)}, 1fr)`, gap: '16px' }}>
              {Object.entries(report.servers).map(([role, server]) => (
                <div key={role} style={{
                  padding: '20px', borderRadius: '12px',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <Cpu size={14} style={{ color: 'var(--silver-500)' }} />
                    <span style={{
                      fontSize: '13px', fontWeight: 700, color: 'var(--silver-200)',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>
                      {role}
                    </span>
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--silver-50)', marginBottom: '4px' }}>
                    ×{server.count}
                  </div>
                  <div style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: '6px',
                    background: 'var(--info-dim)', fontSize: '12px', fontWeight: 600,
                    color: 'var(--info)', fontFamily: 'var(--font-mono)', marginBottom: '10px',
                  }}>
                    {server.type}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--silver-400)', marginBottom: '4px' }}>
                    {server.specs}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--silver-600)' }}>
                    {server.purpose}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Load Balancer + Database + Caching ────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            {/* Load Balancer */}
            <div className="card">
              <SectionTitle icon={Network} title="Load Balancer" />
              <div style={{
                padding: '16px', borderRadius: '10px',
                background: report.load_balancer.needed ? 'var(--success-dim)' : 'var(--bg-elevated)',
                border: `1px solid ${report.load_balancer.needed ? 'rgba(74,222,128,0.25)' : 'var(--border)'}`,
              }}>
                <div style={{
                  fontSize: '20px', fontWeight: 800, marginBottom: '6px',
                  color: report.load_balancer.needed ? 'var(--success)' : 'var(--silver-400)',
                }}>
                  {report.load_balancer.needed ? 'Required' : 'Not needed'}
                </div>
                {report.load_balancer.needed && (
                  <div style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: '5px',
                    background: 'var(--bg-base)', fontSize: '11px', fontWeight: 600,
                    color: 'var(--silver-300)', fontFamily: 'var(--font-mono)', marginBottom: '8px',
                  }}>
                    {report.load_balancer.type}
                  </div>
                )}
                <div style={{ fontSize: '12px', color: 'var(--silver-500)', lineHeight: 1.5, marginTop: '6px' }}>
                  {report.load_balancer.reason}
                </div>
              </div>
            </div>

            {/* Database */}
            <div className="card">
              <SectionTitle icon={Database} title="Database" />
              <div style={{
                padding: '16px', borderRadius: '10px',
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--silver-50)', marginBottom: '4px' }}>
                  {report.database.engine}
                </div>
                <div style={{
                  display: 'inline-block', padding: '2px 8px', borderRadius: '5px',
                  background: 'var(--info-dim)', fontSize: '11px', fontWeight: 600,
                  color: 'var(--info)', fontFamily: 'var(--font-mono)', marginBottom: '10px',
                }}>
                  {report.database.type}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--silver-400)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Storage</span>
                    <span style={{ color: 'var(--silver-200)', fontWeight: 600 }}>{report.database.storage_gb} GB</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Replicas</span>
                    <span style={{ color: 'var(--silver-200)', fontWeight: 600 }}>{report.database.replicas}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Pool size</span>
                    <span style={{ color: 'var(--silver-200)', fontWeight: 600 }}>{report.database.connection_pool}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Caching */}
            <div className="card">
              <SectionTitle icon={Zap} title="Caching" />
              <div style={{
                padding: '16px', borderRadius: '10px',
                background: report.caching.needed ? 'var(--warning-dim)' : 'var(--bg-elevated)',
                border: `1px solid ${report.caching.needed ? 'rgba(251,191,36,0.25)' : 'var(--border)'}`,
              }}>
                <div style={{
                  fontSize: '18px', fontWeight: 800, marginBottom: '4px',
                  color: report.caching.needed ? 'var(--warning)' : 'var(--silver-400)',
                }}>
                  {report.caching.needed ? report.caching.service : 'Not needed'}
                </div>
                {report.caching.needed && report.caching.type !== 'None' && (
                  <div style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: '5px',
                    background: 'var(--bg-base)', fontSize: '11px', fontWeight: 600,
                    color: 'var(--silver-300)', fontFamily: 'var(--font-mono)', marginBottom: '8px',
                  }}>
                    {report.caching.type}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                  {report.caching.use_cases.map((uc, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--silver-400)' }}>
                      <ChevronRight size={10} style={{ color: 'var(--silver-600)', flexShrink: 0 }} />
                      {uc}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Cost Estimation ───────────────────────────────────────── */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <SectionTitle icon={DollarSign} title="Estimated Monthly Cost" subtitle="Based on AWS pricing (approximate)" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              {[
                { key: 'low_traffic', label: 'Low Traffic', gradient: 'linear-gradient(135deg, rgba(74,222,128,0.08), rgba(74,222,128,0.03))', border: 'rgba(74,222,128,0.2)', color: 'var(--success)' },
                { key: 'medium_traffic', label: 'Medium Traffic', gradient: 'linear-gradient(135deg, rgba(96,165,250,0.08), rgba(96,165,250,0.03))', border: 'rgba(96,165,250,0.2)', color: 'var(--info)' },
                { key: 'high_traffic', label: 'High Traffic', gradient: 'linear-gradient(135deg, rgba(167,139,250,0.08), rgba(167,139,250,0.03))', border: 'rgba(167,139,250,0.2)', color: '#a78bfa' },
              ].map(tier => {
                const costData = report.estimated_monthly_cost[tier.key as keyof typeof report.estimated_monthly_cost];
                return (
                  <div key={tier.key} style={{
                    padding: '24px', borderRadius: '14px', textAlign: 'center',
                    background: tier.gradient, border: `1px solid ${tier.border}`,
                    position: 'relative', overflow: 'hidden',
                  }}>
                    {/* Decorative glow */}
                    <div style={{
                      position: 'absolute', top: '-30px', right: '-30px',
                      width: '80px', height: '80px', borderRadius: '50%',
                      background: `${tier.color}10`, filter: 'blur(20px)',
                    }} />
                    <div style={{ fontSize: '12px', color: 'var(--silver-500)', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {tier.label}
                    </div>
                    <div style={{ fontSize: '32px', fontWeight: 900, color: tier.color, marginBottom: '6px', letterSpacing: '-0.03em' }}>
                      {costData.amount}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--silver-500)' }}>
                      {costData.users}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Bottleneck Predictions ────────────────────────────────── */}
          {report.bottlenecks && report.bottlenecks.length > 0 && (
            <div className="card" style={{ marginBottom: '24px' }}>
              <SectionTitle icon={AlertTriangle} title="Bottleneck Predictions" subtitle="Where performance will degrade as traffic grows" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {report.bottlenecks.map((b, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: '14px',
                    padding: '16px', borderRadius: '10px',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  }}>
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%', marginTop: '6px', flexShrink: 0,
                      background: severityColors[b.severity] || 'var(--silver-500)',
                      boxShadow: `0 0 8px ${severityColors[b.severity] || 'var(--silver-500)'}60`,
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--silver-100)' }}>
                          {b.component}
                        </span>
                        <span style={{
                          padding: '1px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 600,
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                          background: severityBg[b.severity] || 'var(--bg-hover)',
                          color: severityColors[b.severity] || 'var(--silver-400)',
                        }}>
                          {b.severity}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--silver-500)', marginBottom: '6px' }}>
                        Trigger: {b.trigger}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--silver-400)', lineHeight: 1.5 }}>
                        <strong>Mitigation:</strong> {b.mitigation}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Scaling + CI/CD + Security ────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            {/* Scaling Recommendations */}
            {report.scaling_recommendations && report.scaling_recommendations.length > 0 && (
              <div className="card">
                <SectionTitle icon={TrendingUp} title="Scaling" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {report.scaling_recommendations.map((r, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '8px',
                      fontSize: '13px', color: 'var(--silver-300)', lineHeight: 1.6,
                    }}>
                      <ChevronRight size={12} style={{ color: 'var(--success)', marginTop: '4px', flexShrink: 0 }} />
                      {r}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CI/CD Suggestions */}
            {report.ci_cd_suggestions && report.ci_cd_suggestions.length > 0 && (
              <div className="card">
                <SectionTitle icon={Workflow} title="CI/CD" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {report.ci_cd_suggestions.map((s, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '8px',
                      fontSize: '13px', color: 'var(--silver-300)', lineHeight: 1.6,
                    }}>
                      <ChevronRight size={12} style={{ color: 'var(--info)', marginTop: '4px', flexShrink: 0 }} />
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Security Notes */}
            {report.security_notes && report.security_notes.length > 0 && (
              <div className="card">
                <SectionTitle icon={Shield} title="Security" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {report.security_notes.map((n, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '8px',
                      fontSize: '13px', color: 'var(--silver-300)', lineHeight: 1.6,
                    }}>
                      <Lock size={12} style={{ color: 'var(--warning)', marginTop: '4px', flexShrink: 0 }} />
                      {n}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Backup Strategy ───────────────────────────────────────── */}
          {report.database.backup_strategy && (
            <div className="card" style={{ marginBottom: '24px' }}>
              <SectionTitle icon={HardDrive} title="Backup Strategy" />
              <p style={{ fontSize: '14px', color: 'var(--silver-300)', lineHeight: 1.7 }}>
                {report.database.backup_strategy}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
