# RAG Doctor 🩺 — 3-Minute Video Demo Script
**NVIDIA × Nebius Global AI Hackathon (Best Apps & Agents Track)**

**Target Duration:** 2 minutes 45 seconds (Under the 3:00 max rule)  
**Presenter:** AI Engineer / Builder  
**Screen Setup:** Full screen on `http://localhost:3000` with dark mode enabled  

---

## Timeline & Narration

### [0:00 – 0:30] The Hook & The Problem
- **Visual:** Open on the RAG Doctor Dashboard with the circular Health Score gauge displaying `64% ATTENTION REQUIRED`.
- **Narration:**
  > "Hi everyone, welcome to RAG Doctor! Enterprise RAG chatbots fail in production every day—not because LLMs are broken, but because corporate knowledge bases contain silent contradictions, unwritten policy gaps, and poor chunk retrieval. Manually debugging these failures takes engineering teams hundreds of hours.
  > 
  > RAG Doctor is an autonomous agent that acts as an MRI machine and surgeon for enterprise RAG systems. It automatically evaluates, diagnoses root causes, and self-tunes your RAG pipeline—powered by NVIDIA Nemotron open source models served on Nebius Token Factory."

---

### [0:30 – 1:05] NVIDIA Nemotron Tri-Tier Architecture on Nebius Token Factory
- **Visual:** Scroll down to the Tri-Tier Model Routing Matrix card. Hover over Nano, Super, and Ultra tiers.
- **Narration:**
  > "To maximize reasoning power while driving inference cost down, RAG Doctor routes tasks across three distinct NVIDIA Nemotron tiers on Nebius Token Factory:
  > - **Nemotron Nano** handles bulk RAG answering across hundreds of exam queries with sub-200ms latency.
  > - **Nemotron Super** generates complex synthetic test exams from documents and drafts documentation patches.
  > - **Nemotron Ultra** serves as our strict LLM Judge and root-cause diagnostician.
  >
  > Nebius Token Factory’s OpenAI-compatible endpoints gave us instant low-latency inference with micro-cent cost accounting visible right here in our live token ledger."

---

### [1:05 – 1:40] 1-Click Complete Checkup & Root-Cause Failure Diagnosis
- **Visual:** Click the glowing green **"1-Click Complete Checkup"** button in the header. Watch the progress bar advance through Steps 1 to 4 in real time. Switch to the **Root-Cause Failure Diagnosis** tab.
- **Narration:**
  > "Let's click '1-Click Complete Checkup'. In seconds, the agent executes our benchmark exam, clusters failures, audits our 19 corporate documents, and runs hyperparameter tuning.
  >
  > Look at our diagnosis tab. Instead of generic error messages, Nemotron Ultra clusters failures into clinical defect categories:
  > 1. Top-K Retrieval Misses
  > 2. Corporate Document Contradictions
  > 3. Hallucinations on Knowledge Gaps
  >
  > Notice the medical prescriptions: Nemotron prescribes switching from naive BM25 to Hybrid Reciprocal Rank Fusion (RRF) and adding negative guardrails."

---

### [1:40 – 2:15] Knowledge Base Audit & Tavily Web Intelligence Integration
- **Visual:** Switch to the **Knowledge Base Audit & Tavily** tab. Show the Contradictions table (C1 to C4) and click **"Apply Harmonization Patch"** on C1. Then show the Knowledge Gaps section and click **"Research via Tavily & Draft Patch"** on G1.
- **Narration:**
  > "RAG Doctor doesn’t just tune code; it fixes the underlying knowledge base!
  >
  > Here in our Knowledge Base Audit, it pinpointed four exact contradictions: for instance, refund_policy.md claims 30 days, while faq.md claims 14 days. With one click, RAG Doctor applies a single-source-of-truth patch directly to the file!
  >
  > Even better: for our $3,000 Tavily track bonus, when RAG Doctor discovers an unwritten gap—like missing international return shipping—it triggers a live Tavily web search, retrieves FTC and e-commerce standards, and has Nemotron Super draft an enterprise-grade Markdown policy section ready to merge!"

---

### [2:15 – 2:45] Auto-Tuning Engine: Before vs After & Wrap-up
- **Visual:** Switch to the **Auto-Tuner (Before vs After)** tab. Hover over the Recharts comparison bar chart and scorecard.
- **Narration:**
  > "Finally, let’s look at the Auto-Tuner. By exploring chunk sizes, top-k values, and hybrid RRF weights, RAG Doctor proves measurable before-and-after improvement:
  > - **Accuracy jumped by +32.5%** (from 62.5% to 95%)
  > - **Retrieval Hit Rate reached 100%**
  > - **Hallucinations dropped by 80%**
  >
  > All running on open, independent infrastructure with NVIDIA Nemotron and Nebius Token Factory. The code is 100% open source under MIT. Thank you!"
