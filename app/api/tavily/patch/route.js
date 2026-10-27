import { NextResponse } from 'next/server';
import { draftPolicyPatchWithTavily } from '../../../../lib/tavily.js';
import { auditKnowledgeBase } from '../../../../lib/kb_audit.js';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    let gap = body.gap;

    if (!gap && body.gapId) {
      const audit = await auditKnowledgeBase();
      gap = audit.gaps.find((g) => g.id === body.gapId);
    }

    if (!gap) {
      gap = {
        id: 'G1',
        topic: 'International return shipping coverage',
        tavilyQuery: 'cross border ecommerce return shipping customs policies',
      };
    }

    const patch = await draftPolicyPatchWithTavily(gap);
    return NextResponse.json({
      success: true,
      patch,
    });
  } catch (err) {
    console.error('[API /api/tavily/patch] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
