import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Award, GitBranch, ShieldCheck, Clock, FileCode } from 'lucide-react';
import { usersApi } from '../lib/api';
import { useToast } from '../contexts/ToastContext';

interface UserProfile {
  id: string;
  username: string;
  avatar_url: string;
  bio: string | null;
  github_url: string;
  points: number;
  repos_imported: number;
  solutions_accepted: number;
  created_at: string;
}

interface UserSolution {
  id: string;
  issue_id: string;
  issue_title: string;
  repo_name: string;
  description: string;
  points_awarded: number;
  github_pr_url: string | null;
  created_at: string;
}

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [solutions, setSolutions] = useState<UserSolution[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      try {
        if (!id) return;
        const [profileRes, solutionsRes] = await Promise.all([
          usersApi.profile(id),
          usersApi.solutions(id)
        ]);
        setProfile(profileRes.data);
        setSolutions(solutionsRes.data);
      } catch (e: any) {
        toast('Failed to load profile', 'error');
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [id, toast]);

  if (loading) return (
    <div className="page" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="skeleton" style={{ height: '200px', marginBottom: '32px' }} />
      <div className="skeleton" style={{ height: '400px' }} />
    </div>
  );

  if (!profile) return (
    <div className="page" style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center', paddingTop: '64px' }}>
      <h2>User not found</h2>
      <p style={{ color: 'var(--silver-400)' }}>This profile does not exist or has been removed.</p>
    </div>
  );

  return (
    <div className="page" style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '64px' }}>
      {/* ── Profile Header ─────────────────────────────────────────────── */}
      <div className="card" style={{ display: 'flex', gap: '24px', alignItems: 'center', marginBottom: '32px' }}>
        <img src={profile.avatar_url} alt={profile.username} style={{ width: '100px', height: '100px', borderRadius: '50%', border: '4px solid var(--border)' }} />
        
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: '28px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            {profile.username}
            {profile.solutions_accepted > 0 && (
              <span className="badge badge-success" style={{ fontSize: '12px' }}>
                <ShieldCheck size={14} /> Verified Solver
              </span>
            )}
          </h1>
          
          <a href={profile.github_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--silver-400)', fontSize: '14px', marginBottom: '16px', textDecoration: 'none' }}>
            <GitBranch size={14} /> View on GitHub
          </a>
          
          <div style={{ display: 'flex', gap: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Award size={20} /> {profile.points}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--silver-500)', textTransform: 'uppercase', letterSpacing: '1px' }}>Reputation</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={20} /> {profile.solutions_accepted}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--silver-500)', textTransform: 'uppercase', letterSpacing: '1px' }}>Fixes Accepted</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Portfolio Section ────────────────────────────────────────── */}
      <h2 style={{ fontSize: '20px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <FileCode size={20} /> Developer Portfolio
      </h2>
      <p style={{ color: 'var(--silver-400)', marginBottom: '24px', fontSize: '14px' }}>
        A verified history of bugs fixed and issues resolved by {profile.username}.
      </p>

      {solutions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--silver-500)' }}>
          <ShieldCheck size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
          <h3>No verified fixes yet</h3>
          <p style={{ fontSize: '14px' }}>This user hasn't had any solutions accepted yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {solutions.map(sol => (
            <div key={sol.id} className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ margin: '0 0 6px', fontSize: '16px' }}>
                    <Link to={`/issues/${sol.issue_id}`} style={{ color: 'var(--text)', textDecoration: 'none' }}>
                      {sol.issue_title}
                    </Link>
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: 'var(--silver-500)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <GitBranch size={13} /> {sol.repo_name}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={13} /> {new Date(sol.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {sol.points_awarded > 0 && (
                    <span className="badge badge-warning">
                      +{sol.points_awarded} pts
                    </span>
                  )}
                  {sol.github_pr_url && (
                    <a href={sol.github_pr_url} target="_blank" rel="noreferrer" className="badge badge-primary" style={{ textDecoration: 'none' }}>
                      Merged to GitHub
                    </a>
                  )}
                </div>
              </div>
              
              <div style={{ background: 'var(--bg-base)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--silver-300)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {sol.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
