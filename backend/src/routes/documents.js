const express = require('express');
const multer = require('multer');
const router = express.Router();
const pool = require('../db');
const { extractFromPDF, extractFromText, extractFromURL } = require('../services/ingestion');
const { embedAndStoreDocument } = require('../services/rag');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
});

router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, title, source_type, source_url, created_at FROM documents ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Document not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

router.post('/upload/pdf', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    const content = await extractFromPDF(req.file.buffer);
    const title = req.body.title || req.file.originalname.replace('.pdf', '');
    const docResult = await pool.query(
      'INSERT INTO documents (title, source_type, content) VALUES ($1, $2, $3) RETURNING id',
      [title, 'pdf', content]
    );
    const documentId = docResult.rows[0].id;
    await embedAndStoreDocument(documentId, content);
    res.status(201).json({ id: documentId, title, source_type: 'pdf', message: 'Document processed successfully' });
  } catch (err) { next(err); }
});

router.post('/upload/text', async (req, res, next) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Title and content are required' });
    const cleanContent = extractFromText(content);
    const docResult = await pool.query(
      'INSERT INTO documents (title, source_type, content) VALUES ($1, $2, $3) RETURNING id',
      [title, 'text', cleanContent]
    );
    const documentId = docResult.rows[0].id;
    await embedAndStoreDocument(documentId, cleanContent);
    res.status(201).json({ id: documentId, title, source_type: 'text', message: 'Document processed successfully' });
  } catch (err) { next(err); }
});

router.post('/upload/url', async (req, res, next) => {
  try {
    const { url, title } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    const content = await extractFromURL(url);
    const docTitle = title || new URL(url).hostname;
    const docResult = await pool.query(
      'INSERT INTO documents (title, source_type, source_url, content) VALUES ($1, $2, $3, $4) RETURNING id',
      [docTitle, 'url', url, content]
    );
    const documentId = docResult.rows[0].id;
    await embedAndStoreDocument(documentId, content);
    res.status(201).json({ id: documentId, title: docTitle, source_type: 'url', message: 'URL processed successfully' });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM documents WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Document not found' });
    res.json({ message: 'Document deleted successfully' });
  } catch (err) { next(err); }
});

module.exports = router;
