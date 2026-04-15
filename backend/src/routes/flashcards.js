const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const pool = require('../db');
const { generateFlashcards } = require('../services/rag');

router.get('/:documentId', async (req, res, next) => {
  try {
    if (req.query.all === '1') {
      const result = await pool.query('SELECT * FROM flashcards WHERE document_id = $1 ORDER BY created_at DESC', [req.params.documentId]);
      return res.json(result.rows);
    }
    const latest = await pool.query(
      `SELECT batch_id FROM flashcards WHERE document_id = $1 AND batch_id IS NOT NULL ORDER BY created_at DESC LIMIT 1`,
      [req.params.documentId]
    );
    if (!latest.rows.length) {
      const fallback = await pool.query('SELECT * FROM flashcards WHERE document_id = $1 ORDER BY created_at ASC', [req.params.documentId]);
      return res.json(fallback.rows);
    }
    const result = await pool.query('SELECT * FROM flashcards WHERE batch_id = $1 ORDER BY created_at ASC', [latest.rows[0].batch_id]);
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT f.batch_id, f.document_id, d.title AS document_title,
             MIN(f.created_at) AS created_at, COUNT(*)::int AS card_count
      FROM flashcards f JOIN documents d ON d.id = f.document_id
      WHERE f.batch_id IS NOT NULL
      GROUP BY f.batch_id, f.document_id, d.title
      ORDER BY MIN(f.created_at) DESC
    `);
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.get('/batch/:batchId', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM flashcards WHERE batch_id = $1 ORDER BY created_at ASC', [req.params.batchId]);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// POST generate flashcards (returns cards without saving to DB - ephemeral)
router.post('/:documentId/generate', async (req, res, next) => {
  try {
    const { count = 10 } = req.body;
    const doc = await pool.query('SELECT id FROM documents WHERE id = $1', [req.params.documentId]);
    if (!doc.rows.length) return res.status(404).json({ error: 'Document not found' });
    const { flashcards } = await generateFlashcards(req.params.documentId, count);
    const cards = flashcards.map((card, i) => ({
      id: `temp-${i}`,
      document_id: req.params.documentId,
      front: card.front,
      back: card.back,
      difficulty: card.difficulty || 'medium',
    }));
    res.json(cards);
  } catch (err) { next(err); }
});

router.delete('/batch/:batchId', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM flashcards WHERE batch_id = $1', [req.params.batchId]);
    res.json({ message: 'Batch deleted' });
  } catch (err) { next(err); }
});

router.delete('/:documentId/:flashcardId', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM flashcards WHERE id = $1 AND document_id = $2', [req.params.flashcardId, req.params.documentId]);
    res.json({ message: 'Flashcard deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
