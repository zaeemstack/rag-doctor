import { NextResponse } from 'next/server';
import {
  applyContradictionPatch,
  autoHealAllKB,
  resetCorpusToBaseline,
} from '../../../../lib/kb_audit.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { contradictionId, autoHealAll, resetBaseline } = body;

    if (resetBaseline) {
      const resetResult = resetCorpusToBaseline();
      return NextResponse.json({
        success: true,
        resetResult,
      });
    }

    if (autoHealAll) {
      const healResult = autoHealAllKB();
      return NextResponse.json({
        success: true,
        healResult,
      });
    }

    if (!contradictionId) {
      return NextResponse.json(
        { success: false, error: 'contradictionId, autoHealAll, or resetBaseline is required' },
        { status: 400 }
      );
    }

    const patchResult = applyContradictionPatch(contradictionId);
    return NextResponse.json({
      success: patchResult.success,
      patchResult,
    });
  } catch (err) {
    console.error('[API /api/kb/patch] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
