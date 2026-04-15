import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Trash2, FileText, Link, File, ChevronDown } from 'lucide-react'
import { getDocuments, deleteDocument, type Document } from '../../lib/api'

export default function Layout() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [docsOpen, setDocsOpen] = useState(true)
  const navigate = useNavigate()

  const fetchDocs = async () => {
    try { setDocuments(await getDocuments()) } catch {}
  }

  useEffect(() => { fetchDocs() }, [])
  useEffect(() => { (window as any).__refreshDocs = fetchDocs }, [])

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault(); e.stopPropagation()
    if (!confirm('Delete this document and all its data?')) return
    await deleteDocument(id)
    await fetchDocs()
    navigate('/')
  }

  const icon = (type: string) => {
    if (type === 'pdf') return <File size={11} />
    if (type === 'url') return <Link size={11} />
    return <FileText size={11} />
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <aside style={{
        width: 'var(--sidebar-width)', flexShrink: 0,
        background: 'var(--bg-2)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '18px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <NavLink to="/" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 11V4.5L7 2L12 4.5V11L7 13.5L2 11Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M7 2V13.5" stroke="white" strokeWidth="1.5"/>
                <path d="M2 4.5L12 4.5" stroke="white" strokeWidth="1.5"/>
              </svg>
            </div>
            <span style={{
              fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 15, letterSpacing: '-0.3px', color: 'var(--text-1)',
            }}>StudyAI</span>
          </NavLink>
        </div>

        <nav style={{ padding: '10px 10px 6px' }}>
          {[
            { to: '/', label: 'Home', end: true },
            { to: '/library', label: 'Library' },
            { to: '/upload', label: '+ Upload', accent: true },
          ].map(({ to, label, end, accent }) => (
            <NavLink key={to} to={to} end={end} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center',
              padding: '7px 10px', borderRadius: 'var(--radius-sm)',
              fontSize: 13, fontWeight: accent ? 500 : 400,
              color: isActive
                ? (accent ? '#fff' : 'var(--text-1)')
                : (accent ? 'var(--accent-soft)' : 'var(--text-2)'),
              background: isActive
                ? (accent ? 'var(--accent)' : 'var(--bg-4)')
                : 'transparent',
              marginBottom: 1, transition: 'all 0.12s',
            })}>
              {label}
            </NavLink>
          ))}
        </nav>

        <div style={{ height: 1, background: 'var(--border)', margin: '6px 10px' }} />

        <div style={{ flex: 1, overflow: 'auto', padding: '0 10px 12px' }}>
          <button
            onClick={() => setDocsOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '6px 6px 4px',
              color: 'var(--text-3)', fontSize: 10.5, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}
          >
            Recents
            <ChevronDown size={10} style={{
              transition: 'transform 0.2s',
              transform: docsOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
            }} />
          </button>

          {docsOpen && (
            <div>
              {documents.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 6px' }}>
                  No documents yet
                </p>
              ) : documents.map(doc => (
                <NavLink key={doc.id} to={`/document/${doc.id}`} className="doc-row"
                  style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '6px 7px', borderRadius: 'var(--radius-sm)',
                    fontSize: 12.5,
                    color: isActive ? 'var(--text-1)' : 'var(--text-2)',
                    background: isActive ? 'var(--bg-4)' : 'transparent',
                    marginBottom: 1, transition: 'all 0.1s',
                  })}>
                  <span style={{ color: 'var(--text-3)', flexShrink: 0 }}>{icon(doc.source_type)}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.title}
                  </span>
                  <button className="doc-del" onClick={e => handleDelete(e, doc.id)}
                    style={{ color: 'var(--text-3)', padding: '1px', opacity: 0, flexShrink: 0 }}
                    title="Delete">
                    <Trash2 size={10} />
                  </button>
                </NavLink>
              ))}
            </div>
          )}
        </div>
      </aside>

      <main style={{ flex: 1, overflow: 'auto', background: 'var(--bg)' }}>
        <Outlet />
      </main>

      <style>{`
        .doc-row:hover { background: var(--bg-3) !important; color: var(--text-1) !important; }
        .doc-row:hover .doc-del { opacity: 1 !important; }
        .doc-del:hover { color: var(--red) !important; }
        nav a:hover { background: var(--bg-3) !important; color: var(--text-1) !important; }
      `}</style>
    </div>
  )
}
