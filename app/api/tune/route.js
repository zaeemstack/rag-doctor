import { NextResponse } from 'next/server';
import { runAutoTuning } from '../../../lib/tuner.js';
import { getBenchmarkExam } from '../../../lib/exam.js';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = Number(body.sampleSize) || 6;
    const testExam = getBenchmarkExam({ limit });

    const tuningReport = await runAutoTuning({ testExam });
    return NextResponse.json({
      success: true,
      report: tuningReport,
    });
  } catch (err) {
    console.error('[API /api/tune] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
