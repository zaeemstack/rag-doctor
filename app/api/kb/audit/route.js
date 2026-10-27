import { NextResponse } from 'next/server';
import { auditKnowledgeBase } from '../../../../lib/kb_audit.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const useLLM = searchParams.get('useLLM') === 'true';

    const auditResult = await auditKnowledgeBase({ useLLM });
    return NextResponse.json({
      success: true,
      audit: auditResult,
    });
  } catch (err) {
    console.error('[API /api/kb/audit] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
