import { NextResponse } from 'next/server';
import { diagnoseFailures } from '../../../lib/diagnose.js';
import { getDefaultPipeline } from '../../../lib/rag.js';
import { getBenchmarkExam } from '../../../lib/exam.js';
import { judgeAnswer } from '../../../lib/judge.js';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    let results = body.evaluationResults;

    if (!results || results.length === 0) {
      // Run quick evaluation on 8 representative questions
      const exam = getBenchmarkExam({ limit: 8 });
      const pipeline = await getDefaultPipeline();
      results = [];

      for (const q of exam) {
        const ragOut = await pipeline.query(q.question);
        const verdict = await judgeAnswer({
          question: q,
          candidateAnswer: ragOut.answer,
          retrievedChunks: ragOut.retrievedChunks,
        });
        results.push({ question: q, ragOutput: ragOut, verdict });
      }
    }

    const diagnosis = diagnoseFailures(results, body.currentConfig || {});
    return NextResponse.json({
      success: true,
      diagnosis,
    });
  } catch (err) {
    console.error('[API /api/diagnose] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
