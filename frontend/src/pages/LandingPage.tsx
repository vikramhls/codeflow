import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Code2, GitBranch, Bug, Lightbulb, Trophy, Shield, Zap, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// GitHub SVG icon
const GithubIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);



const features = [
  { icon: GitBranch, title: 'Import Repos', desc: 'Import any GitHub repository and manage file visibility with fine-grained control.' },
  { icon: Bug, title: 'Create Issues', desc: 'Report bugs with priority levels, bounty points, and detailed descriptions.' },
  { icon: Lightbulb, title: 'Submit Solutions', desc: 'Fix issues, attach code patches, and earn points for accepted solutions.' },
  { icon: Trophy, title: 'Earn Bounties', desc: 'Climb the leaderboard by solving issues and collecting bounty rewards.' },
  { icon: Shield, title: 'AI Summaries', desc: 'Get AI-powered summaries for your code files automatically.' },
  { icon: Zap, title: 'Real-time Status', desc: 'Track import progress, solution reviews, and point history live.' },
];

export default function LandingPage() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate('/dashboard');
  }, [user, loading]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
      {/* Noise texture overlay */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(160,160,160,0.06) 0%, transparent 70%)',
      }} />

      {/* Header */}
      <header style={{
        position: 'relative', zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 48px',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(8,8,8,0.8)',
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-bright)',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Code2 size={20} style={{ color: 'var(--silver-200)' }} />
          </div>
          <span style={{ fontWeight: 800, fontSize: '18px', color: 'var(--silver-50)', letterSpacing: '-0.02em' }}>
            CodeFlow
          </span>
        </div>
        <button onClick={login} className="btn btn-secondary btn-sm">
          <GithubIcon size={14} /> Sign in with GitHub
        </button>
      </header>

      {/* Hero */}
      <main style={{ flex: 1, position: 'relative', zIndex: 10 }}>
        <section style={{ textAlign: 'center', padding: '100px 24px 80px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '6px 14px', borderRadius: '999px',
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            fontSize: '12px', color: 'var(--silver-400)', marginBottom: '32px',
            fontWeight: 500, letterSpacing: '0.04em'
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)' }} />
            Collaborative Code Review &amp; Bug Bounty Platform
          </div>

          <h1 style={{ fontSize: 'clamp(40px, 6vw, 80px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.05, marginBottom: '24px' }}>
            Fix Bugs.{' '}
            <span className="gradient-text">Earn Bounties.</span>
            <br />Build Together.
          </h1>

          <p style={{ fontSize: '18px', color: 'var(--silver-500)', maxWidth: '600px', margin: '0 auto 48px', lineHeight: 1.7 }}>
            Import GitHub repos, list files for community review, create issues with bounty points, and reward developers who fix your code.
          </p>

          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={login} className="btn btn-primary btn-lg" style={{ gap: '10px' }}>
              <GithubIcon size={18} /> Continue with GitHub <ArrowRight size={16} />
            </button>
            <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer" className="btn btn-secondary btn-lg">
              View API Docs
            </a>
          </div>
        </section>

        {/* Stats bar */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: '0',
          borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)', padding: '0 48px', flexWrap: 'wrap'
        }}>
          {[
            { label: 'Developers', value: '500+' },
            { label: 'Issues Resolved', value: '2.4K+' },
            { label: 'Repos Indexed', value: '1.2K+' },
            { label: 'Bounties Paid', value: '$12K+' },
          ].map((s, i) => (
            <div key={i} style={{
              padding: '28px 48px', textAlign: 'center',
              borderRight: i < 3 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--silver-50)', letterSpacing: '-0.03em' }}>{s.value}</div>
              <div style={{ fontSize: '13px', color: 'var(--silver-600)', marginTop: '4px', fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Features */}
        <section style={{ padding: '80px 48px', maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: '32px', marginBottom: '12px' }}>
            Everything you need
          </h2>
          <p style={{ textAlign: 'center', color: 'var(--silver-500)', marginBottom: '56px', fontSize: '16px' }}>
            A complete workflow for collaborative code review and bug fixing
          </p>
          <div className="grid-3" style={{ gap: '16px' }}>
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="card" style={{ padding: '28px' }}>
                <div style={{
                  width: '40px', height: '40px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '16px',
                }}>
                  <Icon size={18} style={{ color: 'var(--silver-400)' }} />
                </div>
                <h3 style={{ fontSize: '16px', marginBottom: '8px', color: 'var(--silver-100)' }}>{title}</h3>
                <p style={{ fontSize: '14px', color: 'var(--silver-500)', lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{
          textAlign: 'center', padding: '80px 24px',
          background: 'linear-gradient(to bottom, transparent, var(--bg-surface))',
        }}>
          <h2 style={{ fontSize: '36px', marginBottom: '16px' }}>Ready to start?</h2>
          <p style={{ color: 'var(--silver-500)', marginBottom: '40px', fontSize: '16px' }}>
            Connect your GitHub account and start in minutes
          </p>
          <button onClick={login} className="btn btn-primary btn-lg">
            <GithubIcon size={18} /> Get Started Free
          </button>
        </section>
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '24px 48px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        color: 'var(--silver-600)', fontSize: '13px',
        position: 'relative', zIndex: 10,
      }}>
        <span>© 2026 CodeFlow. Built for developers.</span>
        <span>FastAPI + MongoDB + Redis</span>
      </footer>
    </div>
  );
}
