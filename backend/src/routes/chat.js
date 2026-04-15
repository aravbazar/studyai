const express = require('express');
const router = express.Router();
const pool = require('../db');
const { ragChat } = require('../services/rag');

router.get('/:documentId/session', async (req, res, next) => {
  try {
    let session = await pool.query(
      'SELECT * FROM chat_sessions WHERE document_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.params.documentId]
    );
    if (!session.rows.length) {
      const newSession = await pool.query(
        'INSERT INTO chat_sessions (document_id, messages) VALUES ($1, $2) RETURNING *',
        [req.params.documentId, JSON.stringify([])]
      );
      return res.json(newSession.rows[0]);
    }
    res.json(session.rows[0]);
  } catch (err) { next(err); }
});

router.post('/:documentId/message', async (req, res, next) => {
  try {
    const { message, sessionId } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });
    const doc = await pool.query('SELECT id FROM documents WHERE id = $1', [req.params.documentId]);
    if (!doc.rows.length) return res.status(404).json({ error: 'Document not found' });
    let session;
    if (sessionId) {
      const result = await pool.query('SELECT * FROM chat_sessions WHERE id = $1', [sessionId]);
      session = result.rows[0];
    }
    if (!session) {
      const result = await pool.query(
        'INSERT INTO chat_sessions (document_id, messages) VALUES ($1, $2) RETURNING *',
        [req.params.documentId, JSON.stringify([])]
      );
      session = result.rows[0];
    }
    const history = session.messages || [];
    const { answer, sourcesUsed, relevantChunks } = await ragChat(req.params.documentId, message, history);
    const updatedMessages = [...history, { role: 'user', content: message }, { role: 'assistant', content: answer }];
    await pool.query(
      'UPDATE chat_sessions SET messages = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(updatedMessages), session.id]
    );
    res.json({ sessionId: session.id, answer, sourcesUsed, relevantChunks });
  } catch (err) { next(err); }
});

router.delete('/:documentId/session/:sessionId', async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE chat_sessions SET messages = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify([]), req.params.sessionId]
    );
    res.json({ message: 'Chat history cleared' });
  } catch (err) { next(err); }
});

module.exports = router;
