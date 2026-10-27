import { NextResponse } from 'next/server';
import { getDefaultPipeline, RAGPipeline } from '../../../lib/rag.js';
import { judgeAnswer } from '../../../lib/judge.js';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { query, customConfig = null, runJudge = false, groundTruth = null } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ success: false, error: 'Query string is required' }, { status: 400 });
    }

    const pipeline = customConfig ? new RAGPipeline(customConfig) : await getDefaultPipeline();
    if (customConfig && !pipeline.isIndexed) {
      await pipeline.indexCorpus();
    }

    const result = await pipeline.query(query);

    let judgeVerdict = null;
    if (runJudge) {
      judgeVerdict = await judgeAnswer({
        question: {
          id: 'PLAYGROUND-Q',
          question: query,
          groundTruth: groundTruth || 'Accurate answer derived strictly from official corporate documentation.',
          targetDoc: result.retrievedChunks[0]?.docId || 'unknown',
          isAnswerable: true,
        },
        candidateAnswer: result.answer,
        retrievedChunks: result.retrievedChunks,
      });
    }

    return NextResponse.json({
      success: true,
      result,
      judgeVerdict,
    });
  } catch (err) {
    console.error('[API /api/query] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
