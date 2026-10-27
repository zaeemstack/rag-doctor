/**
 * RAG Doctor — Auto-Tuning Experiment Engine
 *
 * Runs multi-configuration hyperparameter searches across retrieval modes,
 * chunking strategies, top-k parameters, and prompt guardrails to identify
 * the Pareto-optimal RAG pipeline and demonstrate measurable before/after improvement.
 */

import { RAGPipeline } from './rag.js';
import { getBenchmarkExam } from './exam.js';
import { judgeAnswer } from './judge.js';
import { calculateMetrics } from './metrics.js';

export const CANDIDATE_CONFIGS = [
  {
    name: 'Baseline (Naive BM25, Small Context)',
    chunkSize: 600,
    chunkOverlap: 50,
    retrievalMode: 'bm25',
    topK: 2,
    temperature: 0.4,
    systemPrompt: 'Answer the question based on the context.',
  },
  {
    name: 'Dense Vector Search (Top-3)',
    chunkSize: 400,
    chunkOverlap: 60,
    retrievalMode: 'vector',
    topK: 3,
    temperature: 0.2,
    systemPrompt: 'Answer the question based on the provided documents.',
  },
  {
    name: 'Hybrid RRF (BM25 + Dense Cosine)',
    chunkSize: 350,
    chunkOverlap: 70,
    retrievalMode: 'hybrid',
    topK: 4,
    rrfK: 60,
    bm25Weight: 0.5,
    vectorWeight: 0.5,
    temperature: 0.1,
    systemPrompt:
      'Answer the user\'s question accurately using only the provided context. ' +
      'If not found in context, state that you do not have enough information.',
  },
  {
    name: 'Prescription Tuned (Hybrid RRF + Strict Guardrails)',
    chunkSize: 300,
    chunkOverlap: 60,
    retrievalMode: 'hybrid',
    topK: 4,
    rrfK: 60,
    bm25Weight: 0.6,
    vectorWeight: 0.4,
    temperature: 0.05,
    systemPrompt:
      'You are Nova Retail\'s verified AI assistant. Answer strictly based on the provided context.\n' +
      'CRITICAL: If the document does not explicitly contain the answer, say exactly: "I do not have enough information in the provided documentation to answer this question."\n' +
      'Never guess, extrapolate, or invent details.',
  },
];

/**
 * Runs an automated tuning experiment across candidate configurations.
 *
 * @param {Object} options
 * @param {Array<Object>} [options.testExam] Subset of questions to test on
 * @param {Array<Object>} [options.candidateConfigs] Configurations to evaluate
 * @param {Function} [options.onProgress] Optional progress callback
 * @returns {Promise<{
 *   baseline: Object,
 *   bestConfig: Object,
 *   candidates: Array<Object>,
 *   delta: { accuracyGain: number, hallucinationReduction: number, hitRateGain: number }
 * }>}
 */
export async function runAutoTuning({
  testExam = null,
  candidateConfigs = CANDIDATE_CONFIGS,
  onProgress = null,
} = {}) {
  const exam = testExam || getBenchmarkExam({ limit: 10 });
  const results = [];

  for (let cIdx = 0; cIdx < candidateConfigs.length; cIdx++) {
    const config = candidateConfigs[cIdx];
    if (onProgress) {
      onProgress({
        currentCandidate: cIdx + 1,
        totalCandidates: candidateConfigs.length,
        configName: config.name,
      });
    }

    const pipeline = new RAGPipeline(config);
    await pipeline.indexCorpus();

    const evalItems = await Promise.all(
      exam.map(async (q) => {
        const ragOut = await pipeline.query(q.question);
        const verdict = await judgeAnswer({
          question: q,
          candidateAnswer: ragOut.answer,
          retrievedChunks: ragOut.retrievedChunks,
        });

        return {
          question: q,
          ragOutput: ragOut,
          verdict,
        };
      })
    );

    const metrics = calculateMetrics(evalItems);
    results.push({
      config,
      metrics,
      sampleEvals: evalItems.slice(0, 3),
    });
  }

  // Select best candidate based on composite score: Accuracy * 0.6 + HitRate * 0.2 + (100 - Hallucination) * 0.2
  let bestIdx = 0;
  let bestComposite = -1;

  for (let i = 0; i < results.length; i++) {
    const m = results[i].metrics;
    const composite = m.accuracy * 0.6 + m.retrievalHitRate * 0.2 + (100 - m.hallucinationRate) * 0.2;
    if (composite > bestComposite) {
      bestComposite = composite;
      bestIdx = i;
    }
  }

  const baseline = results[0];
  const best = results[bestIdx];

  const delta = {
    accuracyGain: Number((best.metrics.accuracy - baseline.metrics.accuracy).toFixed(1)),
    hitRateGain: Number((best.metrics.retrievalHitRate - baseline.metrics.retrievalHitRate).toFixed(1)),
    hallucinationReduction: Number(
      (baseline.metrics.hallucinationRate - best.metrics.hallucinationRate).toFixed(1)
    ),
    latencyDiffMs: best.metrics.latency.avg - baseline.metrics.latency.avg,
  };

  return {
    baseline,
    bestConfig: best,
    candidates: results,
    delta,
  };
}
