import { NextResponse } from 'next/server';
import { applyGapPatch } from '../../../../lib/kb_audit.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { gapId, policySection } = body;

    if (!gapId || !policySection) {
      return NextResponse.json(
        { success: false, error: 'gapId and policySection are required' },
        { status: 400 }
      );
    }

    const mergeResult = applyGapPatch(gapId, policySection);
    return NextResponse.json({
      success: mergeResult.success,
      mergeResult,
    });
  } catch (err) {
    console.error('[API /api/kb/merge-gap] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
