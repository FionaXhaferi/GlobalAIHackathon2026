import type { LiteratureResult, ExperimentPlan, FeedbackPayload, ReadinessScore } from './types';

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api';

export async function checkLiterature(question: string): Promise<LiteratureResult> {
  const res = await fetch(`${BASE}/literature-qc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Cannot reach the backend — make sure start_backend.bat is running on port 8000.' }));
    throw new Error(err.detail || 'Literature QC failed');
  }
  return res.json();
}

export interface FeedbackUsedEvent {
  count: number;
  corrections: { section: string; rating: number; annotation: string }[];
}

export async function streamPlan(
  question: string,
  literatureContext: LiteratureResult | null,
  onChunk: (text: string) => void,
  onDone: (plan: ExperimentPlan) => void,
  onError: (msg: string) => void,
  onFeedbackUsed?: (event: FeedbackUsedEvent) => void,
): Promise<void> {
  const res = await fetch(`${BASE}/generate-plan/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      literature_context: literatureContext ?? {},
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Server error' }));
    onError(err.detail || 'Plan generation failed');
    return;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const event = JSON.parse(line.slice(6));
        if (event.type === 'chunk') onChunk(event.text ?? '');
        else if (event.type === 'done') onDone(event.plan as ExperimentPlan);
        else if (event.type === 'error') onError(event.message ?? 'Unknown error');
        else if (event.type === 'feedback_used') onFeedbackUsed?.(event as FeedbackUsedEvent);
      } catch {
        // partial line — wait for next chunk
      }
    }
  }
}

export async function scorePlan(question: string, plan: ExperimentPlan): Promise<ReadinessScore> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60_000)
  try {
    const res = await fetch(`${BASE}/score-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, plan }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Scoring failed' }))
      throw new Error(err.detail || 'Scoring failed')
    }
    return res.json()
  } finally {
    clearTimeout(timeout)
  }
}

export async function submitFeedback(payload: FeedbackPayload): Promise<void> {
  const res = await fetch(`${BASE}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to save feedback');
}
