import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import {
  MessageSquare, Brain, FlaskConical, Send, Loader2, RotateCcw,
  RefreshCw, ChevronLeft, ChevronRight, CheckCircle, XCircle,
  Trophy, Clock, History, X, Star
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import {
  getDocuments, getChatSession, sendMessage, clearChat,
  generateFlashcards, getQuizQuestions, generateQuiz, submitAnswer,
  type Document, type Flashcard, type QuizQuestion
} from '../lib/api'

type Tab = 'chat' | 'flashcards' | 'quiz'

interface QuizAttempt {
  id: string
  documentId: string
  date: string
  score: number
  total: number
  answers: {
    question: string
    options: string[]
    selected: number
    correct_answer: number
    correct: boolean
    explanation: string
  }[]
}

const STORAGE_KEY = 'scholarmind_quiz_history'
const FAV_KEY = 'studyai_favorites'

const loadHistory = (): QuizAttempt[] => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
const saveAttempt = (attempt: QuizAttempt) => {
  const history = loadHistory()
  history.unshift(attempt)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 50)))
}

interface SavedCard { id: string; documentId: string; front: string; back: string; difficulty: string; savedAt: string }
const loadFavorites = (): SavedCard[] => {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]') } catch { return [] }
}

export default function DocumentPage() {
  const { id } = useParams<{ id: string }>()
  const [doc, setDoc] = useState<Document | null>(null)
  const [tab, setTab] = useState<Tab>('chat')

  // Chat
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])
  const [sessionId, setSessionId] = useState<string>()
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Flashcards
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [cardIndex, setCardIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [flashLoading, setFlashLoading] = useState(false)
  const [favorites, setFavorites] = useState<SavedCard[]>(loadFavorites())

  // Quiz
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [quizIndex, setQuizIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [result, setResult] = useState<{ correct: boolean; correct_answer: number; explanation: string } | null>(null)
  const [score, setScore] = useState(0)
  const [quizLoading, setQuizLoading] = useState(false)
  const [quizDone, setQuizDone] = useState(false)
  const [currentAnswers, setCurrentAnswers] = useState<QuizAttempt['answers']>([])

  // Quiz history
  const [history, setHistory] = useState<QuizAttempt[]>([])
  const [reviewAttempt, setReviewAttempt] = useState<QuizAttempt | null>(null)
  const [reviewIndex, setReviewIndex] = useState(0)

  useEffect(() => {
    if (!id) return
    getDocuments().then(docs => setDoc(docs.find(d => d.id === id) || null))
    getChatSession(id).then(s => { setSessionId(s.id); setMessages(s.messages || []) })
    getQuizQuestions(id).then(setQuestions).catch(() => {})
    setHistory(loadHistory().filter(a => a.documentId === id))
  }, [id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Keyboard nav for flashcards
  useEffect(() => {
    if (tab !== 'flashcards' || flashcards.length === 0) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') { e.preventDefault(); setFlipped(f => !f) }
      if (e.key === 'ArrowRight') { setCardIndex(i => Math.min(flashcards.length - 1, i + 1)); setFlipped(false) }
      if (e.key === 'ArrowLeft') { setCardIndex(i => Math.max(0, i - 1)); setFlipped(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tab, flashcards.length])

  const handleSend = async () => {
    if (!input.trim() || chatLoading || !id) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setChatLoading(true)
    try {
      const res = await sendMessage(id, userMsg, sessionId)
      setMessages(prev => [...prev, { role: 'assistant', content: res.answer }])
      setSessionId(res.sessionId)
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
    } finally {
      setChatLoading(false)
    }
  }

  const handleGenerateFlashcards = async () => {
    if (!id) return
    setFlashLoading(true)
    try {
      const cards = await generateFlashcards(id, 10)
      setFlashcards(cards)
      setCardIndex(0)
      setFlipped(false)
    } finally {
      setFlashLoading(false)
    }
  }

  const toggleFavorite = (card: Flashcard) => {
    if (!id) return
    const all = loadFavorites()
    const cardId = `${id}-${card.front.slice(0, 40)}`
    const exists = all.find(f => f.id === cardId)
    let updated: SavedCard[]
    if (exists) {
      updated = all.filter(f => f.id !== cardId)
    } else {
      updated = [{ id: cardId, documentId: id, front: card.front, back: card.back, difficulty: card.difficulty, savedAt: new Date().toISOString() }, ...all]
    }
    localStorage.setItem(FAV_KEY, JSON.stringify(updated))
    setFavorites(updated)
  }

  const isFavorited = (card: Flashcard) => id ? favorites.some(f => f.id === `${id}-${card.front.slice(0, 40)}`) : false

  const handleGenerateQuiz = async () => {
    if (!id) return
    setQuizLoading(true)
    try {
      const qs = await generateQuiz(id, 5)
      setQuestions(qs)
      setQuizIndex(0)
      setSelected(null)
      setResult(null)
      setScore(0)
      setQuizDone(false)
      setCurrentAnswers([])
    } finally {
      setQuizLoading(false)
    }
  }

  const handleAnswer = async (optionIndex: number) => {
    if (!id || !questions[quizIndex] || selected !== null) return
    setSelected(optionIndex)
    const res = await submitAnswer(id, questions[quizIndex].id, optionIndex)
    setResult(res)
    if (res.correct) setScore(s => s + 1)
    setCurrentAnswers(prev => [...prev, {
      question: questions[quizIndex].question,
      options: questions[quizIndex].options,
      selected: optionIndex,
      correct_answer: res.correct_answer,
      correct: res.correct,
      explanation: res.explanation,
    }])
  }

  const nextQuestion = () => {
    if (quizIndex + 1 >= questions.length) {
      setQuizDone(true)
      const attempt: QuizAttempt = {
        id: crypto.randomUUID(),
        documentId: id!,
        date: new Date().toISOString(),
        score: 0,
        total: questions.length,
        answers: currentAnswers,
      }
      const finalScore = [...currentAnswers].filter(a => a.correct).length
      attempt.score = finalScore
      saveAttempt(attempt)
      setHistory(loadHistory().filter(a => a.documentId === id))
    } else {
      setQuizIndex(i => i + 1)
      setSelected(null)
      setResult(null)
    }
  }

  const gradeColor = (score: number, total: number) => {
    const pct = score / total
    if (pct >= 0.8) return 'var(--green)'
    if (pct >= 0.5) return 'var(--yellow)'
    return 'var(--red)'
  }

  const gradeEmoji = (score: number, total: number) => {
    const pct = score / total
    if (pct >= 0.8) return '🎉'
    if (pct >= 0.5) return '📚'
    return '💪'
  }

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 2) return 'Just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  }

  if (!doc) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 10, color: 'var(--text-3)' }}>
      <Loader2 size={18} className="animate-spin" />
      <span style={{ fontSize: 14 }}>Loading...</span>
    </div>
  )

  // Review modal
  if (reviewAttempt) {
    const ans = reviewAttempt.answers[reviewIndex]
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setReviewAttempt(null)} className="btn-ghost" style={{ padding: '6px 10px' }}>
              <X size={14} />
            </button>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Quiz Review</span>
            <span style={{
              fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 99,
              background: 'var(--bg-5)', color: gradeColor(reviewAttempt.score, reviewAttempt.total)
            }}>
              {reviewAttempt.score}/{reviewAttempt.total}
            </span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{timeAgo(reviewAttempt.date)}</span>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '32px 24px' }}>
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Question {reviewIndex + 1} of {reviewAttempt.answers.length}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {reviewAttempt.answers.map((a, i) => (
                  <button key={i} onClick={() => setReviewIndex(i)} style={{
                    width: 28, height: 28, borderRadius: '50%', fontSize: 11, fontWeight: 700,
                    background: i === reviewIndex ? (a.correct ? 'var(--green)' : 'var(--red)') : a.correct ? 'var(--green-bg)' : 'var(--red-bg)',
                    color: i === reviewIndex ? 'white' : a.correct ? 'var(--green)' : 'var(--red)',
                    border: `1px solid ${a.correct ? 'var(--green)' : 'var(--red)'}`,
                  }}>{i + 1}</button>
                ))}
              </div>
            </div>

            <p style={{ fontSize: 17, fontWeight: 600, marginBottom: 24, color: 'var(--text-1)', lineHeight: 1.5 }}>{ans.question}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {ans.options.map((opt, i) => {
                const isCorrect = i === ans.correct_answer
                const isSelected = i === ans.selected
                const isWrong = isSelected && !isCorrect
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', borderRadius: 'var(--radius-sm)',
                    background: isCorrect ? 'var(--green-bg)' : isWrong ? 'var(--red-bg)' : 'var(--bg-4)',
                    border: `1px solid ${isCorrect ? 'var(--green)' : isWrong ? 'var(--red)' : 'var(--border)'}`,
                    opacity: (!isCorrect && !isWrong) ? 0.5 : 1,
                  }}>
                    <span style={{
                      width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700,
                      background: isCorrect ? 'var(--green)' : isWrong ? 'var(--red)' : 'var(--bg-5)',
                      color: (isCorrect || isWrong) ? 'white' : 'var(--text-3)',
                    }}>{['A','B','C','D'][i]}</span>
                    <span style={{ fontSize: 14, color: isCorrect ? 'var(--green)' : isWrong ? 'var(--red)' : 'var(--text-2)', flex: 1 }}>{opt}</span>
                    {isCorrect && <CheckCircle size={15} color="var(--green)" />}
                    {isWrong && <XCircle size={15} color="var(--red)" />}
                  </div>
                )
              })}
            </div>

            {ans.explanation && (
              <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px 16px', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65 }}>
                <strong style={{ color: ans.correct ? 'var(--green)' : 'var(--red)', display: 'block', marginBottom: 4 }}>
                  {ans.correct ? '✓ Correct' : '✗ Incorrect'}
                </strong>
                {ans.explanation}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => setReviewIndex(i => Math.max(0, i - 1))} disabled={reviewIndex === 0} className="btn-ghost" style={{ flex: 1 }}>
                <ChevronLeft size={15} /> Prev
              </button>
              {reviewIndex < reviewAttempt.answers.length - 1 ? (
                <button onClick={() => setReviewIndex(i => i + 1)} className="btn-primary" style={{ flex: 2 }}>
                  Next <ChevronRight size={15} />
                </button>
              ) : (
                <button onClick={() => setReviewAttempt(null)} className="btn-primary" style={{ flex: 2 }}>
                  Done reviewing
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '16px 24px 0', flexShrink: 0 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, marginBottom: 14, letterSpacing: '-0.3px', color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {doc.title}
        </h2>
        <div className="tab-bar" style={{ gridTemplateColumns: 'repeat(3, 1fr)', maxWidth: 420 }}>
          {([
            ['chat', 'Chat', <MessageSquare size={14} />],
            ['flashcards', 'Flashcards', <Brain size={14} />],
            ['quiz', 'Quiz', <FlaskConical size={14} />],
          ] as [Tab, string, JSX.Element][]).map(([t, label, icon]) => (
            <button key={t} onClick={() => setTab(t)} className={`tab-item${tab === t ? ' tab-active' : ''}`}>
              {icon}{label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CHAT TAB ── */}
      {tab === 'chat' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflow: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', marginTop: 80, color: 'var(--text-3)', animation: 'fadeIn 0.4s ease' }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: '1px solid var(--border-active)' }}>
                  <MessageSquare size={22} color="var(--accent-2)" />
                </div>
                <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>Ask anything about <span style={{ color: 'var(--text-1)' }}>{doc.title}</span></p>
                <p style={{ fontSize: 13, color: 'var(--text-3)' }}>StudyAI searches for relevant context in your document.</p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
                  {['Give me a summary', 'What are the key concepts?', 'Create a study plan'].map(q => (
                    <button key={q} onClick={() => { setInput(q); setTimeout(handleSend, 10) }}
                      style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 99, padding: '6px 14px', fontSize: 12, color: 'var(--text-2)', transition: 'all 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-active)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    >{q}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', animation: 'fadeIn 0.2s ease' }}>
                {m.role === 'assistant' && (
                  <div style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 8, flexShrink: 0, marginTop: 2, border: '1px solid var(--border-active)' }}>
                    <Brain size={12} color="var(--accent-2)" />
                  </div>
                )}
                <div style={{
                  maxWidth: '72%', padding: '11px 15px',
                  borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
                  background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-3)',
                  border: m.role === 'user' ? 'none' : '1px solid var(--border)',
                  fontSize: 14, lineHeight: 1.65,
                  color: m.role === 'user' ? 'white' : 'var(--text-1)',
                  boxShadow: m.role === 'user' ? '0 2px 12px var(--accent-glow)' : 'none',
                }}>
                  {m.role === 'assistant' ? (
                    <div className="prose"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                  ) : m.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-active)' }}>
                  <Brain size={12} color="var(--accent-2)" />
                </div>
                <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '4px 14px 14px 14px', padding: '12px 16px', display: 'flex', gap: 5, alignItems: 'center' }}>
                  <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div style={{ padding: '14px 24px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'flex-end', background: 'var(--bg-2)' }}>
            <button onClick={() => { clearChat(id!, sessionId!); setMessages([]) }} className="btn-ghost" style={{ padding: '9px 10px', flexShrink: 0 }} title="Clear chat">
              <RotateCcw size={13} />
            </button>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Ask a question... (Enter to send)"
              className="input"
              style={{ flex: 1, resize: 'none', height: 42, maxHeight: 120, lineHeight: 1.5, paddingTop: 10 }}
            />
            <button onClick={handleSend} disabled={chatLoading || !input.trim()}
              style={{
                background: input.trim() ? 'var(--accent)' : 'var(--bg-4)',
                color: input.trim() ? 'white' : 'var(--text-3)',
                padding: '9px 14px', borderRadius: 'var(--radius-sm)', flexShrink: 0,
                boxShadow: input.trim() ? '0 2px 12px var(--accent-glow)' : 'none',
              }}>
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── FLASHCARDS TAB ── */}
      {tab === 'flashcards' && (
        <div style={{ flex: 1, overflow: 'auto', padding: '28px 24px' }}>
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
              <div>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>Flashcards</p>
                {flashcards.length > 0 && <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Space to flip · Arrow keys to navigate</p>}
              </div>
              <button onClick={handleGenerateFlashcards} disabled={flashLoading} className="btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}>
                {flashLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                {flashcards.length ? 'Regenerate' : 'Generate'}
              </button>
            </div>

            {flashLoading && (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' }}>
                <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                <p style={{ fontSize: 13 }}>Generating flashcards...</p>
              </div>
            )}

            {!flashLoading && flashcards.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: '1px solid var(--border)' }}>
                  <Brain size={24} color="var(--text-3)" />
                </div>
                <p style={{ fontSize: 14, color: 'var(--text-2)' }}>No flashcards yet</p>
                <p style={{ fontSize: 13, marginTop: 4 }}>Click Generate to create a set from your document.</p>
              </div>
            )}

            {flashcards.length > 0 && !flashLoading && (
              <>
                {/* Progress dots */}
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
                  {flashcards.map((_, i) => (
                    <button key={i} onClick={() => { setCardIndex(i); setFlipped(false) }} style={{
                      width: i === cardIndex ? 20 : 6, height: 6, borderRadius: 99,
                      background: i === cardIndex ? 'var(--accent)' : 'var(--bg-5)',
                      border: 'none', transition: 'all 0.2s', cursor: 'pointer',
                    }} />
                  ))}
                </div>

                {/* Card */}
                <div
                  onClick={() => setFlipped(f => !f)}
                  style={{
                    background: flipped
                      ? 'linear-gradient(135deg, var(--accent-glow) 0%, rgba(124,106,247,0.05) 100%)'
                      : 'var(--bg-2)',
                    border: `1px solid ${flipped ? 'var(--border-active)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-lg)', padding: '48px 36px',
                    minHeight: 220, textAlign: 'center', cursor: 'pointer',
                    transition: 'all 0.25s', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 14,
                    boxShadow: flipped ? '0 0 30px var(--accent-glow)' : 'var(--shadow)',
                    animation: 'scalePop 0.2s ease',
                  }}
                >
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: flipped ? 'var(--accent-2)' : 'var(--text-3)', fontWeight: 700 }}>
                    {flipped ? '✦ Answer' : 'Question'}
                  </div>
                  <p style={{ fontSize: 18, fontWeight: 500, lineHeight: 1.55, color: 'var(--text-1)', maxWidth: 380 }}>
                    {flipped ? flashcards[cardIndex].back : flashcards[cardIndex].front}
                  </p>
                  <span className={`badge badge-${flashcards[cardIndex].difficulty}`}>
                    {flashcards[cardIndex].difficulty}
                  </span>
                </div>

                {/* Nav */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 20 }}>
                  <button onClick={() => { setCardIndex(i => Math.max(0, i - 1)); setFlipped(false) }} disabled={cardIndex === 0} className="btn-ghost" style={{ padding: '8px 14px' }}>
                    <ChevronLeft size={16} />
                  </button>
                  <span style={{ fontSize: 13, color: 'var(--text-2)', minWidth: 60, textAlign: 'center', fontWeight: 500 }}>
                    {cardIndex + 1} / {flashcards.length}
                  </span>
                  <button onClick={() => { setCardIndex(i => Math.min(flashcards.length - 1, i + 1)); setFlipped(false) }} disabled={cardIndex === flashcards.length - 1} className="btn-ghost" style={{ padding: '8px 14px' }}>
                    <ChevronRight size={16} />
                  </button>
                  <button
                    onClick={() => toggleFavorite(flashcards[cardIndex])}
                    style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'none', border: '1px solid var(--border)', color: isFavorited(flashcards[cardIndex]) ? 'var(--yellow)' : 'var(--text-3)', transition: 'all 0.15s' }}
                    title={isFavorited(flashcards[cardIndex]) ? 'Remove from saved' : 'Save card'}
                  >
                    <Star size={14} fill={isFavorited(flashcards[cardIndex]) ? 'var(--yellow)' : 'none'} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── QUIZ TAB ── */}
      {tab === 'quiz' && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>

          {/* Main quiz area */}
          <div style={{ flex: 1, overflow: 'auto', padding: '28px 24px' }}>
            <div style={{ maxWidth: 540, margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>Quiz Mode</p>
                  {questions.length > 0 && !quizDone && <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{questions.length} questions</p>}
                </div>
                <button onClick={handleGenerateQuiz} disabled={quizLoading} className="btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}>
                  {quizLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  {questions.length ? 'New Quiz' : 'Generate Quiz'}
                </button>
              </div>

              {quizLoading && (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' }}>
                  <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                  <p style={{ fontSize: 13 }}>Generating questions...</p>
                </div>
              )}

              {!quizLoading && questions.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: '1px solid var(--border)' }}>
                    <FlaskConical size={24} color="var(--text-3)" />
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--text-2)' }}>No quiz yet</p>
                  <p style={{ fontSize: 13, marginTop: 4 }}>Generate one to test your knowledge.</p>
                </div>
              )}

              {questions.length > 0 && !quizDone && !quizLoading && (
                <div style={{ animation: 'fadeIn 0.3s ease' }}>
                  {/* Progress bar */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Question {quizIndex + 1} of {questions.length}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>Score: {score}/{quizIndex + (result ? 1 : 0)}</span>
                    </div>
                    <div style={{ height: 3, background: 'var(--bg-4)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: 'var(--accent)', borderRadius: 99, width: `${((quizIndex + (result ? 1 : 0)) / questions.length) * 100}%`, transition: 'width 0.4s ease' }} />
                    </div>
                  </div>

                  <p style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.55, marginBottom: 24, color: 'var(--text-1)' }}>
                    {questions[quizIndex].question}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {questions[quizIndex].options.map((opt, i) => {
                      const isCorrect = result && i === result.correct_answer
                      const isWrong = result && i === selected && !result.correct
                      return (
                        <button key={i} onClick={() => handleAnswer(i)} disabled={selected !== null} style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          background: isCorrect ? 'var(--green-bg)' : isWrong ? 'var(--red-bg)' : 'var(--bg-3)',
                          border: `1px solid ${isCorrect ? 'var(--green)' : isWrong ? 'var(--red)' : selected === i ? 'var(--border-hover)' : 'var(--border)'}`,
                          borderRadius: 'var(--radius-sm)', padding: '13px 16px',
                          fontSize: 14, color: isCorrect ? 'var(--green)' : isWrong ? 'var(--red)' : 'var(--text-1)',
                          textAlign: 'left', transition: 'all 0.15s', cursor: selected !== null ? 'default' : 'pointer',
                          opacity: selected !== null && !isCorrect && !isWrong ? 0.5 : 1,
                        }}
                          onMouseEnter={e => { if (selected === null) e.currentTarget.style.borderColor = 'var(--border-hover)' }}
                          onMouseLeave={e => { if (selected === null) e.currentTarget.style.borderColor = 'var(--border)' }}
                        >
                          <span style={{
                            width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700,
                            background: isCorrect ? 'var(--green)' : isWrong ? 'var(--red)' : 'var(--bg-5)',
                            color: (isCorrect || isWrong) ? 'white' : 'var(--text-3)',
                            border: `1px solid ${isCorrect ? 'var(--green)' : isWrong ? 'var(--red)' : 'var(--border)'}`,
                          }}>{['A','B','C','D'][i]}</span>
                          <span style={{ flex: 1 }}>{opt}</span>
                          {isCorrect && <CheckCircle size={15} color="var(--green)" />}
                          {isWrong && <XCircle size={15} color="var(--red)" />}
                        </button>
                      )
                    })}
                  </div>

                  {result && (
                    <div style={{ marginTop: 18, padding: '14px 16px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, animation: 'slideUp 0.25s ease' }}>
                      <strong style={{ color: result.correct ? 'var(--green)' : 'var(--red)' }}>
                        {result.correct ? '✓ Correct!' : '✗ Incorrect.'}
                      </strong>{' '}
                      {result.explanation}
                      <button onClick={nextQuestion} className="btn-primary" style={{ display: 'block', marginTop: 14, width: '100%' }}>
                        {quizIndex + 1 >= questions.length ? 'See Results' : 'Next Question →'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {quizDone && (
                <div style={{ textAlign: 'center', padding: '40px 0', animation: 'fadeIn 0.4s ease' }}>
                  <div style={{ fontSize: 52, marginBottom: 16 }}>{gradeEmoji(score, questions.length)}</div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.5px' }}>Quiz Complete!</h3>
                  <p style={{ fontSize: 16, color: 'var(--text-2)', marginBottom: 8 }}>
                    You scored{' '}
                    <strong style={{ color: gradeColor(score, questions.length), fontSize: 22 }}>
                      {score}/{questions.length}
                    </strong>
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 28 }}>
                    {score >= questions.length * 0.8 ? 'Excellent work! 🎯' : score >= questions.length * 0.5 ? 'Good effort — keep studying!' : "Keep going — you'll get there! 💪"}
                  </p>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                    <button onClick={() => {
                      const last = history[0]
                      if (last) { setReviewAttempt(last); setReviewIndex(0) }
                    }} className="btn-ghost">
                      <History size={14} /> Review Answers
                    </button>
                    <button onClick={handleGenerateQuiz} className="btn-primary">
                      <RefreshCw size={14} /> Try Again
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quiz history side panel */}
          <div style={{
            width: 260, borderLeft: '1px solid var(--border)', background: 'var(--bg-2)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
          }}>
            <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Trophy size={14} color="var(--yellow)" />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>Past Quizzes</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-3)', background: 'var(--bg-4)', padding: '2px 7px', borderRadius: 99 }}>{history.length}</span>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
              {history.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-3)' }}>
                  <Clock size={20} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                  <p style={{ fontSize: 12 }}>Completed quizzes will appear here</p>
                </div>
              ) : history.map((attempt) => (
                <button
                  key={attempt.id}
                  onClick={() => { setReviewAttempt(attempt); setReviewIndex(0) }}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 'var(--radius-sm)',
                    background: 'transparent', border: '1px solid var(--border)',
                    textAlign: 'left', marginBottom: 6, transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.borderColor = 'var(--border-hover)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: gradeColor(attempt.score, attempt.total) }}>
                      {attempt.score}/{attempt.total}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{timeAgo(attempt.date)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {attempt.answers.map((a, i) => (
                      <div key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: a.correct ? 'var(--green)' : 'var(--red)' }} />
                    ))}
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
                    {Math.round((attempt.score / attempt.total) * 100)}% · Click to review
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
