const OpenAI = require('openai');
const pool = require('../db');

// Groq client - free LLM API, OpenAI-compatible
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1'
});

// Local embedding model - runs on your machine, completely free
let embedder = null;
const getEmbedder = async () => {
  if (!embedder) {
    console.log('Loading local embedding model (first time only, ~80MB)...');
    const { pipeline } = await import('@xenova/transformers');
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('Embedding model loaded!');
  }
  return embedder;
};

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

const chunkText = (text) => {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
    const chunk = words.slice(i, i + CHUNK_SIZE).join(' ');
    if (chunk.trim().length > 20) chunks.push(chunk);
  }
  return chunks;
};

const generateEmbedding = async (text) => {
  const embed = await getEmbedder();
  const output = await embed(text.trim(), { pooling: 'mean', normalize: true });
  return Array.from(output.data);
};

const embedAndStoreDocument = async (documentId, content) => {
  const chunks = chunkText(content);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await generateEmbedding(chunks[i]);
      const embeddingStr = `[${embedding.join(',')}]`;
      await client.query(
        `INSERT INTO chunks (document_id, content, chunk_index, embedding)
         VALUES ($1, $2, $3, $4::vector)`,
        [documentId, chunks[i], i, embeddingStr]
      );
    }
    await client.query('COMMIT');
    console.log(`Stored ${chunks.length} chunks for document ${documentId}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const retrieveRelevantChunks = async (documentId, query, topK = 5) => {
  const queryEmbedding = await generateEmbedding(query);
  const embeddingStr = `[${queryEmbedding.join(',')}]`;
  const result = await pool.query(
    `SELECT content, chunk_index,
      1 - (embedding <=> $1::vector) AS similarity
     FROM chunks
     WHERE document_id = $2
     ORDER BY similarity DESC
     LIMIT $3`,
    [embeddingStr, documentId, topK]
  );
  return result.rows;
};

const ragChat = async (documentId, query, conversationHistory = []) => {
  const relevantChunks = await retrieveRelevantChunks(documentId, query);
  const context = relevantChunks.map(c => c.content).join('\n\n---\n\n');

  const systemPrompt = `You are StudyAI, an intelligent study assistant.
You help students understand their course material by answering questions based on their uploaded notes and syllabi.
Use the following context from the student's documents to answer their question.
Be clear, educational, and concise. If the context doesn't contain enough information, say so honestly.

CONTEXT FROM STUDENT'S DOCUMENTS:
${context}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-6),
    { role: 'user', content: query }
  ];

  const response = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages,
    temperature: 0.3,
    max_tokens: 1000
  });

  return {
    answer: response.choices[0].message.content,
    sourcesUsed: relevantChunks.length,
    relevantChunks: relevantChunks.map(c => ({ content: c.content.substring(0, 100) + '...', similarity: c.similarity }))
  };
};

const generateFlashcards = async (documentId, count = 10) => {
  const chunks = await pool.query(
    'SELECT content FROM chunks WHERE document_id = $1 ORDER BY chunk_index LIMIT 20',
    [documentId]
  );
  const content = chunks.rows.map(c => c.content).join('\n\n');

  const response = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      {
        role: 'system',
        content: `You are an expert educator. Generate exactly ${count} flashcards from the provided study material.
Return ONLY valid JSON in this exact format, no other text:
{
  "flashcards": [
    {
      "front": "Question or concept",
      "back": "Answer or explanation",
      "difficulty": "easy|medium|hard"
    }
  ]
}`
      },
      { role: 'user', content: `Generate ${count} flashcards from this material:\n\n${content}` }
    ],
    temperature: 0.5,
    max_tokens: 2000
  });

  const raw = response.choices[0].message.content.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Failed to parse flashcard JSON from AI response');
  }
};

const generateQuizQuestions = async (documentId, count = 5) => {
  const chunks = await pool.query(
    'SELECT content FROM chunks WHERE document_id = $1 ORDER BY chunk_index LIMIT 20',
    [documentId]
  );
  const content = chunks.rows.map(c => c.content).join('\n\n');

  const response = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      {
        role: 'system',
        content: `You are an expert educator. Generate exactly ${count} multiple choice questions from the study material.
Return ONLY valid JSON in this exact format, no other text:
{
  "questions": [
    {
      "question": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": 0,
      "explanation": "Why this answer is correct"
    }
  ]
}`
      },
      { role: 'user', content: `Generate ${count} quiz questions from this material:\n\n${content}` }
    ],
    temperature: 0.5,
    max_tokens: 2000
  });

  const raw = response.choices[0].message.content.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Failed to parse quiz JSON from AI response');
  }
};

module.exports = {
  embedAndStoreDocument,
  retrieveRelevantChunks,
  ragChat,
  generateFlashcards,
  generateQuizQuestions,
  chunkText
};
