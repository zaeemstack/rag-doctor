# Technical Feedback for Nebius Token Factory & NVIDIA AI

**Author:** RAG Doctor Team  
**Event:** NVIDIA × Nebius Global AI Hackathon (2025)  
**Submission Track:** Best Apps and Agents Track  

---

## 1. Executive Summary

During the development and rigorous benchmarking of **RAG Doctor**—an agent that evaluates, diagnoses, and auto-tunes enterprise RAG systems across 19 corporate policy documents—we extensively utilized **Nebius Token Factory** OpenAI-compatible inference endpoints and the **NVIDIA Nemotron** model family (`nvidia/llama-3.1-nemotron-70b-instruct` and `nvidia/nemotron-4-340b-instruct`).

Overall, Nebius Token Factory provided exceptional time-to-first-token (TTFT) and sustained throughput. Below is structured, actionable feedback spanning API ergonomics, multi-tier orchestration, token economics, and model reasoning behaviors.

---

## 2. NVIDIA Nemotron Model Family Feedback

### Strengths
1. **Nemotron Ultra as an LLM Judge:**
   - Evaluated against 50+ benchmark questions with complex negative constraints. Nemotron Ultra demonstrated strict adherence to JSON output schemas (`response_format: { type: 'json_object' }`), producing reliable structured output without markdown fences or extraneous preamble.
   - Exceptionally skilled at discriminating between **grounded answers** and **hallucinations on unwritten gaps** (e.g. recognizing when a policy document omitted international return postage vs inventing carrier rates).
2. **Nemotron 70B Throughput & Efficiency:**
   - In our "Nano" and "Super" tiers for bulk exam evaluation (200+ test cases) and synthetic question generation, Nemotron 70B delivered fast, responsive answers with low token consumption.

### Areas for Improvement & Suggestions
1. **System Prompt Weighting for Negative Constraints:**
   - When temperature was set $\ge 0.3$, Nemotron 70B occasionally favored helpfulness over abstention when asked about knowledge base gaps (e.g. inventing a standard 30-day gift card expiry rather than stating "The documentation does not specify").
   - *Suggestion:* Fine-tune or provide prompt engineering guidance for enterprise RAG abstention behaviors ("cite or abstain").
2. **Context Window Attention on Interspersed Contradictions:**
   - When fed two conflicting documents (`refund_policy.md` stating 30 days and `faq.md` stating 14 days), the model tended to favor whichever chunk appeared second in the context window (recency bias).
   - *Suggestion:* Introduce metadata-aware attention or document authority ranking cues in the Nemotron prompt template.

---

## 3. Nebius Token Factory Platform & API Feedback

### Strengths
1. **Seamless OpenAI SDK Drop-In:**
   - Zero code friction. By pointing `baseURL: 'https://api.studio.nebius.ai/v1'` and passing the standard Bearer token, existing client libraries, streaming listeners, and retry handlers (`p-retry`) worked without modification.
2. **Predictable Per-Token Cost Accounting:**
   - Clear input/output pricing allowed our agent to compute real-time micro-cent costs per query and display cost-benefit trade-offs in our auto-tuning engine.
3. **Low Latency Under Concurrency:**
   - Batch judging across 10 concurrent requests (`p-limit`) showed consistent latency percentiles (p50 ~ 180ms, p95 ~ 320ms for first-chunk streams).

### Actionable Suggestions & Feature Requests
1. **Serverless Batch Inference Endpoint:**
   - For agentic evaluation workflows (e.g., evaluating an entire 500-question exam suite overnight), a dedicated `/v1/batches` endpoint with asynchronous queuing and discounted pricing (like OpenAI Batch API) would be a game-changer for developer workflows and token budgets.
2. **First-Party Embedding & Reranker Support:**
   - While LLM completions are world-class, pairing Nemotron with native NVIDIA NeMo Retriever (e.g., `NV-Embed-v2`) and NeMo Reranker endpoints directly on Nebius Token Factory would eliminate the need for third-party embedding providers and enable end-to-end NVIDIA pipelines.
3. **Usage & Rate Limit Headers in HTTP Responses:**
   - We recommend returning standard headers such as `x-ratelimit-remaining-tokens`, `x-ratelimit-reset`, and `x-nebius-cost-estimate` directly on completion responses, enabling agents to self-throttle dynamically.

---

## 4. Tavily Web Intelligence Integration Feedback

- Combining **Tavily Search** with **Nemotron Super** enabled RAG Doctor to autonomously resolve corporate knowledge base gaps (e.g. fetching FTC CARD Act regulations to draft missing gift card policies).
- Tavily's concise `answer` field and structured source snippets provided ideal token-dense context for Nemotron to draft authoritative Markdown policy diffs.

---

## 5. Conclusion

Nebius Token Factory + NVIDIA Nemotron represents one of the most cost-effective and capable open-infrastructure AI stacks available for agentic engineering. We look forward to seeing deeper NeMo Retriever integrations and batch execution primitives on Nebius AI Cloud!
