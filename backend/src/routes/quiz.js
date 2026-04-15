const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const pool = require('../db');
const { generateQuizQuestions } = require('../services/rag');

router.get('/:documentId', async (req, res, next) => {
  try {
    const latest = await pool.query(
      `SELECT batch_id FROM quiz_questions WHERE document_id = $1 AND batch_id IS NOT NULL ORDER BY created_at DESC LIMIT 1`,
      [req.params.documentId]
    );
    if (!latest.rows.length) {
      const fallback = await pool.query('SELECT * FROM quiz_questions WHERE document_id = $1 ORDER BY created_at ASC', [req.params.documentId]);
      return res.json(fallback.rows.map(q => ({ id: q.id, question: q.question, options: q.options, document_id: q.document_id })));
    }
    const result = await pool.query('SELECT * FROM quiz_questions WHERE batch_id = $1 ORDER BY created_at ASC', [latest.rows[0].batch_id]);
    res.json(result.rows.map(q => ({ id: q.id, question: q.question, options: q.options, document_id: q.document_id })));
  } catch (err) { next(err); }
});

router.post('/:documentId/generate', async (req, res, next) => {
  try {
    const { count = 5 } = req.body;
    const doc = await pool.query('SELECT id FROM documents WHERE id = $1', [req.params.documentId]);
    if (!doc.rows.length) return res.status(404).json({ error: 'Document not found' });
    const { questions } = await generateQuizQuestions(req.params.documentId, count);
    const batchId = crypto.randomUUID();
    const inserted = [];
    for (const q of questions) {
      const result = await pool.query(
        'INSERT INTO quiz_questions (document_id, batch_id, question, options, correct_answer, explanation) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [req.params.documentId, batchId, q.question, JSON.stringify(q.options), q.correct_answer, q.explanation]
      );
      inserted.push(result.rows[0]);
    }
    res.status(201).json(inserted.map(q => ({ id: q.id, question: q.question, options: q.options, document_id: q.document_id })));
  } catch (err) { next(err); }
});

router.post('/:documentId/:questionId/answer', async (req, res, next) => {
  try {
    const { answer } = req.body;
    if (answer === undefined) return res.status(400).json({ error: 'Answer is required' });
    const result = await pool.query(
      'SELECT correct_answer, explanation FROM quiz_questions WHERE id = $1 AND document_id = $2',
      [req.params.questionId, req.params.documentId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Question not found' });
    const { correct_answer, explanation } = result.rows[0];
    res.json({ correct: parseInt(answer) === correct_answer, correct_answer, explanation });
  } catch (err) { next(err); }
});

module.exports = router;
