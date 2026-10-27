#!/usr/bin/env node
/**
 * RAG Doctor — Nebius & NVIDIA Nemotron Smoke Test
 *
 * Verifies .env configuration and tests live connectivity across
 * all 3 NVIDIA Nemotron tiers (nano, super, ultra).
 *
 * Usage:
 *   node scripts/smoke_test.js
 */

import { chat, validateConfig, ConfigError, getLedger } from '../lib/client.js';

function formatRow(cols, widths) {
  return '║ ' + cols.map((col, i) => String(col).padEnd(widths[i])).join(' │ ') + ' ║';
}

function formatSeparator(widths, left, mid, right, fill = '─') {
  return left + widths.map((w) => fill.repeat(w + 2)).join(mid) + right;
}

async function runSmokeTest() {
  console.log('\n================================================================');
  console.log('   RAG DOCTOR — NVIDIA x NEBIUS CONNECTIVITY SMOKE TEST');
  console.log('================================================================\n');

  // Step 1: Validate configuration
  try {
    validateConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(err.message);
      process.exit(1);
    }
    console.error('Unexpected configuration error:', err);
    process.exit(1);
  }

  const tiers = ['nano', 'super', 'ultra'];
  const results = [];
  let allPassed = true;

  console.log('Connecting to Nebius Token Factory endpoint...');
  console.log('Pinging NVIDIA Nemotron tiers (nano, super, ultra)...\n');

  for (const tier of tiers) {
    process.stdout.write(`Testing tier [${tier.toUpperCase()}]... `);
    const startTime = performance.now();
    try {
      const res = await chat(tier, [
        {
          role: 'user',
          content: 'Say exactly: "SMOKE OK"',
        },
      ], { temperature: 0.1, max_tokens: 32 });

      results.push({
        tier: tier.toUpperCase(),
        status: 'PASS',
        latencyMs: res.latencyMs,
        inTok: res.inputTokens,
        outTok: res.outputTokens,
        costUsd: `$${res.costUsd.toFixed(6)}`,
        model: res.modelName.length > 28 ? res.modelName.slice(0, 25) + '...' : res.modelName,
        answer: res.content.trim().replace(/\n/g, ' ').slice(0, 24),
      });
      console.log(`PASS (${res.latencyMs}ms)`);
    } catch (err) {
      allPassed = false;
      const latencyMs = Math.round(performance.now() - startTime);
      results.push({
        tier: tier.toUpperCase(),
        status: 'FAIL',
        latencyMs,
        inTok: 0,
        outTok: 0,
        costUsd: '$0.000000',
        model: 'ERROR',
        answer: (err.message || 'Call failed').slice(0, 24),
      });
      console.log(`FAIL: ${err.message}`);
    }
  }

  // Display Unicode summary table
  const headers = ['TIER', 'STATUS', 'LATENCY', 'IN TOK', 'OUT TOK', 'COST (USD)', 'MODEL', 'RESPONSE'];
  const widths = [6, 8, 9, 8, 9, 12, 28, 24];

  console.log('\n' + formatSeparator(widths, '╔', '╤', '╗', '═'));
  console.log(formatRow(headers, widths));
  console.log(formatSeparator(widths, '╠', '╪', '╣'));

  for (const r of results) {
    console.log(formatRow([
      r.tier,
      r.status,
      `${r.latencyMs} ms`,
      r.inTok,
      r.outTok,
      r.costUsd,
      r.model,
      r.answer,
    ], widths));
  }
  console.log(formatSeparator(widths, '╚', '╧', '╝', '═'));

  const ledger = getLedger();
  console.log(`\nTotal Smoke Test Cost: $${ledger.totalCostUsd.toFixed(6)} USD`);

  if (!allPassed) {
    console.error('\n[X] Smoke test failed for one or more model tiers. Check error messages above.\n');
    process.exit(1);
  }

  console.log('\n[V] All 3 NVIDIA Nemotron tiers verified successfully!\n');
}

runSmokeTest();
