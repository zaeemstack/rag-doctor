/**
 * RAG Doctor — Metrics Computation Engine
 *
 * Computes comprehensive benchmark metrics: Accuracy, Faithfulness,
 * Retrieval Hit Rate, Correct Abstention, Latency Percentiles (p50/p95),
 * and Nebius Token Factory cost accounting.
 */

export function calculateMetrics(evaluationResults) {
  if (!evaluationResults || evaluationResults.length === 0) {
    return {
      totalQuestions: 0,
      accuracy: 0,
      averageCorrectness: 0,
      averageFaithfulness: 0,
      retrievalHitRate: 0,
      abstentionPrecision: 0,
      hallucinationRate: 0,
      latency: { avg: 0, p50: 0, p95: 0 },
      cost: { totalUsd: 0, costPer1kQueries: 0 },
      failureBreakdown: {},
    };
  }

  const n = evaluationResults.length;
  let correctCount = 0;
  let correctnessSum = 0;
  let faithfulnessSum = 0;
  let retrievalHits = 0;
  let unanswerableCount = 0;
  let correctAbstentions = 0;
  let hallucinationCount = 0;
  let totalCostUsd = 0;
  const latencies = [];
  const failureCounts = {
    NONE: 0,
    RETRIEVAL_FAILURE: 0,
    HALLUCINATION: 0,
    KB_CONTRADICTION: 0,
    CONTEXT_DISTRACTION: 0,
    PREMATURE_ABSTENTION: 0,
    INCORRECT_REASONING: 0,
  };

  for (const item of evaluationResults) {
    const verdict = item.verdict;
    const isAnswerable = item.question?.isAnswerable ?? true;

    if (verdict.isCorrect) correctCount++;
    correctnessSum += verdict.correctnessScore || 0;
    faithfulnessSum += verdict.faithfulnessScore || 0;

    if (verdict.retrievalHit) retrievalHits++;

    if (!isAnswerable) {
      unanswerableCount++;
      if (verdict.correctAbstention) {
        correctAbstentions++;
      } else {
        hallucinationCount++;
      }
    }

    const cat = verdict.failureCategory || 'NONE';
    failureCounts[cat] = (failureCounts[cat] || 0) + 1;

    if (item.ragOutput?.latencyMs) {
      latencies.push(item.ragOutput.latencyMs);
    }
    if (item.ragOutput?.costUsd) {
      totalCostUsd += item.ragOutput.costUsd;
    }
  }

  // Latency percentiles
  latencies.sort((a, b) => a - b);
  const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const p50 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : 0;
  const p95 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;

  const accuracy = Number(((correctCount / n) * 100).toFixed(1));
  const avgCorrectness = Number((correctnessSum / n).toFixed(1));
  const avgFaithfulness = Number((faithfulnessSum / n).toFixed(1));
  const hitRate = Number(((retrievalHits / n) * 100).toFixed(1));
  const abstentionPrecision =
    unanswerableCount > 0
      ? Number(((correctAbstentions / unanswerableCount) * 100).toFixed(1))
      : 100;
  const hallucinationRate =
    unanswerableCount > 0
      ? Number(((hallucinationCount / unanswerableCount) * 100).toFixed(1))
      : 0;

  const costPer1k = Number(((totalCostUsd / (n || 1)) * 1000).toFixed(4));

  return {
    totalQuestions: n,
    correctCount,
    accuracy,
    averageCorrectness: avgCorrectness,
    averageFaithfulness: avgFaithfulness,
    retrievalHitRate: hitRate,
    abstentionPrecision,
    hallucinationRate,
    latency: {
      avg: avgLatency,
      p50,
      p95,
    },
    cost: {
      totalUsd: Number(totalCostUsd.toFixed(6)),
      costPer1kQueries: costPer1k,
    },
    failureBreakdown: failureCounts,
  };
}
