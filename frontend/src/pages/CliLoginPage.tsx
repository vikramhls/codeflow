import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Terminal, CheckCircle, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CliLoginPage() {
  const { user } = useAuth();
  const token = localStorage.getItem('access_token');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const authorizeCli = async () => {
    if (!token) return;
    setStatus('loading');
    try {
      const res = await fetch('http://localhost:3456/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });
      
      if (res.ok) {
        setStatus('success');
      } else {
        setStatus('error');
      }
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  };

  if (!user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
        <Terminal size={48} style={{ color: 'var(--silver-500)', marginBottom: '24px' }} />
        <h1 style={{ color: 'var(--silver-100)', marginBottom: '16px' }}>CLI Authentication</h1>
        <p style={{ color: 'var(--silver-400)', marginBottom: '24px' }}>You need to be logged into CodeSki to authorize the CLI.</p>
        <Link to="/" className="btn btn-primary">Go to Login</Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
      <div style={{ 
        background: 'var(--bg-elevated)', 
        padding: '40px', 
        borderRadius: '16px', 
        border: '1px solid var(--border)',
        maxWidth: '400px',
        width: '100%',
        textAlign: 'center'
      }}>
        {status === 'success' ? (
          <>
            <CheckCircle size={48} style={{ color: 'var(--success)', margin: '0 auto 24px' }} />
            <h2 style={{ color: 'var(--silver-100)', marginBottom: '16px', fontSize: '24px' }}>Successfully Authorized!</h2>
            <p style={{ color: 'var(--silver-400)', lineHeight: '1.6' }}>
              You can now safely close this tab and return to your terminal. The CodeSki CLI is ready to use.
            </p>
          </>
        ) : (
          <>
            <Terminal size={48} style={{ color: 'var(--acc)', margin: '0 auto 24px' }} />
            <h2 style={{ color: 'var(--silver-100)', marginBottom: '16px', fontSize: '24px' }}>Authorize CLI</h2>
            <p style={{ color: 'var(--silver-400)', marginBottom: '32px', lineHeight: '1.6' }}>
              The CodeSki CLI is requesting access to your account as <strong>{user.username}</strong>. 
            </p>
            
            {status === 'error' && (
              <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', padding: '12px', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px' }}>
                <AlertTriangle size={16} />
                Failed to connect to the CLI. Is it still running?
              </div>
            )}
            
            <button 
              onClick={authorizeCli} 
              disabled={status === 'loading'}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '14px' }}
            >
              {status === 'loading' ? 'Authorizing...' : 'Authorize CLI'}
            </button>
            <button 
              onClick={() => window.close()} 
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'center', marginTop: '12px' }}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
