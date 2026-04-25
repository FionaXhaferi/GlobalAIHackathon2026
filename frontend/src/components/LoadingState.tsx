import { useEffect, useState, useRef } from 'react'
import { Loader2, Brain } from 'lucide-react'
import type { FeedbackUsedEvent } from '../api'

interface Props {
  title: string
  subtitle?: string
  steps?: string[]
  streamingText?: string
  feedbackUsed?: FeedbackUsedEvent | null
}

export default function LoadingState({ title, subtitle, steps = [], streamingText, feedbackUsed }: Props) {
  const [activeStep, setActiveStep] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(Date.now())
  const allDone = activeStep >= steps.length - 1 && steps.length > 0

  // Advance steps on a timer
  useEffect(() => {
    if (!steps.length) return
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev))
    }, 2400)
    return () => clearInterval(interval)
  }, [steps.length])

  // Elapsed time counter
  useEffect(() => {
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="card animate-fade-in">
      {/* Spinner + title */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-xl bg-navy-50 flex items-center justify-center flex-shrink-0">
          <Loader2 className="w-6 h-6 text-navy-700 animate-spin" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-navy-700 text-lg">{title}</h2>
            <span className="text-xs text-slate-400 tabular-nums">{elapsed}s</span>
          </div>
          {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>

      {/* Feedback used banner */}
      {feedbackUsed && feedbackUsed.count > 0 && (
        <div className="mb-5 rounded-xl bg-violet-50 border border-violet-200 px-4 py-3 flex items-start gap-3 animate-fade-in">
          <Brain className="w-4 h-4 text-violet-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-violet-800">
              Incorporating {feedbackUsed.count} expert correction{feedbackUsed.count > 1 ? 's' : ''} from similar experiments
            </p>
            <ul className="mt-1 space-y-0.5">
              {feedbackUsed.corrections.map((c, i) => (
                <li key={i} className="text-xs text-violet-600 flex items-center gap-1.5">
                  <span className="font-semibold capitalize">{c.section}</span>
                  <span className="text-violet-400">·</span>
                  <span>★ {c.rating}/5</span>
                  {c.annotation && <span className="text-violet-500 italic truncate max-w-[240px]">"{c.annotation}"</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Progress steps */}
      {steps.length > 0 && (
        <div className="space-y-2.5 mb-6">
          {steps.map((step, i) => {
            const done = i < activeStep
            const active = i === activeStep
            return (
              <div key={step} className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                                 flex-shrink-0 transition-all duration-500 ${
                  done   ? 'bg-emerald-500 text-white' :
                  active ? 'bg-navy-700 text-white' :
                           'bg-slate-200 text-slate-400'
                }`}>
                  {done ? '✓' : active ? <span className="animate-pulse">•</span> : '·'}
                </div>
                <span className={`text-sm transition-colors duration-300 ${
                  done   ? 'text-emerald-600 line-through decoration-emerald-300' :
                  active ? 'text-navy-700 font-medium' :
                           'text-slate-400'
                }`}>
                  {step}
                </span>
              </div>
            )
          })}

          {/* "Still working" message once all steps are marked done */}
          {allDone && (
            <div className="flex items-center gap-3 animate-fade-in">
              <div className="w-5 h-5 rounded-full bg-navy-100 flex items-center justify-center flex-shrink-0">
                <Loader2 className="w-3 h-3 text-navy-500 animate-spin" />
              </div>
              <span className="text-sm text-slate-500 italic">
                Still generating — complex plans take 30–60 s…
              </span>
            </div>
          )}
        </div>
      )}

      {/* Streaming preview */}
      {streamingText && (
        <div className="rounded-xl bg-slate-900 p-4 max-h-48 overflow-y-auto">
          <p className="text-xs font-mono text-emerald-400 leading-relaxed whitespace-pre-wrap">
            {streamingText.slice(-1200)}
            <span className="streaming-cursor" />
          </p>
        </div>
      )}

      {/* Animated progress bar (shown when no stream preview) */}
      {!streamingText && (
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-navy-500 to-science-teal rounded-full"
            style={{ animation: 'loading 2.5s ease-in-out infinite' }}
          />
        </div>
      )}

      <style>{`
        @keyframes loading {
          0%   { width: 0%;  margin-left: 0%; }
          50%  { width: 60%; margin-left: 20%; }
          100% { width: 0%;  margin-left: 100%; }
        }
      `}</style>
    </div>
  )
}
