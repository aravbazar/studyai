import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Plus, FileText, File, Link, Clock, MessageSquare, Brain, FlaskConical, Trophy, ArrowRight } from 'lucide-react'
import { getDocuments, type Document } from '../lib/api'

const STORAGE_KEY = 'scholarmind_quiz_history'
interface QuizAttempt {
  id: string
  documentId: string
  date: string
  score: number
  total: number
}
const loadHistory = (): QuizAttempt[] => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

export default function HomePage() {
  const navigate = useNavigate()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [quizHistory, setQuizHistory] = useState<QuizAttempt[]>([])

  useEffect(() => {
    setQuizHistory(loadHistory())
    getDocuments()
      .then(docs => setDocuments(docs))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const sourceIcon = (type: string) => {
    if (type === 'pdf') return <File size={14} />
    if (type === 'url') return <Link size={14} />
    return <FileText size={14} />
  }

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 2) return 'Just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    const d = Math.floor(h / 24)
    if (d === 1) return 'Yesterday'
    if (d < 7) return `${d}d ago`
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const avgScore = () => {
    if (!quizHistory.length) return null
    const pct = quizHistory.reduce((acc, a) => acc + a.score / a.total, 0) / quizHistory.length
    return Math.round(pct * 100)
  }

  const gradeColor = (score: number, total: number) => {
    const p = score / total
    if (p >= 0.8) return 'var(--green)'
    if (p >= 0.5) return 'var(--yellow)'
    return 'var(--red)'
  }

  const recentQuizzes = quizHistory.slice(0, 3)
  const avg = avgScore()

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 32px 60px' }}>

        {/* Stats row (only when there's data) */}
        {!loading && documents.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${avg !== null ? 3 : 2}, 1fr)`,
            gap: 10, marginBottom: 32,
          }}>
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Documents</p>
              <p style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-1)', letterSpacing: '-1px' }}>{documents.length}</p>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>uploaded</p>
            </div>
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Quizzes Taken</p>
              <p style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-1)', letterSpacing: '-1px' }}>{quizHistory.length}</p>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>total attempts</p>
            </div>
            {avg !== null && (
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Avg Score</p>
                <p style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-1px', color: avg >= 80 ? 'var(--green)' : avg >= 50 ? 'var(--yellow)' : 'var(--red)' }}>{avg}%</p>
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>across all quizzes</p>
              </div>
            )}
          </div>
        )}

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-1)', marginBottom: 2 }}>My Documents</h1>
            {!loading && <p style={{ fontSize: 13, color: 'var(--text-3)' }}>{documents.length} {documents.length === 1 ? 'document' : 'documents'}</p>}
          </div>
          <button onClick={() => navigate('/upload')} className="btn btn-primary" style={{ padding: '9px 18px', fontSize: 13 }}>
            <Plus size={14} /> New
          </button>
        </div>

        {/* Loading skeletons */}
        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ height: 96, borderRadius: 'var(--radius)', background: 'var(--bg-3)', opacity: 0.6 }} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && documents.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--bg-3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={22} color="var(--text-3)" />
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>No documents yet</p>
              <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Upload a PDF, paste text, or add a URL to get started.</p>
            </div>
            <button onClick={() => navigate('/upload')} className="btn btn-primary" style={{ marginTop: 4 }}>
              <Plus size={14} /> Upload your first document
            </button>
          </div>
        )}

        {/* Document grid */}
        {!loading && documents.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 32 }}>
            {documents.map((doc, i) => (
              <button key={doc.id} onClick={() => navigate(`/document/${doc.id}`)}
                style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px 20px', textAlign: 'left', transition: 'all 0.15s', animation: `fadeIn 0.25s ease ${i * 0.04}s both`, cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.background = 'var(--bg-3)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-2)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--bg-4)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-soft)', flexShrink: 0 }}>
                    {sourceIcon(doc.source_type)}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{doc.source_type}</span>
                </div>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-1)', lineHeight: 1.4, marginBottom: 10, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{doc.title}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-3)', fontSize: 11 }}>
                    <Clock size={10} />{timeAgo(doc.created_at)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-3)' }}>
                    <MessageSquare size={11} /><Brain size={11} /><FlaskConical size={11} />
                  </div>
                </div>
              </button>
            ))}
            <button onClick={() => navigate('/upload')}
              style={{ background: 'transparent', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', transition: 'all 0.15s', minHeight: 96 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.color = 'var(--text-2)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-3)' }}
            >
              <Plus size={14} /> Add document
            </button>
          </div>
        )}

        {/* Recent quiz activity */}
        {!loading && recentQuizzes.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>Recent Quizzes</h2>
              <button onClick={() => navigate('/library')} style={{ fontSize: 12, color: 'var(--accent-soft)', background: 'none', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                View all <ArrowRight size={11} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {recentQuizzes.map(attempt => {
                const doc = documents.find(d => d.id === attempt.documentId)
                return (
                  <div key={attempt.id} onClick={() => navigate('/library')}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 16px', borderRadius: 'var(--radius)', background: 'var(--bg-2)', border: '1px solid var(--border)', cursor: 'pointer', transition: 'border-color 0.15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-hover)'}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: 'var(--bg-4)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Trophy size={13} color="var(--accent-soft)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc?.title || 'Unknown document'}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{timeAgo(attempt.date)}</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.5px', color: gradeColor(attempt.score, attempt.total) }}>{Math.round(attempt.score / attempt.total * 100)}%</p>
                      <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{attempt.score}/{attempt.total}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
