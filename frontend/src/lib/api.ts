import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
})

export interface Document {
  id: string
  title: string
  source_type: 'pdf' | 'text' | 'url'
  source_url?: string
  content?: string
  created_at: string
}

export interface Flashcard {
  id: string
  document_id: string
  front: string
  back: string
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface QuizQuestion {
  id: string
  document_id: string
  question: string
  options: string[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// Documents
export const getDocuments = () => api.get<Document[]>('/documents').then(r => r.data)
export const uploadPDF = (file: File, title?: string) => {
  const form = new FormData()
  form.append('file', file)
  if (title) form.append('title', title)
  return api.post<Document>('/documents/upload/pdf', form).then(r => r.data)
}
export const uploadText = (title: string, content: string) =>
  api.post<Document>('/documents/upload/text', { title, content }).then(r => r.data)
export const uploadURL = (url: string, title?: string) =>
  api.post<Document>('/documents/upload/url', { url, title }).then(r => r.data)
export const deleteDocument = (id: string) =>
  api.delete(`/documents/${id}`).then(r => r.data)

// Chat
export const getChatSession = (documentId: string) =>
  api.get(`/chat/${documentId}/session`).then(r => r.data)
export const sendMessage = (documentId: string, message: string, sessionId?: string) =>
  api.post(`/chat/${documentId}/message`, { message, sessionId }).then(r => r.data)
export const clearChat = (documentId: string, sessionId: string) =>
  api.delete(`/chat/${documentId}/session/${sessionId}`).then(r => r.data)

// Flashcards
export const getFlashcards = (documentId: string) =>
  api.get<Flashcard[]>(`/flashcards/${documentId}`).then(r => r.data)
export const generateFlashcards = (documentId: string, count: number = 10) =>
  api.post<Flashcard[]>(`/flashcards/${documentId}/generate`, { count }).then(r => r.data)

// Quiz
export const getQuizQuestions = (documentId: string) =>
  api.get<QuizQuestion[]>(`/quiz/${documentId}`).then(r => r.data)
export const generateQuiz = (documentId: string, count: number = 5) =>
  api.post<QuizQuestion[]>(`/quiz/${documentId}/generate`, { count }).then(r => r.data)
export const submitAnswer = (documentId: string, questionId: string, answer: number) =>
  api.post(`/quiz/${documentId}/${questionId}/answer`, { answer }).then(r => r.data)

export default api
