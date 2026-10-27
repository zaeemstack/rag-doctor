import { NextResponse } from 'next/server';
import pLimit from 'p-limit';
import { getDefaultPipeline, RAGPipeline } from '../../../lib/rag.js';
import { getBenchmarkExam } from '../../../lib/exam.js';
import { judgeAnswer } from '../../../lib/judge.js';
import { calculateMetrics } from '../../../lib/metrics.js';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      limit = 10,
      category = null,
      customConfig = null,
    } = body;

    const exam = getBenchmarkExam({ limit: Number(limit) || 10, category });
    const pipeline = customConfig ? new RAGPipeline(customConfig) : await getDefaultPipeline();
    if (customConfig) {
      await pipeline.indexCorpus();
    }

    const limitFn = pLimit(4);
    const evaluationResults = await Promise.all(
      exam.map((q) =>
        limitFn(async () => {
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
      )
    );

    const metrics = calculateMetrics(evaluationResults);

    return NextResponse.json({
      success: true,
      metrics,
      results: evaluationResults,
    });
  } catch (err) {
    console.error('[API /api/evaluate] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
