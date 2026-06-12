import { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Bot, Send, User, Sparkles, BookOpen, ChevronLeft } from 'lucide-react';
import { knowledgeApi, getApiError } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  snippets?: { path: string; content: string }[];
}

export default function RepoAskPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  
  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: "Hi! I'm your Repository Intelligence Assistant. I've analyzed this entire codebase. You can ask me anything like 'Where is JWT authentication implemented?' or 'How does the payment flow work?'"
  }]);
  
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleIndex = async () => {
    if (!id) return;
    setIndexing(true);
    try {
      await knowledgeApi.index(id);
      toast('Background indexing started! You can start asking questions in a minute.', 'success');
    } catch (e) {
      toast(getApiError(e, 'Failed to start indexing'), 'error');
    } finally {
      setIndexing(false);
    }
  };

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !id) return;

    const userMsg = query.trim();
    setQuery('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await knowledgeApi.ask(id, userMsg);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.data.answer,
        snippets: res.data.snippets
      }]);
    } catch (e: any) {
      toast(getApiError(e, 'Failed to get answer'), 'error');
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I ran into an error while analyzing the repository." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page flex flex-col" style={{ height: 'calc(100vh - 40px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 mt-2">
        <Link to={`/repos/${id}`} className="text-muted flex items-center gap-2" style={{ textDecoration: 'none', fontSize: '14px' }}>
          <ChevronLeft size={16} /> Back to Repository
        </Link>
        <div className="flex gap-2">
          <button 
            onClick={handleIndex} 
            disabled={indexing}
            className="btn btn-secondary btn-sm flex items-center gap-2"
          >
            <BookOpen size={14} /> 
            {indexing ? 'Indexing...' : 'Index Codebase'}
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="card flex flex-col" style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        
        <div className="flex items-center gap-4" style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
          <div style={{ background: 'var(--info-dim)', padding: '8px', borderRadius: 'var(--radius-md)' }}>
            <Sparkles size={18} style={{ color: 'var(--info)' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '16px', margin: 0 }}>Repository Intelligence Assistant</h2>
            <p className="text-muted" style={{ fontSize: '12px', margin: 0 }}>Powered by Vector Search (RAG)</p>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {messages.map((msg, idx) => (
            <div key={idx} className="flex gap-4" style={{ 
              maxWidth: '85%', 
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
            }}>
              
              <div style={{
                width: '32px', height: '32px', flexShrink: 0, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: msg.role === 'user' ? 'var(--info)' : 'var(--bg-elevated)',
                border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
                color: msg.role === 'user' ? '#000' : 'var(--info)'
              }}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              
              <div className="flex flex-col gap-2" style={{ alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  padding: '16px',
                  borderRadius: '16px',
                  borderTopRightRadius: msg.role === 'user' ? '0' : '16px',
                  borderTopLeftRadius: msg.role === 'assistant' ? '0' : '16px',
                  background: msg.role === 'user' ? 'var(--info)' : 'var(--bg-elevated)',
                  color: msg.role === 'user' ? '#000' : 'var(--silver-200)',
                  border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
                  fontSize: '14px',
                  lineHeight: '1.6'
                }}>
                  {msg.role === 'user' ? (
                    msg.content
                  ) : (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  )}
                </div>
                
                {msg.snippets && msg.snippets.length > 0 && (
                  <div className="flex flex-col gap-2 w-full mt-2">
                    <span className="text-muted" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>References:</span>
                    {msg.snippets.map((snip, sIdx) => (
                      <div key={sIdx} style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                        <div style={{ background: 'var(--bg-elevated)', padding: '6px 12px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--silver-400)' }}>
                          {snip.path}
                        </div>
                        <div style={{ padding: '12px', overflowX: 'auto', maxHeight: '120px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--silver-500)', whiteSpace: 'pre' }}>
                          {snip.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-4" style={{ maxWidth: '80%' }}>
              <div style={{
                width: '32px', height: '32px', flexShrink: 0, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--info)'
              }}>
                <Bot size={16} />
              </div>
              <div style={{
                padding: '16px',
                borderRadius: '16px',
                borderTopLeftRadius: '0',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleAsk} style={{ padding: '16px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
          <div style={{ position: 'relative', display: 'flex' }}>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Ask anything about the codebase..."
              disabled={loading}
              className="form-input"
              style={{ paddingRight: '48px', borderRadius: '12px' }}
            />
            <button
              type="submit"
              disabled={!query.trim() || loading}
              className="btn btn-primary"
              style={{
                position: 'absolute',
                right: '6px',
                top: '50%',
                transform: 'translateY(-50%)',
                padding: '6px 12px',
                minWidth: 'auto'
              }}
            >
              <Send size={14} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
