/**
 * RAG Doctor — Exam Generation Engine
 *
 * Automatically synthesizes comprehensive evaluation exams from documents
 * using NVIDIA Nemotron Super on Nebius Token Factory with strict Zod schemas.
 * Includes curated benchmark exams with planted unanswerable questions and contradictions.
 */

import { z } from 'zod';
import { chat } from './client.js';
import { loadCorpus } from './rag.js';

// Zod schema for individual question items
export const ExamQuestionSchema = z.object({
  id: z.string(),
  question: z.string().min(5),
  groundTruth: z.string().min(1),
  targetDoc: z.string(),
  category: z.enum(['factual', 'multi-hop', 'policy', 'edge-case', 'unanswerable']),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  isAnswerable: z.boolean(),
  notes: z.string().optional(),
});

export const ExamBatchSchema = z.object({
  questions: z.array(ExamQuestionSchema),
});

/**
 * Curated benchmark exam suite covering all 19 documents,
 * known contradictions (C1-C4), and knowledge gaps (G1-G3).
 */
export const BENCHMARK_EXAM = [
  // C1: Refund window contradiction
  {
    id: 'Q-C1',
    question: 'How many days does a customer have to return an eligible item for a refund?',
    groundTruth: 'According to refund_policy.md, the return window is 30 days. However, faq.md contradicts this stating 14 days.',
    targetDoc: 'refund_policy.md',
    category: 'policy',
    difficulty: 'hard',
    isAnswerable: true,
    notes: 'Contradiction test C1: refund_policy.md (30 days) vs faq.md (14 days)',
  },
  // C2: Shipping transit time contradiction
  {
    id: 'Q-C2',
    question: 'How long does standard shipping take from dispatch to delivery?',
    groundTruth: 'shipping.md states Standard Shipping takes 3–5 business days, but checkout_guide.md states it takes 5–7 business days.',
    targetDoc: 'shipping.md',
    category: 'factual',
    difficulty: 'medium',
    isAnswerable: true,
    notes: 'Contradiction test C2: shipping.md (3-5 days) vs checkout_guide.md (5-7 days)',
  },
  // C3: Annual leave contradiction
  {
    id: 'Q-C3',
    question: 'How many days of paid annual leave do full-time employees accrue per year?',
    groundTruth: 'hr_leave.md states 15 days per calendar year (1.25 days/month), while employee_handbook.md states 20 days per year (1.67 days/month).',
    targetDoc: 'hr_leave.md',
    category: 'policy',
    difficulty: 'hard',
    isAnswerable: true,
    notes: 'Contradiction test C3: hr_leave.md (15 days) vs employee_handbook.md (20 days)',
  },
  // C4: Warranty duration contradiction
  {
    id: 'Q-C4',
    question: 'What is the standard manufacturer warranty duration on Nova-branded products?',
    groundTruth: 'warranty.md states 1 year limited warranty, but product_catalog.md claims a 2-year manufacturer warranty standard.',
    targetDoc: 'warranty.md',
    category: 'factual',
    difficulty: 'medium',
    isAnswerable: true,
    notes: 'Contradiction test C4: warranty.md (1 year) vs product_catalog.md (2 years)',
  },
  // G1: Knowledge gap - International return shipping
  {
    id: 'Q-G1',
    question: 'Who pays for return shipping on international orders and how can an international customer obtain a return label?',
    groundTruth: 'UNANSWERABLE: The documentation covers domestic US return shipping only and explicitly omits international return shipping terms.',
    targetDoc: 'shipping.md',
    category: 'unanswerable',
    difficulty: 'hard',
    isAnswerable: false,
    notes: 'Knowledge Gap G1: International return shipping is absent from all docs',
  },
  // G2: Knowledge gap - Gift card expiration
  {
    id: 'Q-G2',
    question: 'When do Nova Retail gift cards expire after purchase?',
    groundTruth: 'UNANSWERABLE: No document in the knowledge base specifies the expiration period or validity lifetime of gift cards.',
    targetDoc: 'loyalty_program.md',
    category: 'unanswerable',
    difficulty: 'medium',
    isAnswerable: false,
    notes: 'Knowledge Gap G2: Gift card expiration is absent from all docs',
  },
  // G3: Knowledge gap - Price match policy
  {
    id: 'Q-G3',
    question: 'Does Nova Retail match competitor prices if a lower price is found on Amazon or Best Buy?',
    groundTruth: 'UNANSWERABLE: The knowledge base does not contain any price-matching policy or competitor price guarantee.',
    targetDoc: 'pricing.md',
    category: 'unanswerable',
    difficulty: 'medium',
    isAnswerable: false,
    notes: 'Knowledge Gap G3: Price-match policy is absent from all docs',
  },
  // Document-specific factual & multi-hop questions
  {
    id: 'Q-01',
    question: 'What is the restocking fee percentage that Nova Retail may apply on returned items?',
    groundTruth: 'Up to 15% of the item price if condition requirements are not met.',
    targetDoc: 'refund_policy.md',
    category: 'policy',
    difficulty: 'easy',
    isAnswerable: true,
  },
  {
    id: 'Q-02',
    question: 'Within how many hours must a customer report a damaged or incorrect delivery?',
    groundTruth: 'Within 48 hours of delivery with photos to support@novaretail.com.',
    targetDoc: 'refund_policy.md',
    category: 'factual',
    difficulty: 'easy',
    isAnswerable: true,
  },
  {
    id: 'Q-03',
    question: 'What are the qualifying spend thresholds for the Silver, Gold, and Platinum loyalty tiers?',
    groundTruth: 'Silver: $500/year; Gold: $1,500/year; Platinum: $3,500/year.',
    targetDoc: 'membership_tiers.md',
    category: 'factual',
    difficulty: 'medium',
    isAnswerable: true,
  },
  {
    id: 'Q-04',
    question: 'How many loyalty points are earned per dollar spent by standard members versus Platinum members?',
    groundTruth: 'Standard members earn 1 point per dollar, whereas Platinum members earn 2.5 points per dollar.',
    targetDoc: 'loyalty_program.md',
    category: 'multi-hop',
    difficulty: 'hard',
    isAnswerable: true,
  },
  {
    id: 'Q-05',
    question: 'Which payment methods are accepted at checkout, and is cryptocurrency supported?',
    groundTruth: 'Major credit/debit cards, PayPal, Apple Pay, Google Pay, Nova Gift Cards, and Klarna/Afterpay. Cryptocurrency is NOT accepted.',
    targetDoc: 'payment_methods.md',
    category: 'policy',
    difficulty: 'medium',
    isAnswerable: true,
  },
  {
    id: 'Q-06',
    question: 'How long does standard ground shipping take for orders shipped to Alaska and Hawaii?',
    groundTruth: '7–10 business days, with an additional delivery surcharge.',
    targetDoc: 'shipping.md',
    category: 'factual',
    difficulty: 'medium',
    isAnswerable: true,
  },
  {
    id: 'Q-07',
    question: 'What is the maximum number of days unused annual leave can be rolled over into the next calendar year?',
    groundTruth: 'Up to 5 unused annual leave days can be carried over, expiring on March 31.',
    targetDoc: 'hr_leave.md',
    category: 'policy',
    difficulty: 'medium',
    isAnswerable: true,
  },
  {
    id: 'Q-08',
    question: 'What are the operating hours for Nova Retail live customer chat support on weekends?',
    groundTruth: 'Saturday and Sunday: 10:00 to 18:00 ET.',
    targetDoc: 'contact_support.md',
    category: 'factual',
    difficulty: 'easy',
    isAnswerable: true,
  },
  {
    id: 'Q-09',
    question: 'What cleaning agents should NEVER be used on Nova-branded ceramic cookware?',
    groundTruth: 'Never use abrasive steel wool, chlorine bleach, or highly caustic oven cleaners.',
    targetDoc: 'product_care.md',
    category: 'factual',
    difficulty: 'easy',
    isAnswerable: true,
  },
  {
    id: 'Q-10',
    question: 'How does Nova Retail handle customer personal data deletion requests under GDPR/CCPA?',
    groundTruth: 'Customers can submit requests via privacy@novaretail.com. Deletion is fulfilled within 30 days subject to statutory record retention.',
    targetDoc: 'privacy_policy.md',
    category: 'policy',
    difficulty: 'medium',
    isAnswerable: true,
  },
  {
    id: 'Q-11',
    question: 'What is the order value threshold required to qualify for free domestic standard shipping?',
    groundTruth: 'Orders of $50 or more qualify for free standard shipping.',
    targetDoc: 'shipping.md',
    category: 'factual',
    difficulty: 'easy',
    isAnswerable: true,
  },
  {
    id: 'Q-12',
    question: 'What is the maximum number of promo codes that can be applied to a single online order?',
    groundTruth: 'Only one promo code may be applied per transaction; codes cannot be stacked.',
    targetDoc: 'promotions.md',
    category: 'edge-case',
    difficulty: 'medium',
    isAnswerable: true,
  },
  {
    id: 'Q-13',
    question: 'Does Nova Retail offer employee tuition reimbursement, and what is the annual cap?',
    groundTruth: 'Full-time employees after 6 months are eligible for up to $3,000 per calendar year for approved job-related coursework.',
    targetDoc: 'hr_benefits.md',
    category: 'factual',
    difficulty: 'medium',
    isAnswerable: true,
  },
  {
    id: 'Q-14',
    question: 'What happens if a tracking number shows Delivered but the customer has not received the parcel?',
    groundTruth: 'Customers must wait 24 hours (for premature carrier scans) and check premises, then notify support within 7 days to initiate a carrier investigation.',
    targetDoc: 'order_tracking.md',
    category: 'policy',
    difficulty: 'medium',
    isAnswerable: true,
  },
  {
    id: 'Q-15',
    question: 'Can Nova gift cards be exchanged for cash or used to purchase other gift cards?',
    groundTruth: 'No, gift cards cannot be redeemed for cash (except where required by law) and cannot be used to purchase additional gift cards.',
    targetDoc: 'payment_methods.md',
    category: 'edge-case',
    difficulty: 'medium',
    isAnswerable: true,
  },
  {
    id: 'Q-16',
    question: 'Are open hygiene items like earphones or opened underwear eligible for return?',
    groundTruth: 'No, hygiene products once opened are strictly non-eligible for return under Section 3.1 of the refund policy.',
    targetDoc: 'refund_policy.md',
    category: 'edge-case',
    difficulty: 'easy',
    isAnswerable: true,
  },
  {
    id: 'Q-17',
    question: 'How long does a customer have to drop their return package at a carrier location once the prepaid label is generated?',
    groundTruth: 'Within 7 calendar days of label generation.',
    targetDoc: 'refund_policy.md',
    category: 'policy',
    difficulty: 'medium',
    isAnswerable: true,
  },
  {
    id: 'Q-18',
    question: 'What is Nova Retail\'s flagship store address in New York City?',
    groundTruth: '540 Broadway, SoHo, New York, NY 10012.',
    targetDoc: 'store_locations.md',
    category: 'factual',
    difficulty: 'easy',
    isAnswerable: true,
  },
  {
    id: 'Q-19',
    question: 'What is the bereavement leave policy for immediate family members?',
    groundTruth: 'Up to 5 consecutive paid days off for the loss of an immediate family member.',
    targetDoc: 'hr_leave.md',
    category: 'policy',
    difficulty: 'easy',
    isAnswerable: true,
  },
  {
    id: 'Q-20',
    question: 'What is Nova Retail\'s cryptocurrency refund policy for Bitcoin purchases?',
    groundTruth: 'UNANSWERABLE: Nova Retail does not accept cryptocurrency, so no cryptocurrency refund policy exists.',
    targetDoc: 'payment_methods.md',
    category: 'unanswerable',
    difficulty: 'medium',
    isAnswerable: false,
    notes: 'Out-of-scope unanswerable question',
  },
];

/**
 * Returns the benchmark test suite, optionally filtered by category or limit.
 */
export function getBenchmarkExam({ category = null, limit = null } = {}) {
  let exam = [...BENCHMARK_EXAM];
  if (category) {
    exam = exam.filter((q) => q.category === category);
  }
  if (limit && limit > 0) {
    exam = exam.slice(0, limit);
  }
  return exam;
}

/**
 * Generates synthetic exam questions from a specific document using NVIDIA Nemotron Super.
 *
 * @param {string} docFilename
 * @param {number} [count=3]
 * @returns {Promise<Array<z.infer<typeof ExamQuestionSchema>>>}
 */
export async function generateQuestionsForDoc(docFilename, count = 3) {
  const corpus = loadCorpus();
  const doc = corpus.find((d) => d.filename === docFilename || d.id === docFilename);
  if (!doc) {
    throw new Error(`Document ${docFilename} not found in corpus.`);
  }

  const systemPrompt =
    'You are an expert AI test engineer. Your task is to generate challenging, realistic evaluation questions ' +
    'from the provided company policy document. Generate questions of varied types: factual, multi-hop, policy nuance, ' +
    'and 1 intentionally unanswerable question that sounds plausible but is NOT answered in this document.\n' +
    'Output MUST be valid JSON adhering strictly to the requested schema.';

  const userPrompt = `Document: "${doc.title}" (${doc.filename})\n\nContent:\n${doc.content.slice(0, 3000)}\n\n` +
    `Generate exactly ${count} questions in JSON format:\n` +
    `{\n` +
    `  "questions": [\n` +
    `    {\n` +
    `      "id": "GEN-${doc.filename.slice(0, 3)}-1",\n` +
    `      "question": "...",\n` +
    `      "groundTruth": "...",\n` +
    `      "targetDoc": "${doc.filename}",\n` +
    `      "category": "factual" | "multi-hop" | "policy" | "edge-case" | "unanswerable",\n` +
    `      "difficulty": "easy" | "medium" | "hard",\n` +
    `      "isAnswerable": true | false\n` +
    `    }\n` +
    `  ]\n` +
    `}`;

  const response = await chat('super', [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ], { jsonMode: true, temperature: 0.3 });

  try {
    const parsed = JSON.parse(response.content);
    const validated = ExamBatchSchema.parse(parsed);
    return validated.questions;
  } catch (err) {
    console.warn(`[generateQuestionsForDoc] Fallback to fallback question extraction due to: ${err.message}`);
    return [
      {
        id: `FALLBACK-${Date.now()}`,
        question: `What is the key policy stated in ${doc.title}?`,
        groundTruth: `Key rules in ${doc.filename}`,
        targetDoc: doc.filename,
        category: 'factual',
        difficulty: 'easy',
        isAnswerable: true,
      },
    ];
  }
}
