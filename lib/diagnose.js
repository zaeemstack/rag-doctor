/**
 * RAG Doctor — Failure Diagnosis & Root-Cause Clustering Engine
 *
 * Clusters failures from evaluation runs into actionable root causes and generates
 * tailored prescriptions to fix retrieval, knowledge base, and prompt defects.
 */

export function diagnoseFailures(evaluationResults, currentConfig = {}) {
  const failedCases = evaluationResults.filter((r) => !r.verdict.isCorrect);
  const total = evaluationResults.length;
  const failureRate = total > 0 ? (failedCases.length / total) * 100 : 0;

  const clusters = {
    RETRIEVAL_FAILURE: [],
    HALLUCINATION: [],
    KB_CONTRADICTION: [],
    CONTEXT_DISTRACTION: [],
    PREMATURE_ABSTENTION: [],
    INCORRECT_REASONING: [],
  };

  for (const item of failedCases) {
    const cat = item.verdict.failureCategory || 'INCORRECT_REASONING';
    if (clusters[cat]) {
      clusters[cat].push(item);
    } else {
      clusters.INCORRECT_REASONING.push(item);
    }
  }

  const diagnoses = [];

  // 1. Diagnose Retrieval Failures
  if (clusters.RETRIEVAL_FAILURE.length > 0) {
    const count = clusters.RETRIEVAL_FAILURE.length;
    const missedDocs = Array.from(
      new Set(clusters.RETRIEVAL_FAILURE.map((c) => c.question.targetDoc))
    );

    diagnoses.push({
      id: 'DIAG-RETRIEVAL',
      title: 'Retrieval Misses (Missing Ground Truth in Context)',
      severity: count > 3 ? 'CRITICAL' : 'HIGH',
      count,
      affectedDocs: missedDocs,
      rootCause:
        `Target passages were omitted from the top-${currentConfig.topK || 3} chunks. ` +
        `Current retrieval mode [${currentConfig.retrievalMode || 'unknown'}] failed to score relevant chunks high enough.`,
      prescription: [
        'Switch to Hybrid RRF (Reciprocal Rank Fusion) combining BM25 keyword matching and dense vector embeddings.',
        `Increase top-k from ${currentConfig.topK || 3} to ${Math.min((currentConfig.topK || 3) + 2, 6)}.`,
        `Reduce chunk size from ${currentConfig.chunkSize || 400} to 300 to increase passage specificity.`,
      ],
      suggestedConfigPatch: {
        retrievalMode: 'hybrid',
        topK: Math.max((currentConfig.topK || 3) + 1, 4),
        chunkSize: 300,
        chunkOverlap: 60,
      },
    });
  }

  // 2. Diagnose Knowledge Base Contradictions
  if (clusters.KB_CONTRADICTION.length > 0) {
    const count = clusters.KB_CONTRADICTION.length;
    diagnoses.push({
      id: 'DIAG-CONTRADICTION',
      title: 'Conflicting Information in Corporate Documents',
      severity: 'CRITICAL',
      count,
      rootCause:
        'The knowledge base contains contradictory claims across different documents (e.g. refund windows, warranty duration, leave entitlement). The model retrieves conflicting facts and gives inaccurate or erratic responses.',
      prescription: [
        'Run the Knowledge Base Audit tool to cross-reference conflicting sentences.',
        'Apply single-source-of-truth edits to harmonize conflicting docs (e.g., align refund_policy.md and faq.md).',
        'Add document recency/authority weighting in retrieval prompts.',
      ],
      actionRequired: 'AUDIT_KB',
    });
  }

  // 3. Diagnose Hallucination on Missing Policies / Gaps
  if (clusters.HALLUCINATION.length > 0) {
    const count = clusters.HALLUCINATION.length;
    diagnoses.push({
      id: 'DIAG-HALLUCINATION',
      title: 'Hallucination on Knowledge Base Gaps',
      severity: count > 2 ? 'CRITICAL' : 'HIGH',
      count,
      rootCause:
        'When asked questions about unwritten or omitted corporate policies (e.g., international returns, gift card expiry, price matching), the model fabricated plausible answers instead of safely abstaining.',
      prescription: [
        'Strictly enforce negative constraint in system prompt: "If the provided context does not explicitly specify the answer, you must state that the information is not available."',
        'Lower temperature from current setting to 0.05 or 0.1 for high determinism.',
        'Use the Tavily Integration to search real-world benchmark standards and draft missing policy sections.',
      ],
      suggestedConfigPatch: {
        temperature: 0.1,
      },
      actionRequired: 'DRAFT_MISSING_POLICIES',
    });
  }

  // 4. Diagnose Context Distraction
  if (clusters.CONTEXT_DISTRACTION.length > 0) {
    const count = clusters.CONTEXT_DISTRACTION.length;
    diagnoses.push({
      id: 'DIAG-DISTRACTION',
      title: 'Context Noise & Distraction',
      severity: 'MODERATE',
      count,
      rootCause:
        'The correct document was retrieved, but irrelevant adjacent chunks diluted the prompt context, leading the model to latch onto the wrong snippet.',
      prescription: [
        'Add reranking step to sort the most semantically relevant chunk to position 1.',
        'Optimize chunk overlap to prevent repetitive boilerplate across chunks.',
      ],
      suggestedConfigPatch: {
        chunkOverlap: 40,
      },
    });
  }

  // Determine overall health status
  let healthRating = 'EXCELLENT';
  let badgeColor = 'emerald';
  if (failureRate > 40) {
    healthRating = 'CRITICAL';
    badgeColor = 'rose';
  } else if (failureRate > 20) {
    healthRating = 'NEEDS_ATTENTION';
    badgeColor = 'amber';
  } else if (failureRate > 5) {
    healthRating = 'GOOD';
    badgeColor = 'blue';
  }

  return {
    failureRate: Number(failureRate.toFixed(1)),
    healthRating,
    badgeColor,
    totalEvaluated: total,
    totalFailed: failedCases.length,
    diagnoses,
    clustersSummary: {
      retrievalMisses: clusters.RETRIEVAL_FAILURE.length,
      contradictions: clusters.KB_CONTRADICTION.length,
      hallucinations: clusters.HALLUCINATION.length,
      contextDistractions: clusters.CONTEXT_DISTRACTION.length,
      prematureAbstentions: clusters.PREMATURE_ABSTENTION.length,
    },
  };
}
