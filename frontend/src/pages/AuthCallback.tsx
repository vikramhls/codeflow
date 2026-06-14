import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

// This page handles the OAuth callback redirect from the backend
// Backend redirects to: /auth/callback?access_token=...&refresh_token=...&user=...
// OR backend returns JSON directly — depends on your backend config.
// If the backend does a redirect with query params, we handle it here.
export default function AuthCallback() {
  const [params] = useSearchParams();
  const { setTokens } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const access = params.get('access_token');
    const refresh = params.get('refresh_token');
    const userStr = params.get('user');

    if (access && refresh && userStr) {
      try {
        const user = JSON.parse(decodeURIComponent(userStr));
        setTokens(access, refresh, user);
        navigate('/dashboard', { replace: true });
      } catch {
        toast('Authentication failed. Please try again.', 'error');
        navigate('/', { replace: true });
      }
    } else {
      toast('Authentication failed. Please try again.', 'error');
      navigate('/', { replace: true });
    }
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '16px', background: 'var(--bg-base)' }}>
      <div className="spinner" style={{ width: '36px', height: '36px' }} />
      <p style={{ color: 'var(--silver-400)' }}>Completing sign in…</p>
    </div>
  );
}
