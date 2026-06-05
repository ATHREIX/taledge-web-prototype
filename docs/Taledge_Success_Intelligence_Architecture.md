---
title: "Taledge Success Intelligence: Architecture & AI Scoring Algorithm"
author: "Taledge Engineering Team"
date: "June 2026"
---

<style>
  body {
    font-family: 'Inter', -apple-system, sans-serif;
    color: #1e293b;
    line-height: 1.6;
    margin: 40px auto;
    max-width: 900px;
    background-color: #f8fafc;
  }
  h1 {
    color: #0f172a;
    font-size: 2.5rem;
    font-weight: 900;
    text-align: center;
    margin-bottom: 10px;
    border-bottom: 4px solid #4f46e5;
    padding-bottom: 20px;
  }
  h2 {
    color: #4f46e5;
    font-size: 1.8rem;
    font-weight: 800;
    margin-top: 40px;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 8px;
  }
  h3 {
    color: #334155;
    font-size: 1.4rem;
    font-weight: 700;
    margin-top: 30px;
  }
  p {
    font-size: 1.05rem;
    color: #475569;
  }
  .highlight-box {
    background: linear-gradient(135deg, #e0e7ff 0%, #f3e8ff 100%);
    border-left: 5px solid #4f46e5;
    padding: 20px;
    margin: 20px 0;
    border-radius: 8px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 25px 0;
    background-color: #ffffff;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    overflow: hidden;
  }
  th {
    background-color: #f1f5f9;
    color: #334155;
    font-weight: 700;
    text-align: left;
    padding: 14px 16px;
    border-bottom: 2px solid #e2e8f0;
  }
  td {
    padding: 14px 16px;
    border-bottom: 1px solid #f1f5f9;
    color: #475569;
  }
  tr:last-child td {
    border-bottom: none;
  }
  .tag {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 0.85rem;
    font-weight: 700;
    background-color: #fee2e2;
    color: #e11d48;
  }
  .page-break {
    page-break-before: always;
  }
</style>

# Taledge AI Intelligence: Core Architecture & Scoring

<div class="highlight-box">
<strong>Confidential & Proprietary</strong><br>
This document outlines the ultra-complex, world-class algorithmic foundation of the Taledge Dual-Track Success Intelligence Platform. It details the adversarial AI interviewer methodology, cognitive load mapping, and the exact multi-layered calculation of the Fit Score and Success Probability.
</div>

## 1. The Interaction Flow: Continuous Evaluation Loop

The Taledge AI Interviewer is not a static Q&A bot. It operates as an **Adversarial Engineering Leader** (in Technical Mode) and an **Elite Behavioural Psychologist** (in Behavioural Mode). The interaction is continuous, dynamic, and adaptive.

### 1.1 Context Payload & Initialization
Before the interview begins, the frontend compiles a rigid JSON context payload derived from the candidate's parsed resume, target role, and identified academic/project history.

### 1.2 The Adversarial Prompt Engine
The AI is instructed strictly through dynamic role-based prompting. It possesses multilingual abilities (English, Hindi, Hinglish) and adapts instantly.
- **Cognitive Load Stress-Testing:** If a candidate answers a standard technical question perfectly, the AI instantly increases cognitive load by combining concepts or introducing edge-case system failure states to test their working memory.
- **DNLA Psychometric Probing:** In the behavioural phase, the AI actively bypasses generic STAR (Situation, Task, Action, Result) answers to probe emotional regulation, ethical boundaries, and defensive mechanism triggers.

### 1.3 Execution Pipeline
1. **Real-time STT:** Browser-native Webkit SpeechRecognition transcribes the candidate's speech.
2. **LLM Routing:** The transcription is passed to the Taledge API (`/api/interview/voice/route.ts`), which interfaces with OpenRouter to process the transcript through the adversarial persona.
3. **Real-time TTS:** The generated text is vocalized back to the candidate via the browser's native `SpeechSynthesis`.
4. **Proctoring Overlay:** Background listeners track `visibilitychange` events to detect window-switching, applying immediate cheating penalties and logging violation counts.

<div class="page-break"></div>

## 2. The Fit Score & Success Probability Calculation

The ultimate output of the platform is the **Success Potential Score (0-100%)**. This is calculated mathematically across 5 distinct feature matrices evaluated by the LLM post-interview.

### Matrix 1: Technical Interview Signals

| Competency Domain | Extracted AI Metric | Description / Proxy Measure |
|---|---|---|
| **Accuracy & Coverage** | Tech Accuracy Score | Percentage of core domain questions answered correctly. |
| | Difficulty Weighted Accuracy | Weighted correctness (harder questions carry exponential weight). |
| **Problem Solving Depth** | Solution Correctness | Binary mapping of full vs. partial solution. |
| | Approach Structure | Logic decomposition and solution construction pipeline. |
| | Multi-Approach Capability | Did the candidate proactively propose alternative solutions? |
| **Thinking Quality** | Reasoning Clarity | NLP scoring of explanation clarity. |
| | Conceptual Correctness | Even if the final answer failed, were the underlying mechanisms correct? |
| | Error Recovery | Ability to detect and correct their own mistakes under pressure. |
| **Coding Quality** | Efficiency & Correctness | Algorithmic Big-O evaluation and clean code principles. |
| **Micro-Expression Proxies** | Response Latency | Average hesitation time before answering (proxy for confidence). |
| | Latency Variance | Guessing vs. active deep thinking mapping. |
| | Hint Dependency | Frequency of required hints for complex architectures. |

### Matrix 2: Resume & Profile Features

| Competency Domain | Extracted AI Metric | Description / Proxy Measure |
|---|---|---|
| **Skill Mapping** | Skill Match Score | Cosine similarity between parsed resume skills and Job Description. |
| | Core Skill Percentage | Percentage of non-negotiable required skills present. |
| **Project Reality Index**| Project Relevance | Solving a real-world enterprise problem vs. generic academic project. |
| | Impact Quantification | Hard outcomes, user scale, and latency improvements over vague claims. |
| **Academic Signals** | Academic Consistency | Longitudinal grades trend. |

<div class="page-break"></div>

### Matrix 3: DNLA Social Competence Assessment
Imported via APIs from Germany, the DNLA report serves as the baseline psychological profile.
- **Achievement Dynamics:** Drive, Motivation, Self-confidence.
- **Interpersonal Relations:** Empathy, Assertiveness, Sociability.
- **Will to Succeed:** Systematic mentality, Initiative.
- **Stress Capacity:** Feedback reaction, Resilience under pressure, Outlook.

### Matrix 4: Behavioural Interview Features
The AI conducts a targeted interview designed to validate the DNLA baseline against actual anecdotal stress-testing.

| Competency Domain | Extracted AI Metric | Description / Proxy Measure |
|---|---|---|
| **Communication** | Clarity & Structure | STAR approach adherence and calibrated verbosity (too short vs. rambling). |
| **Content Quality** | Relevance & Specificity | Did the response answer the intent? Real examples vs. generalized fluff. |
| **Ownership & Attitude** | Blame vs. Accountability | "I" vs "Team" vs "Them" linguistic indexing when discussing failures. |
| **Consistency Checks** | Internal Consistency | Identifying contradictions across responses and alignment with resume claims. |
| **Cultural Fit** | Collaboration Signal | Perspective-taking and stakeholder map understanding. |

### Matrix 5: Cross-Component Features (The Red Flags)
The final validation layer cross-references data across all 4 previous matrices to identify fatal hiring risks.

| Cross-Component Metric | Warning Condition | System Action |
|---|---|---|
| **Tech vs. Resume Gap** | High resume claims but low technical interview performance. | <span class="tag">RED FLAG</span> |
| **Confidence vs. Accuracy** | High confidence linguistic markers with low actual accuracy (Overconfidence). | <span class="tag">RED FLAG</span> |
| **Behaviour vs. DNLA** | Claimed personality traits in DNLA do not match interview actions. | Score Penalty |

## 3. Final Aggregation

The final Fit Score is an algorithmic synthesis of the above 5 matrices. By combining the rigid diagnostic power of German psychometrics (DNLA) with an Adversarial AI technical evaluation, the Taledge platform achieves what no other system can: **a truly holistic, deeply human, yet computationally flawless measure of success probability.**
