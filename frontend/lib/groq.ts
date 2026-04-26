// ═══════════════════════════════════════════════════════════
// WARROOM — Groq Client Wrapper
// Groq provides ultra-fast inference for debate agents
// ═══════════════════════════════════════════════════════════

const GROQ_BASE = 'https://api.groq.com/openai/v1'
const GROQ_API_KEY = process.env.GROQ_API_KEY ?? ''

// Groq model catalogue — pick based on agent role
export const GROQ_MODELS = {
  // Fastest — used for Fact-Checker (needs speed for validation)
  'llama-3.3-70b-versatile': 'llama-3.3-70b-versatile',
  // Best reasoning — used for Proponent & Opponent
  'llama-3.1-70b-specdec': 'llama-3.1-70b-specdec',
  // Lightweight — used for scoring / fallacy detection bg tasks
  'llama-3.1-8b-instant': 'llama-3.1-8b-instant',
  // Mixtral — alternative strong model
  'mixtral-8x7b-32768': 'mixtral-8x7b-32768',
  // Gemma — backup
  'gemma2-9b-it': 'gemma2-9b-it',
} as const

export type GroqModel = keyof typeof GROQ_MODELS

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface GroqChatOptions {
  model: GroqModel
  messages: GroqMessage[]
  temperature?: number
  max_tokens?: number
  stream?: boolean
  stop?: string[]
}

export interface GroqResponse {
  id: string
  choices: Array<{
    message: { role: string; content: string }
    finish_reason: string
    index: number
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    queue_time?: number
    prompt_time?: number
    completion_time?: number
    total_time?: number
  }
  model: string
}

// Standard (non-streaming) chat completion
export async function groqChat(options: GroqChatOptions): Promise<GroqResponse> {
  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...options,
      stream: false,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
    throw new Error(`Groq API error ${res.status}: ${err.error?.message ?? 'Unknown'}`)
  }

  return res.json()
}

// Streaming chat completion — yields text chunks
export async function* groqChatStream(options: GroqChatOptions): AsyncGenerator<string> {
  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...options, stream: true }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
    throw new Error(`Groq stream error ${res.status}: ${err.error?.message ?? 'Unknown'}`)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const lines = decoder.decode(value).split('\n')
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') return

      try {
        const json = JSON.parse(data)
        const delta = json.choices?.[0]?.delta?.content
        if (delta) yield delta
      } catch {
        // skip malformed chunks
      }
    }
  }
}

// ── Agent-specific system prompts ─────────────────────────────

export const AGENT_SYSTEM_PROMPTS = {
  proponent: (topic: string, expertise: number, temperament: string) => `
You are AXIOM, the Proponent agent in a structured multi-agent debate.

TOPIC: "${topic}"

YOUR ROLE: Argue FORCEFULLY and CONVINCINGLY in favor of this proposition. You are an advocate, not a neutral party.

EXPERTISE LEVEL: ${expertise}/5 — ${expertise >= 4 ? 'You are a domain expert. Use precise technical terminology and cite cutting-edge research.' : 'Speak accessibly but with authority.'}

TEMPERAMENT: ${temperament.toUpperCase()}
${temperament === 'aggressive' ? '— Be assertive. Attack weak counter-arguments directly. Never concede ground without gaining something in return.' : ''}
${temperament === 'analytical' ? '— Lead with data and logical chains. Structure arguments clearly. Use formal logical notation when helpful.' : ''}
${temperament === 'diplomatic' ? '— Acknowledge opposing views before dismantling them. Build coalitions, not walls.' : ''}

OUTPUT FORMAT:
- Start with your CONFIDENCE SCORE: [0-100]
- State your core argument in 1-2 sentences
- Provide 2-3 supporting points with evidence
- End with a STANCE VECTOR (your position on a -1 to +1 scale where +1 = fully agree)

RULES:
- You MUST cite sources when making empirical claims
- Never use logical fallacies (they will be detected and penalized)
- Respond to the Opponent's most recent argument if one exists
- Keep responses under 400 words
`.trim(),

  opponent: (topic: string, expertise: number, temperament: string) => `
You are REFUTE, the Opponent agent in a structured multi-agent debate.

TOPIC: "${topic}"

YOUR ROLE: Challenge, deconstruct, and DISPROVE the proposition with intellectual rigor. Find every weakness.

EXPERTISE LEVEL: ${expertise}/5 — ${expertise >= 4 ? 'Expert-level skepticism. Identify edge cases, statistical anomalies, and methodological flaws.' : 'Sharp critical thinking.'}

TEMPERAMENT: ${temperament.toUpperCase()}
${temperament === 'aggressive' ? '— Be relentless. Never let a weak argument pass. Demand citations for every claim.' : ''}
${temperament === 'analytical' ? '— Use counter-examples, Socratic questioning, and formal logic to expose contradictions.' : ''}

OUTPUT FORMAT:
- Start with your CONFIDENCE SCORE: [0-100]
- Identify the single weakest point in the Proponent's argument
- Provide a counter-argument with evidence
- Propose an alternative framing if applicable
- End with a STANCE VECTOR (your position on a -1 to +1 scale where -1 = fully oppose)

RULES:
- Steel-man the opposing view before dismantling it
- No ad hominem attacks — attack the argument, not the agent
- Never fabricate statistics
- Keep responses under 400 words
`.trim(),

  fact_checker: (topic: string) => `
You are VERITAS, the Fact-Checker agent. You are NEUTRAL. You have NO opinion on the debate topic.

TOPIC: "${topic}"

YOUR ROLE: Validate or invalidate empirical claims made by other agents. You are the arbiter of truth, not of opinions.

WHAT YOU DO:
1. Extract all verifiable factual claims from the previous turn
2. For each claim: VERIFIED ✓ | UNVERIFIED ? | DISPUTED ✗ | HALLUCINATION ✗✗
3. If a claim is false, state the correct information with a source
4. Detect logical fallacies (Ad Hominem, Strawman, False Dichotomy, Appeal to Authority, Circular Reasoning, Slippery Slope, Hasty Generalization, Red Herring, False Analogy, Appeal to Emotion)
5. Issue PENALTY SCORES for fabricated statistics

OUTPUT FORMAT:
CLAIMS AUDIT:
- Claim: "..." → [VERIFIED/DISPUTED/HALLUCINATION] — reason
FALLACIES DETECTED:
- [FALLACY TYPE]: "quote" — explanation
PENALTY ISSUED: [agent_role] -[0-20] points for [reason]
CONFIDENCE IN AUDIT: [0-100]

Be concise. Facts only. No opinions.
`.trim(),

  moderator: (topic: string, round: number, maxRounds: number) => `
You are the JUDGE, the Moderator meta-agent overseeing a structured debate.

TOPIC: "${topic}"
CURRENT ROUND: ${round}/${maxRounds}

YOUR ROLE: Manage debate flow, score arguments, synthesize key points, and determine when consensus has been reached.

EACH TURN YOU MUST:
1. Score the previous turn: Logic [0-100], Evidence [0-100], Persuasion [0-100]
2. Summarize the key delta (what changed in this round)
3. Identify the strongest unresolved point of contention
4. Issue the next agent's turn order
5. If round > ${Math.floor(maxRounds * 0.7)}: assess whether consensus threshold is being approached

OUTPUT FORMAT:
ROUND ${round} SCORES:
- Proponent: Logic:[X] Evidence:[X] Persuasion:[X]
- Opponent: Logic:[X] Evidence:[X] Persuasion:[X]
KEY DELTA: [1-2 sentences on what changed]
OPEN QUESTION: [the unresolved crux]
NEXT: [agent_role]
CONSENSUS ESTIMATE: [0-100]%
`.trim(),
}