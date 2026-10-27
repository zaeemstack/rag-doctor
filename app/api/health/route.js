import { NextResponse } from 'next/server';
import { validateConfig, getLedger } from '../../../lib/client.js';
import { loadCorpus } from '../../../lib/rag.js';

export async function GET() {
  try {
    let config;
    let isMockMode = false;
    try {
      config = validateConfig();
    } catch {
      isMockMode = true;
      config = {
        baseURL: process.env.NEBIUS_BASE_URL || 'https://api.studio.nebius.ai/v1',
        models: {
          nano: { name: process.env.MODEL_NANO || 'nvidia/llama-3.1-nemotron-70b-instruct' },
          super: { name: process.env.MODEL_SUPER || 'nvidia/llama-3.1-nemotron-70b-instruct' },
          ultra: { name: process.env.MODEL_ULTRA || 'nvidia/nemotron-4-340b-instruct' },
        },
      };
    }

    const docs = loadCorpus();
    const ledger = getLedger();

    return NextResponse.json({
      status: 'healthy',
      app: 'RAG Doctor',
      hackathonTrack: 'Best Apps and Agents Track',
      provider: 'Nebius Token Factory',
      isMockMode,
      models: {
        nano: config.models.nano.name,
        super: config.models.super.name,
        ultra: config.models.ultra.name,
      },
      corpus: {
        documentCount: docs.length,
        documents: docs.map((d) => ({ id: d.id, title: d.title, sizeBytes: d.content.length })),
      },
      tokenLedger: ledger,
    });
  } catch (err) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
  }
}
