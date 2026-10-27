import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    let fileName = searchParams.get('name') || 'faq.md';

    // Sanitize to prevent path traversal
    fileName = path.basename(fileName);
    const filePath = path.resolve(process.cwd(), 'data', 'demo_company', fileName);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: `File ${fileName} not found.` }, { status: 404 });
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const stats = fs.statSync(filePath);
    const lines = content.split('\n');
    const words = content.trim().split(/\s+/).length;

    return NextResponse.json({
      name: fileName,
      content,
      lineCount: lines.length,
      wordCount: words,
      sizeBytes: stats.size,
      lastModified: stats.mtime.toISOString(),
    });
  } catch (err) {
    console.error('[API /api/kb/file] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
