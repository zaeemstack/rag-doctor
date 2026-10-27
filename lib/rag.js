/**
 * RAG Doctor — Core RAG Pipeline Engine
 *
 * Implements configurable document chunking, BM25 keyword search,
 * Vector cosine similarity, Hybrid Reciprocal Rank Fusion (RRF),
 * and generation via NVIDIA Nemotron on Nebius Token Factory.
 */

import fs from 'fs';
import path from 'path';
import bm25Search from 'wink-bm25-text-search';
import nlpUtils from 'wink-nlp-utils';
import { chat, embed, EMBEDDING_MODEL } from './client.js';

const DEMO_CORPUS_DIR = path.resolve(process.cwd(), 'data', 'demo_company');

/**
 * Loads all Markdown documents from the specified directory.
 * @param {string} [dirPath=DEMO_CORPUS_DIR]
 * @returns {Array<{id: string, filename: string, title: string, content: string}>}
 */
export function loadCorpus(dirPath = DEMO_CORPUS_DIR) {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`Corpus directory not found: ${dirPath}`);
  }

  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.md') || f.endsWith('.txt'));
  return files.map((file) => {
    const fullPath = path.join(dirPath, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    const firstHeader = content.match(/^#\s+(.+)$/m);
    const title = firstHeader ? firstHeader[1].trim() : file.replace(/\.(md|txt)$/, '');
    return {
      id: file,
      filename: file,
      title,
      content,
    };
  });
}

/**
 * Splits text into chunks with configurable size and overlap.
 * Respects paragraph boundaries when possible.
 *
 * @param {string} text
 * @param {Object} options
 * @param {number} [options.chunkSize=400] Target characters per chunk
 * @param {number} [options.chunkOverlap=80] Overlap characters between chunks
 * @returns {string[]}
 */
export function chunkText(text, { chunkSize = 400, chunkOverlap = 80 } = {}) {
  const paragraphs = text.split(/\n\n+/);
  const chunks = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (currentChunk.length + trimmed.length + 2 <= chunkSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + trimmed;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        // Retain overlap from end of current chunk
        const overlapText = currentChunk.slice(Math.max(0, currentChunk.length - chunkOverlap));
        currentChunk = overlapText + '\n\n' + trimmed;
      } else {
        // Single paragraph larger than chunkSize -> split by sentences or hard break
        for (let i = 0; i < trimmed.length; i += chunkSize - chunkOverlap) {
          chunks.push(trimmed.slice(i, i + chunkSize));
        }
      }
    }
  }

  if (currentChunk.trim() && !chunks.includes(currentChunk)) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}

/**
 * Fast deterministic fallback embedding generator for offline/demo tests
 * when no remote EMBEDDING_MODEL is available.
 */
function generateLocalVector(text, dims = 128) {
  const tokens = nlpUtils.string.tokenize(text.toLowerCase());
  const vec = new Array(dims).fill(0);
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    for (let j = 0; j < tok.length; j++) {
      const idx = (tok.charCodeAt(j) * (i + 1) * 31) % dims;
      vec[idx] += 1;
    }
  }
  // L2 normalize
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

/**
 * Computes cosine similarity between two unit-normalized vectors.
 */
function cosineSimilarity(vecA, vecB) {
  let dot = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * (vecB[i] || 0);
  }
  return dot;
}

/**
 * Complete In-Memory RAG Pipeline instance
 */
export class RAGPipeline {
  constructor(config = {}) {
    this.config = {
      chunkSize: config.chunkSize ?? 400,
      chunkOverlap: config.chunkOverlap ?? 80,
      retrievalMode: config.retrievalMode ?? 'hybrid', // 'bm25' | 'vector' | 'hybrid'
      topK: config.topK ?? 3,
      bm25Weight: config.bm25Weight ?? 0.5,
      vectorWeight: config.vectorWeight ?? 0.5,
      rrfK: config.rrfK ?? 60,
      modelTier: config.modelTier ?? 'nano',
      temperature: config.temperature ?? 0.1,
      systemPrompt: config.systemPrompt ?? null,
    };

    this.docs = [];
    this.chunks = []; // Array<{ id, docId, docTitle, text, vector }>
    this.bm25Engine = null;
    this.isIndexed = false;
  }

  /**
   * Initializes and indexes the corpus.
   * @param {Array<{id: string, filename: string, title: string, content: string}>} [corpus]
   */
  async indexCorpus(corpus = null) {
    this.docs = corpus || loadCorpus();
    this.chunks = [];

    let chunkCounter = 0;
    for (const doc of this.docs) {
      const docChunks = chunkText(doc.content, {
        chunkSize: this.config.chunkSize,
        chunkOverlap: this.config.chunkOverlap,
      });

      for (let i = 0; i < docChunks.length; i++) {
        this.chunks.push({
          id: `${doc.id}#chunk-${i}`,
          docId: doc.id,
          docTitle: doc.title,
          chunkIndex: i,
          text: docChunks[i],
          vector: null,
        });
        chunkCounter++;
      }
    }

    // Build BM25 Index
    this.bm25Engine = bm25Search();
    this.bm25Engine.defineConfig({
      fldWeights: { text: 1, docTitle: 2 },
      bm25Params: { k1: 1.2, b: 0.75 },
    });
    this.bm25Engine.definePrepTasks([
      nlpUtils.string.lowerCase,
      nlpUtils.string.tokenize0,
      nlpUtils.tokens.removeWords,
      nlpUtils.tokens.stem,
    ]);

    for (const chunk of this.chunks) {
      this.bm25Engine.addDoc(
        {
          text: chunk.text,
          docTitle: chunk.docTitle,
        },
        chunk.id
      );
    }
    this.bm25Engine.consolidate();

    // Build Vector Index (Live via Nebius embed or fallback)
    const chunkTexts = this.chunks.map((c) => `${c.docTitle}\n${c.text}`);
    if (EMBEDDING_MODEL) {
      try {
        const embeddings = await embed(chunkTexts);
        for (let i = 0; i < this.chunks.length; i++) {
          this.chunks[i].vector = embeddings[i];
        }
      } catch (err) {
        console.warn(`[RAGPipeline] Remote embedding failed (${err.message}). Falling back to local semantic vector index.`);
        for (let i = 0; i < this.chunks.length; i++) {
          this.chunks[i].vector = generateLocalVector(chunkTexts[i]);
        }
      }
    } else {
      for (let i = 0; i < this.chunks.length; i++) {
        this.chunks[i].vector = generateLocalVector(chunkTexts[i]);
      }
    }

    this.isIndexed = true;
    return {
      documentsCount: this.docs.length,
      chunksCount: this.chunks.length,
      config: this.config,
    };
  }

  /**
   * Search chunks using BM25
   */
  searchBM25(query, limit = 10) {
    if (!this.bm25Engine) return [];
    try {
      const results = this.bm25Engine.search(query, limit);
      return results.map((r, rank) => {
        const chunk = this.chunks.find((c) => c.id === r[0]);
        return {
          chunk,
          bm25Score: r[1],
          bm25Rank: rank + 1,
        };
      }).filter((item) => item.chunk);
    } catch {
      return [];
    }
  }

  /**
   * Search chunks using Vector Cosine Similarity
   */
  async searchVector(query, limit = 10) {
    let queryVec = null;
    if (EMBEDDING_MODEL) {
      try {
        const [v] = await embed([query]);
        queryVec = v;
      } catch {
        queryVec = generateLocalVector(query);
      }
    } else {
      queryVec = generateLocalVector(query);
    }

    const scored = this.chunks.map((chunk) => ({
      chunk,
      vectorScore: cosineSimilarity(queryVec, chunk.vector || generateLocalVector(chunk.text)),
    }));

    scored.sort((a, b) => b.vectorScore - a.vectorScore);
    return scored.slice(0, limit).map((item, rank) => ({
      ...item,
      vectorRank: rank + 1,
    }));
  }

  /**
   * Hybrid Search with Reciprocal Rank Fusion (RRF)
   */
  async searchHybrid(query, limit = 5) {
    const fetchCount = Math.max(limit * 3, 15);
    const bm25Results = this.searchBM25(query, fetchCount);
    const vectorResults = await this.searchVector(query, fetchCount);

    const scoreMap = new Map();
    const k = this.config.rrfK;
    const wBM25 = this.config.bm25Weight;
    const wVec = this.config.vectorWeight;

    // Accumulate BM25 RRF
    for (const r of bm25Results) {
      const chunkId = r.chunk.id;
      const rrf = wBM25 / (k + r.bm25Rank);
      scoreMap.set(chunkId, {
        chunk: r.chunk,
        rrfScore: rrf,
        bm25Rank: r.bm25Rank,
        bm25Score: r.bm25Score,
        vectorRank: null,
        vectorScore: 0,
      });
    }

    // Accumulate Vector RRF
    for (const r of vectorResults) {
      const chunkId = r.chunk.id;
      const rrf = wVec / (k + r.vectorRank);
      if (scoreMap.has(chunkId)) {
        const item = scoreMap.get(chunkId);
        item.rrfScore += rrf;
        item.vectorRank = r.vectorRank;
        item.vectorScore = r.vectorScore;
      } else {
        scoreMap.set(chunkId, {
          chunk: r.chunk,
          rrfScore: rrf,
          bm25Rank: null,
          bm25Score: 0,
          vectorRank: r.vectorRank,
          vectorScore: r.vectorScore,
        });
      }
    }

    const combined = Array.from(scoreMap.values());
    combined.sort((a, b) => b.rrfScore - a.rrfScore);
    return combined.slice(0, limit);
  }

  /**
   * Retrieve relevant chunks based on configured retrieval mode.
   * @param {string} query
   * @param {number} [topK]
   */
  async retrieve(query, topK = null) {
    if (!this.isIndexed) {
      await this.indexCorpus();
    }
    const k = topK || this.config.topK;

    if (this.config.retrievalMode === 'bm25') {
      const res = this.searchBM25(query, k);
      return res.map((r) => ({
        chunk: r.chunk,
        score: r.bm25Score,
        rank: r.bm25Rank,
        method: 'bm25',
      }));
    }

    if (this.config.retrievalMode === 'vector') {
      const res = await this.searchVector(query, k);
      return res.map((r) => ({
        chunk: r.chunk,
        score: r.vectorScore,
        rank: r.vectorRank,
        method: 'vector',
      }));
    }

    // Default: Hybrid RRF
    const res = await this.searchHybrid(query, k);
    return res.map((r, idx) => ({
      chunk: r.chunk,
      score: r.rrfScore,
      rank: idx + 1,
      method: 'hybrid',
      details: {
        bm25Rank: r.bm25Rank,
        vectorRank: r.vectorRank,
      },
    }));
  }

  /**
   * Runs the complete end-to-end RAG query pipeline:
   * Retrieval -> Prompt Synthesis -> Generation via NVIDIA Nemotron Nano/Super
   *
   * @param {string} query
   * @returns {Promise<{
   *   answer: string,
   *   retrievedChunks: Array<{docId: string, docTitle: string, text: string, score: number}>,
   *   query: string,
   *   latencyMs: number,
   *   costUsd: number,
   *   modelTier: string,
   *   modelName: string
   * }>}
   */
  async query(query) {
    const startTime = performance.now();
    const retrieved = await this.retrieve(query, this.config.topK);

    // Format context from retrieved chunks
    const contextText = retrieved
      .map(
        (r, i) =>
          `[Source ${i + 1}: ${r.chunk.docTitle} (${r.chunk.docId})]\n${r.chunk.text}`
      )
      .join('\n\n---\n\n');

    const defaultSystemPrompt =
      'You are Nova Retail\'s AI assistant. Answer the user\'s question accurately, concisely, and strictly based on the provided context.\n' +
      'If the answer cannot be found in the context, explicitly state: "I do not have enough information in the provided documentation to answer this question."\n' +
      'Do NOT speculate or fabricate details.';

    const systemPrompt = this.config.systemPrompt || defaultSystemPrompt;

    const userPrompt = `Context:\n${contextText || '(No relevant documents found)'}\n\nQuestion: ${query}\n\nAnswer:`;

    const chatResponse = await chat(
      this.config.modelTier,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      {
        temperature: this.config.temperature,
        max_tokens: 512,
      }
    );

    const totalLatency = Math.round(performance.now() - startTime);

    return {
      answer: chatResponse.content.trim(),
      retrievedChunks: retrieved.map((r) => ({
        docId: r.chunk.docId,
        docTitle: r.chunk.docTitle,
        chunkIndex: r.chunk.chunkIndex,
        text: r.chunk.text,
        score: r.score,
        rank: r.rank,
        method: r.method,
      })),
      query,
      latencyMs: totalLatency,
      costUsd: chatResponse.costUsd,
      modelTier: this.config.modelTier,
      modelName: chatResponse.modelName,
      inputTokens: chatResponse.inputTokens,
      outputTokens: chatResponse.outputTokens,
    };
  }
}

// Singleton cache for default pipeline instance
let defaultPipeline = null;

export async function getDefaultPipeline(forceRefresh = false) {
  if (!defaultPipeline || forceRefresh) {
    defaultPipeline = new RAGPipeline();
    await defaultPipeline.indexCorpus();
  }
  return defaultPipeline;
}
