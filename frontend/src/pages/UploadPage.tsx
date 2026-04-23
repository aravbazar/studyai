import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, Link, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { uploadPDF, uploadText, uploadURL } from '../lib/api'

type Mode = 'pdf' | 'text' | 'url'

export default function UploadPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('pdf')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) {
      setFile(accepted[0])
      if (!title) setTitle(accepted[0].name.replace('.pdf', ''))
    }
  }, [title])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false
  })

  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      let doc
      if (mode === 'pdf') {
        if (!file) throw new Error('Please select a PDF file')
        doc = await uploadPDF(file, title)
      } else if (mode === 'text') {
        if (!title || !content) throw new Error('Title and content are required')
        doc = await uploadText(title, content)
      } else {
        if (!url) throw new Error('URL is required')
        doc = await uploadURL(url, title || undefined)
      }
      ;(window as any).__refreshDocs?.()
      navigate(`/document/${doc.id}`)
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text-1)', padding: '10px 14px',
    fontSize: 14, transition: 'border-color 0.15s'
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '60px 32px' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.5px' }}>
        Upload Material
      </h1>
      <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 32 }}>
        Add study material to start chatting, generating flashcards, and quizzing yourself.
      </p>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28, background: 'var(--bg-2)', padding: 4, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
        {([['pdf', 'PDF Upload', <Upload size={13} />], ['text', 'Paste Text', <FileText size={13} />], ['url', 'From URL', <Link size={13} />]] as [Mode, string, JSX.Element][]).map(([m, label, icon]) => (
          <button key={m} onClick={() => setMode(m)} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 12px', borderRadius: 6, fontSize: 13, fontWeight: 500,
            background: mode === m ? 'var(--bg-4)' : 'transparent',
            color: mode === m ? 'var(--text-1)' : 'var(--text-3)',
            border: mode === m ? '1px solid var(--border)' : '1px solid transparent',
            transition: 'all 0.15s'
          }}>
            {icon}{label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Title field */}
        {(mode === 'text' || mode === 'pdf') && (
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 6, fontWeight: 500 }}>
              {mode === 'pdf' ? 'Title (optional)' : 'Title *'}
            </label>
            <input
              style={inputStyle}
              placeholder={mode === 'pdf' ? 'Defaults to filename' : 'e.g. CS 314 Lecture Notes'}
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>
        )}

        {/* PDF Dropzone */}
        {mode === 'pdf' && (
          <div {...getRootProps()} style={{
            border: `2px dashed ${isDragActive ? 'var(--accent)' : file ? 'var(--green)' : 'var(--border)'}`,
            borderRadius: 'var(--radius)', padding: '40px 24px', textAlign: 'center',
            cursor: 'pointer', transition: 'all 0.15s',
            background: isDragActive ? 'var(--accent-glow)' : 'var(--bg-2)'
          }}>
            <input {...getInputProps()} />
            {file ? (
              <>
                <CheckCircle size={28} color="var(--green)" style={{ margin: '0 auto 10px' }} />
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>{file.name}</p>
                <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{(file.size / 1024).toFixed(0)} KB — click to change</p>
              </>
            ) : (
              <>
                <Upload size={28} color="var(--text-3)" style={{ margin: '0 auto 10px' }} />
                <p style={{ fontSize: 14, color: 'var(--text-2)' }}>
                  {isDragActive ? 'Drop it here' : 'Drag & drop a PDF, or click to browse'}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>Max 20MB</p>
              </>
            )}
          </div>
        )}

        {/* Text area */}
        {mode === 'text' && (
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 6, fontWeight: 500 }}>
              Content *
            </label>
            <textarea
              style={{ ...inputStyle, height: 220, resize: 'vertical' }}
              placeholder="Paste your notes, lecture slides, syllabus, or any study material here..."
              value={content}
              onChange={e => setContent(e.target.value)}
            />
          </div>
        )}

        {/* URL input */}
        {mode === 'url' && (
          <>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 6, fontWeight: 500 }}>
                URL *
              </label>
              <input
                style={inputStyle}
                placeholder="https://example.com/article"
                value={url}
                onChange={e => setUrl(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 6, fontWeight: 500 }}>
                Title (optional)
              </label>
              <input
                style={inputStyle}
                placeholder="Defaults to website domain"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>
          </>
        )}

        {error && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--red)', fontSize: 13, background: 'rgba(248,113,113,0.08)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: loading ? 'var(--bg-4)' : 'var(--accent)',
            color: loading ? 'var(--text-3)' : 'white',
            padding: '12px', borderRadius: 'var(--radius)',
            fontSize: 15, fontWeight: 600,
            transition: 'all 0.15s',
            boxShadow: loading ? 'none' : '0 4px 20px var(--accent-glow)'
          }}
        >
          {loading ? <><Loader2 size={16} className="animate-spin" /> Processing...</> : <><Upload size={16} /> Upload & Process</>}
        </button>

        <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
          Your document will be chunked, embedded, and stored for semantic search.
        </p>
      </div>
    </div>
  )
}
