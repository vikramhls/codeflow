import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { interviewsApi } from '../lib/api';
import { ChevronLeft } from 'lucide-react';

export default function MockInterviewPage() {
  const { id } = useParams<{ id: string }>();
  const [status, setStatus] = useState<string>('pending');
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswerHint, setShowAnswerHint] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    const fetchInterview = async () => {
      if (!id) return;
      try {
        const res = await interviewsApi.get(id);
        setStatus(res.data.status);
        if (res.data.status === 'done' && res.data.questions) {
          setQuestions(res.data.questions);
        }
      } catch (err: any) {
        if (err.response?.status === 404) {
          try {
            await interviewsApi.generate(id);
          } catch (e) {
            console.error("Failed to start generation", e);
          }
        }
      }
    };

    fetchInterview();
    
    interval = setInterval(() => {
      if (status !== 'done' && status !== 'failed') {
        fetchInterview();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [id, status]);

  const handleNext = () => {
    setShowAnswerHint(false);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  return (
    <div className="page" style={{ maxWidth: '800px', margin: '0 auto' }}>
      
      <Link to={`/repos/${id}`} className="text-muted flex items-center gap-2 mb-4" style={{ textDecoration: 'none', fontSize: '14px', marginBottom: '24px' }}>
        <ChevronLeft size={16} /> Back to Repository
      </Link>
      
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>Technical Interview</h1>
        <p className="text-muted">The AI interviewer has reviewed your repository.</p>
      </div>

      {status === 'pending' && (
        <div className="card flex flex-col items-center" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div className="spinner" style={{ width: '32px', height: '32px', borderWidth: '3px', borderColor: 'var(--border-bright)', borderTopColor: 'var(--info)', marginBottom: '24px' }}></div>
          <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>Analyzing Codebase...</h2>
          <p className="text-muted">The Senior AI Engineer is preparing tough questions for you.</p>
        </div>
      )}

      {status === 'failed' && (
        <div className="card" style={{ padding: '32px', textAlign: 'center', borderColor: 'var(--error-dim)', background: 'rgba(248, 113, 113, 0.05)' }}>
          <p className="text-error">Failed to generate interview. Please try again later.</p>
        </div>
      )}

      {status === 'done' && questions.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="flex justify-between items-center" style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
            <span className="text-muted" style={{ fontSize: '14px', fontWeight: 500 }}>Question {currentIndex + 1} of {questions.length}</span>
            <span className="badge badge-warning">Tough</span>
          </div>
          
          <div style={{ padding: '32px' }}>
            <h2 style={{ fontSize: '24px', lineHeight: 1.4, marginBottom: '24px', fontWeight: 600 }}>
              {questions[currentIndex].question}
            </h2>
            
            <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '24px' }}>
              <p className="text-muted" style={{ fontSize: '14px', margin: 0 }}>
                <span className="text-info" style={{ fontWeight: 600, marginRight: '8px' }}>Context:</span> 
                {questions[currentIndex].context}
              </p>
            </div>

            {!showAnswerHint ? (
              <button 
                onClick={() => setShowAnswerHint(true)}
                style={{ background: 'none', border: 'none', color: 'var(--silver-400)', textDecoration: 'underline', textUnderlineOffset: '4px', cursor: 'pointer', fontSize: '14px' }}
              >
                Show Answer
              </button>
            ) : (
              <div style={{ paddingLeft: '16px', borderLeft: '2px solid var(--info)', fontSize: '14px', color: 'var(--silver-300)' }}>
                {questions[currentIndex].ideal_answer || "The interviewer wants to see if you understand the trade-offs of your architectural choices. Discuss big O time complexity, edge cases, and why alternative solutions wouldn't work as well."}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center" style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
            <button 
              onClick={() => { setShowAnswerHint(false); setCurrentIndex(Math.max(0, currentIndex - 1)); }}
              disabled={currentIndex === 0}
              className="btn btn-ghost"
            >
              Previous
            </button>
            
            {currentIndex < questions.length - 1 ? (
              <button 
                onClick={handleNext}
                className="btn btn-primary"
              >
                Next Question
              </button>
            ) : (
              <Link 
                to={`/repos/${id}`}
                className="btn btn-primary"
              >
                Finish Interview
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
