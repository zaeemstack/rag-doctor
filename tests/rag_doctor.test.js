import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCorpus, chunkText, RAGPipeline } from '../lib/rag.js';
import { getBenchmarkExam } from '../lib/exam.js';
import { judgeAnswer } from '../lib/judge.js';
import { calculateMetrics } from '../lib/metrics.js';
import { diagnoseFailures } from '../lib/diagnose.js';
import { auditKnowledgeBase, loadAnswerKey } from '../lib/kb_audit.js';
import { searchTavily, draftPolicyPatchWithTavily } from '../lib/tavily.js';

test('loadCorpus loads demo company markdown documents', () => {
  const corpus = loadCorpus();
  assert.ok(corpus.length >= 18, `Expected at least 18 documents, got ${corpus.length}`);
  const refundDoc = corpus.find((d) => d.filename === 'refund_policy.md');
  assert.ok(refundDoc, 'refund_policy.md must exist in corpus');
  assert.ok(refundDoc.content.includes('30 days'));
});

test('chunkText splits document with specified overlap', () => {
  const sampleText = 'Paragraph one with some text.\n\nParagraph two with more details.\n\nParagraph three with conclusions.';
  const chunks = chunkText(sampleText, { chunkSize: 60, chunkOverlap: 15 });
  assert.ok(chunks.length >= 2, 'Should produce multiple chunks');
});

test('RAGPipeline indexes and retrieves chunks via Hybrid RRF', async () => {
  const pipeline = new RAGPipeline({
    chunkSize: 350,
    chunkOverlap: 60,
    retrievalMode: 'hybrid',
    topK: 3,
  });

  const indexStats = await pipeline.indexCorpus();
  assert.ok(indexStats.documentsCount >= 18);
  assert.ok(indexStats.chunksCount > 20);

  const results = await pipeline.retrieve('How many days for return refund window?');
  assert.ok(results.length > 0, 'Retrieval should return chunks');
  const foundRefund = results.some((r) => r.chunk.docId === 'refund_policy.md' || r.chunk.docId === 'faq.md');
  assert.ok(foundRefund, 'Should retrieve refund_policy.md or faq.md');
});

test('Benchmark Exam contains planted contradictions and gaps', () => {
  const exam = getBenchmarkExam();
  assert.ok(exam.length >= 20, 'Expected at least 20 questions');
  const c1 = exam.find((q) => q.id === 'Q-C1');
  assert.ok(c1, 'Contradiction Q-C1 should exist');
  const g1 = exam.find((q) => q.id === 'Q-G1');
  assert.ok(g1, 'Knowledge Gap Q-G1 should exist');
  assert.equal(g1.isAnswerable, false);
});

test('judgeAnswer accurately assesses grounded and abstained answers', async () => {
  const q = {
    id: 'Q-TEST-01',
    question: 'When do Nova gift cards expire?',
    isAnswerable: false,
    groundTruth: 'UNANSWERABLE: No expiration stated.',
    targetDoc: 'loyalty_program.md',
  };

  const candidateAnswer = 'I do not have enough information in the provided documentation to answer this question.';
  const verdict = await judgeAnswer({
    question: q,
    candidateAnswer,
    retrievedChunks: [{ docId: 'loyalty_program.md', text: 'Gift cards can be purchased online.' }],
  });

  assert.equal(verdict.isCorrect, true);
  assert.equal(verdict.correctAbstention, true);
  assert.equal(verdict.failureCategory, 'NONE');
});

test('calculateMetrics computes correct aggregate percentages', () => {
  const mockEvals = [
    {
      question: { id: '1', isAnswerable: true },
      ragOutput: { latencyMs: 200, costUsd: 0.0001 },
      verdict: { isCorrect: true, correctnessScore: 90, faithfulnessScore: 95, retrievalHit: true, correctAbstention: true },
    },
    {
      question: { id: '2', isAnswerable: true },
      ragOutput: { latencyMs: 300, costUsd: 0.0001 },
      verdict: { isCorrect: false, correctnessScore: 30, faithfulnessScore: 40, retrievalHit: false, correctAbstention: true, failureCategory: 'RETRIEVAL_FAILURE' },
    },
  ];

  const metrics = calculateMetrics(mockEvals);
  assert.equal(metrics.totalQuestions, 2);
  assert.equal(metrics.accuracy, 50);
  assert.equal(metrics.retrievalHitRate, 50);
  assert.equal(metrics.latency.avg, 250);
});

test('diagnoseFailures clusters retrieval failures and generates prescription', () => {
  const mockEvals = [
    {
      question: { id: '1', targetDoc: 'warranty.md', isAnswerable: true },
      ragOutput: { latencyMs: 200, costUsd: 0.0001 },
      verdict: { isCorrect: false, failureCategory: 'RETRIEVAL_FAILURE' },
    },
  ];

  const diagnosis = diagnoseFailures(mockEvals, { topK: 2, retrievalMode: 'bm25' });
  assert.equal(diagnosis.totalFailed, 1);
  assert.ok(diagnosis.diagnoses.some((d) => d.id === 'DIAG-RETRIEVAL'));
});

test('auditKnowledgeBase detects known contradictions and gaps', async () => {
  const audit = await auditKnowledgeBase();
  assert.ok(audit.contradictions.length >= 4, 'Should detect 4 known contradictions');
  assert.ok(audit.gaps.length >= 3, 'Should detect 3 knowledge gaps');
  assert.ok(audit.summary.healthScore < 80, 'Health score should reflect flaws');

  const answerKey = loadAnswerKey();
  assert.ok(answerKey, 'Answer key should be loaded');
});

test('Tavily integration retrieves research and drafts policy patch', async () => {
  const gap = {
    id: 'G1',
    topic: 'International return shipping coverage',
    tavilyQuery: 'international e-commerce return shipping best practices',
  };

  const patch = await draftPolicyPatchWithTavily(gap);
  assert.equal(patch.gapId, 'G1');
  assert.ok(patch.webSources.length > 0);
  assert.ok(patch.draftedPolicySection.length > 30);
});
