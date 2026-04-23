import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight, X, CheckCircle, XCircle,
  Trophy, Brain, Clock, File, FileText, Link, FlaskConical,
  Star, Loader2, RefreshCw
} from 'lucide-react'
import { getDocuments, generateFlashcards, type Document, type Flashcard } from '../lib/api'

// ── Quiz history ──
interface QuizAttempt {
  id: string; documentId: string; date: string; score: number; total: number
  answers: { question: string; options: string[]; selected: number; correct_answer: number; correct: boolean; explanation: string }[]
}
const QUIZ_KEY = 'scholarmind_quiz_history'
const loadHistory = (): QuizAttempt[] => {
  try { return JSON.parse(localStorage.getItem(QUIZ_KEY) || '[]') } catch { return [] }
}

// ── Favorite flashcards ──
interface SavedCard {
  id: string; documentId: string; front: string; back: string; difficulty: string; savedAt: string
}
const FAV_KEY = 'studyai_favorites'
const loadFavorites = (): SavedCard[] => {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]') } catch { return [] }
}

export default function LibraryPage() {
  const navigate = useNavigate()
  const [documents, setDocuments] = useState<Document[]>([])
  const [quizHistory, setQuizHistory] = useState<QuizAttempt[]>([])
  const [openDocs, setOpenDocs] = useState<Set<string>>(new Set())
  const [reviewAttempt, setReviewAttempt] = useState<QuizAttempt | null>(null)
  const [reviewIndex, setReviewIndex] = useState(0)
  const [activeSection, setActiveSection] = useState<Record<string, 'quizzes' | 'flashcards'>>({})

  // Flashcard state
  const [generatedCards, setGeneratedCards] = useState<Record<string, Flashcard[]>>({})
  const [generating, setGenerating] = useState<string | null>(null)
  const [favorites, setFavorites] = useState<SavedCard[]>([])
  // Flip state: key = `${docId}-${cardIndex}`
  const [flipped, setFlipped] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setQuizHistory(loadHistory())
    setFavorites(loadFavorites())
    getDocuments().then(docs => {
      setDocuments(docs)
      if (docs.length > 0) setOpenDocs(new Set([docs[0].id]))
    }).catch(() => {})
  }, [])

  const toggleDoc = (docId: string) => {
    const next = new Set(openDocs)
    if (next.has(docId)) { next.delete(docId) } else { next.add(docId) }
    setOpenDocs(next)
  }

  const handleGenerate = async (docId: string) => {
    setGenerating(docId)
    setFlipped({})
    try {
      const cards = await generateFlashcards(docId, 10)
      setGeneratedCards(m => ({ ...m, [docId]: cards }))
    } catch {
      setGeneratedCards(m => ({ ...m, [docId]: [] }))
    } finally {
      setGenerating(null)
    }
  }

  const toggleFavorite = (card: Flashcard, docId: string) => {
    const all = loadFavorites()
    const cardId = `${docId}-${card.front.slice(0, 40)}`
    const exists = all.find(f => f.id === cardId)
    let updated: SavedCard[]
    if (exists) {
      updated = all.filter(f => f.id !== cardId)
    } else {
      updated = [{ id: cardId, documentId: docId, front: card.front, back: card.back, difficulty: card.difficulty, savedAt: new Date().toISOString() }, ...all]
    }
    localStorage.setItem(FAV_KEY, JSON.stringify(updated))
    setFavorites(updated)
  }

  const isFavorited = (card: Flashcard, docId: string) =>
    favorites.some(f => f.id === `${docId}-${card.front.slice(0, 40)}`)

  const removeFavorite = (id: string) => {
    const updated = favorites.filter(f => f.id !== id)
    localStorage.setItem(FAV_KEY, JSON.stringify(updated))
    setFavorites(updated)
  }

  const docQuizzes = (docId: string) => quizHistory.filter(a => a.documentId === docId)
  const docFavorites = (docId: string) => favorites.filter(f => f.documentId === docId)

  const deleteAttempt = (id: string) => {
    const updated = quizHistory.filter(a => a.id !== id)
    setQuizHistory(updated)
    localStorage.setItem(QUIZ_KEY, JSON.stringify(updated))
  }

  const gradeColor = (score: number, total: number) => {
    const p = score / total
    if (p >= 0.8) return 'var(--green)'
    if (p >= 0.5) return 'var(--yellow)'
    return 'var(--red)'
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
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const srcIcon = (type: string) => {
    if (type === 'pdf') return <File size={12} />
    if (type === 'url') return <Link size={12} />
    return <FileText size={12} />
  }

  // ── Review modal ──
  if (reviewAttempt) {
    const ans = reviewAttempt.answers[reviewIndex]
    const docTitle = documents.find(d => d.id === reviewAttempt.documentId)?.title || 'Document'
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setReviewAttempt(null)} className="btn btn-ghost" style={{ padding: '5px 9px' }}>
              <X size={13} />
            </button>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Review</span>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>— {docTitle}</span>
            <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 9px', borderRadius: 99, background: 'var(--bg-4)', color: gradeColor(reviewAttempt.score, reviewAttempt.total) }}>
              {reviewAttempt.score}/{reviewAttempt.total}
            </span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{timeAgo(reviewAttempt.date)}</span>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '32px 24px' }}>
          <div style={{ maxWidth: 540, margin: '0 auto' }}>
            <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginBottom: 28, flexWrap: 'wrap' }}>
              {reviewAttempt.answers.map((a, i) => (
                <button key={i} onClick={() => setReviewIndex(i)} style={{
                  width: 30, height: 30, borderRadius: '50%', fontSize: 11, fontWeight: 700,
                  background: i === reviewIndex ? (a.correct ? 'var(--green)' : 'var(--red)') : (a.correct ? 'var(--green-bg)' : 'var(--red-bg)'),
                  color: i === reviewIndex ? 'white' : (a.correct ? 'var(--green)' : 'var(--red)'),
                  border: `1px solid ${a.correct ? 'var(--green)' : 'var(--red)'}`,
                  cursor: 'pointer', transition: 'all 0.12s',
                }}>{i + 1}</button>
              ))}
            </div>
            <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, color: 'var(--text-1)', lineHeight: 1.5 }}>{ans.question}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {ans.options.map((opt, i) => {
                const isCorrect = i === ans.correct_answer
                const isWrong = i === ans.selected && !isCorrect
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 11,
                    padding: '11px 14px', borderRadius: 'var(--radius-sm)',
                    background: isCorrect ? 'var(--green-bg)' : isWrong ? 'var(--red-bg)' : 'var(--bg-3)',
                    border: `1px solid ${isCorrect ? 'var(--green)' : isWrong ? 'var(--red)' : 'var(--border)'}`,
                    opacity: !isCorrect && !isWrong ? 0.5 : 1,
                  }}>
                    <span style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, background: isCorrect ? 'var(--green)' : isWrong ? 'var(--red)' : 'var(--bg-5)', color: (isCorrect || isWrong) ? 'white' : 'var(--text-3)' }}>
                      {['A','B','C','D'][i]}
                    </span>
                    <span style={{ flex: 1, fontSize: 13, color: isCorrect ? 'var(--green)' : isWrong ? 'var(--red)' : 'var(--text-2)' }}>{opt}</span>
                    {isCorrect && <CheckCircle size={14} color="var(--green)" />}
                    {isWrong && <XCircle size={14} color="var(--red)" />}
                  </div>
                )
              })}
            </div>
            {ans.explanation && (
              <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                <strong style={{ color: ans.correct ? 'var(--green)' : 'var(--red)', display: 'block', marginBottom: 3 }}>
                  {ans.correct ? '✓ Correct' : '✗ Incorrect'}
                </strong>
                {ans.explanation}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button onClick={() => setReviewIndex(i => Math.max(0, i - 1))} disabled={reviewIndex === 0} className="btn btn-ghost" style={{ flex: 1 }}>← Prev</button>
              {reviewIndex < reviewAttempt.answers.length - 1
                ? <button onClick={() => setReviewIndex(i => i + 1)} className="btn btn-primary" style={{ flex: 2 }}>Next →</button>
                : <button onClick={() => setReviewAttempt(null)} className="btn btn-primary" style={{ flex: 2 }}>Done</button>
              }
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 32px 60px' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 3 }}>Library</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Quizzes and flashcards, organized by document.</p>
        </div>

        {documents.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' }}>
            <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 8 }}>No documents yet</p>
            <p style={{ fontSize: 13 }}>Upload a document and generate quizzes or flashcards to see them here.</p>
            <button onClick={() => navigate('/upload')} className="btn btn-primary" style={{ marginTop: 16 }}>Upload a document</button>
          </div>
        )}

        {/* File-by-file list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {documents.map(doc => {
            const isOpen = openDocs.has(doc.id)
            const quizzes = docQuizzes(doc.id)
            const savedCards = docFavorites(doc.id)
            const cards = generatedCards[doc.id] || []
            const section = activeSection[doc.id] || 'quizzes'
            const isGenerating = generating === doc.id

            return (
              <div key={doc.id} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', transition: 'border-color 0.15s' }}>

                {/* File row header */}
                <button
                  onClick={() => toggleDoc(doc.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '14px 16px', textAlign: 'left', background: 'none', cursor: 'pointer', transition: 'background 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-3)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <span style={{ color: 'var(--text-3)', flexShrink: 0, transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-flex' }}>
                    <ChevronRight size={13} />
                  </span>
                  <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: 'var(--bg-4)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-soft)' }}>
                    {srcIcon(doc.source_type)}
                  </div>
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.title}
                  </span>
                  <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                    {quizzes.length > 0 && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-3)' }}>
                        <Trophy size={10} /> {quizzes.length}
                      </span>
                    )}
                    {savedCards.length > 0 && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--yellow)' }}>
                        <Star size={10} /> {savedCards.length}
                      </span>
                    )}
                  </div>
                </button>

                {/* Expanded content */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>

                    {/* Sub-tabs */}
                    <div style={{ display: 'flex', padding: '10px 16px 0', borderBottom: '1px solid var(--border)' }}>
                      {(['quizzes', 'flashcards'] as const).map(s => (
                        <button key={s} onClick={() => setActiveSection(m => ({ ...m, [doc.id]: s }))}
                          style={{
                            padding: '7px 14px', fontSize: 12.5, fontWeight: 500,
                            color: section === s ? 'var(--text-1)' : 'var(--text-3)',
                            borderBottom: section === s ? '2px solid var(--accent)' : '2px solid transparent',
                            marginBottom: '-1px', background: 'none', transition: 'color 0.12s', cursor: 'pointer',
                          }}
                          onMouseEnter={e => { if (section !== s) e.currentTarget.style.color = 'var(--text-2)' }}
                          onMouseLeave={e => { if (section !== s) e.currentTarget.style.color = 'var(--text-3)' }}
                        >
                          {s === 'quizzes' ? `Quizzes (${quizzes.length})` : `Flashcards${savedCards.length > 0 ? ` · ${savedCards.length} saved` : ''}`}
                        </button>
                      ))}
                      <div style={{ flex: 1 }} />
                      <button onClick={() => navigate(`/document/${doc.id}`)}
                        style={{ fontSize: 12, color: 'var(--accent-soft)', padding: '7px 0 7px 12px', background: 'none', cursor: 'pointer' }}>
                        Open doc →
                      </button>
                    </div>

                    {/* ── Quizzes ── */}
                    {section === 'quizzes' && (
                      <div style={{ padding: '12px 16px 16px' }}>
                        {quizzes.length === 0 ? (
                          <div style={{ padding: '24px 0', textAlign: 'center' }}>
                            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>No quizzes taken yet.</p>
                            <button onClick={() => navigate(`/document/${doc.id}`)} className="btn btn-secondary" style={{ marginTop: 10, fontSize: 12 }}>
                              <FlaskConical size={12} /> Take a quiz
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                            {quizzes.map(attempt => (
                              <div key={attempt.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
                                <div style={{ textAlign: 'center', minWidth: 38, flexShrink: 0 }}>
                                  <span style={{ fontSize: 16, fontWeight: 800, color: gradeColor(attempt.score, attempt.total) }}>{attempt.score}/{attempt.total}</span>
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  <div style={{ display: 'flex', gap: 2 }}>
                                    {attempt.answers.map((a, i) => (
                                      <div key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: a.correct ? 'var(--green)' : 'var(--red)' }} />
                                    ))}
                                  </div>
                                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{Math.round(attempt.score / attempt.total * 100)}% · {timeAgo(attempt.date)}</span>
                                </div>
                                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                  <button onClick={() => { setReviewAttempt(attempt); setReviewIndex(0) }} className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 11 }}>Review</button>
                                  <button onClick={() => deleteAttempt(attempt.id)} style={{ color: 'var(--text-3)', padding: '5px', borderRadius: 'var(--radius-sm)', background: 'none' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>
                                    <X size={12} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Flashcards ── */}
                    {section === 'flashcards' && (
                      <div style={{ padding: '14px 16px 16px' }}>

                        {/* Generate bar */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: cards.length > 0 ? 14 : 0 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)' }}>
                            {cards.length > 0 ? `${cards.length} cards generated` : 'Generate a set to study'}
                          </span>
                          <button
                            onClick={() => handleGenerate(doc.id)}
                            disabled={isGenerating}
                            className="btn btn-secondary"
                            style={{ fontSize: 12, padding: '6px 12px' }}
                          >
                            {isGenerating
                              ? <><Loader2 size={11} className="animate-spin" /> Generating…</>
                              : <><RefreshCw size={11} /> {cards.length ? 'Regenerate' : 'Generate'}</>
                            }
                          </button>
                        </div>

                        {/* Generated cards grid */}
                        {cards.length > 0 && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 7, marginBottom: savedCards.length > 0 ? 20 : 0 }}>
                            {cards.map((card, i) => {
                              const flipKey = `${doc.id}-${i}`
                              const isFlipped = !!flipped[flipKey]
                              const starred = isFavorited(card, doc.id)
                              return (
                                <div
                                  key={i}
                                  onClick={() => setFlipped(f => ({ ...f, [flipKey]: !f[flipKey] }))}
                                  style={{
                                    position: 'relative', padding: '12px 14px',
                                    borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                                    background: isFlipped ? 'var(--accent-dim)' : 'var(--bg-2)',
                                    border: `1px solid ${isFlipped ? 'var(--border-active)' : 'var(--border)'}`,
                                    transition: 'all 0.18s', minHeight: 80,
                                  }}
                                >
                                  {/* Star button */}
                                  <button
                                    onClick={e => { e.stopPropagation(); toggleFavorite(card, doc.id) }}
                                    style={{
                                      position: 'absolute', top: 8, right: 8,
                                      background: 'none', padding: 3, borderRadius: 5,
                                      color: starred ? 'var(--yellow)' : 'var(--text-3)',
                                      transition: 'color 0.15s',
                                    }}
                                    title={starred ? 'Remove from saved' : 'Save flashcard'}
                                  >
                                    <Star size={12} fill={starred ? 'var(--yellow)' : 'none'} />
                                  </button>

                                  {/* Label */}
                                  <p style={{ fontSize: 9, fontWeight: 700, color: isFlipped ? 'var(--accent-soft)' : 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
                                    {isFlipped ? 'Answer' : 'Question'}
                                  </p>

                                  {/* Text */}
                                  <p style={{ fontSize: 12, color: 'var(--text-1)', lineHeight: 1.45, paddingRight: 16, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                                    {isFlipped ? card.back : card.front}
                                  </p>

                                  <div style={{ marginTop: 8 }}>
                                    <span className={`badge badge-${card.difficulty}`} style={{ fontSize: 9 }}>{card.difficulty}</span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Saved / favorited cards */}
                        {savedCards.length > 0 && (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                              <Star size={11} fill="var(--yellow)" color="var(--yellow)" />
                              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>Saved ({savedCards.length})</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {savedCards.map(card => (
                                <div key={card.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
                                  <Star size={11} fill="var(--yellow)" color="var(--yellow)" style={{ flexShrink: 0, marginTop: 2 }} />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: 12.5, color: 'var(--text-1)', lineHeight: 1.4, marginBottom: 4 }}>{card.front}</p>
                                    <p style={{ fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.4 }}>{card.back}</p>
                                    <span className={`badge badge-${card.difficulty}`} style={{ fontSize: 9, marginTop: 5, display: 'inline-flex' }}>{card.difficulty}</span>
                                  </div>
                                  <button
                                    onClick={() => removeFavorite(card.id)}
                                    style={{ color: 'var(--text-3)', padding: '2px', background: 'none', flexShrink: 0 }}
                                    onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
                                    title="Remove"
                                  >
                                    <X size={11} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Empty state */}
                        {cards.length === 0 && savedCards.length === 0 && !isGenerating && (
                          <div style={{ padding: '20px 0 8px', textAlign: 'center' }}>
                            <p style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Hit Generate to create a fresh set and star your favourites.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
