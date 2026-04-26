import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import type { ReadinessScore as ScoreType } from '../types'

interface Props {
  score: ScoreType | null
  loading: boolean
  error?: string | null
}

const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function scoreColor(n: number): string {
  if (n >= 80) return '#10b981'  // emerald
  if (n >= 65) return '#3b82f6'  // blue
  if (n >= 50) return '#f59e0b'  // amber
  return '#ef4444'               // red
}

function scoreLabel(n: number): string {
  if (n >= 85) return 'Lab-Ready'
  if (n >= 70) return 'Good'
  if (n >= 55) return 'Needs Work'
  return 'Incomplete'
}

function CircleGauge({ target, color }: { target: number; color: string }) {
  const [displayed, setDisplayed] = useState(0)

  useEffect(() => {
    if (target === 0) return
    let start: number | null = null
    const duration = 1200

    const step = (ts: number) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)  // ease-out cubic
      setDisplayed(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target])

  const filled = (displayed / 100) * CIRCUMFERENCE

  return (
    <svg width="140" height="140" viewBox="0 0 140 140" className="drop-shadow-sm">
      
      <circle cx="70" cy="70" r={RADIUS} fill="none" stroke="#e2e8f0" strokeWidth="12" />
      
      <circle
        cx="70" cy="70" r={RADIUS} fill="none"
        stroke={color} strokeWidth="12" strokeLinecap="round"
        strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
        transform="rotate(-90 70 70)"
        style={{ transition: 'stroke-dasharray 0.05s linear' }}
      />
      
      <text
        x="70" y="64" textAnchor="middle"
        className="font-extrabold"
        style={{ fontSize: 28, fontWeight: 800, fill: color, fontFamily: 'Inter, sans-serif' }}
      >
        {displayed}
      </text>
      
      <text
        x="70" y="80" textAnchor="middle"
        style={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'Inter, sans-serif' }}
      >
        /100
      </text>
      
      <text
        x="70" y="98" textAnchor="middle"
        style={{ fontSize: 11, fontWeight: 700, fill: color, fontFamily: 'Inter, sans-serif' }}
      >
        {scoreLabel(displayed)}
      </text>
    </svg>
  )
}

function SubScoreBar({ label, icon, score, feedback }: {
  label: string; icon: string; score: number; feedback: string
}) {
  const [width, setWidth] = useState(0)
  const color = scoreColor(score)

  useEffect(() => {
    const t = setTimeout(() => setWidth(score), 150)
    return () => clearTimeout(t)
  }, [score])

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
          <span>{icon}</span>
          {label}
        </span>
        <span className="text-xs font-bold tabular-nums" style={{ color }}>
          {score}
        </span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-1.5">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
      <p className="text-xs text-slate-400 leading-snug line-clamp-2" title={feedback}>
        {feedback}
      </p>
    </div>
  )
}

export default function ReadinessScore({ score, loading, error }: Props) {
  if (loading && !score) {
    return (
      <div className="card border-l-4 border-l-slate-300 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-[140px] h-[140px] rounded-full bg-slate-100 flex-shrink-0 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
          </div>
          <div className="flex-1 space-y-3">
            <div className="h-4 bg-slate-100 rounded w-48" />
            <p className="text-sm text-slate-400">Scoring plan against lab readiness criteria…</p>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-2 bg-slate-100 rounded-full" style={{ width: `${60 + i * 5}%` }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!score) return (
    <div className="card border-l-4 border-l-slate-200">
      <div className="flex items-center gap-2 text-slate-400">
        <span className="text-lg">🎯</span>
        <p className="text-sm">"Lab on Monday" Readiness Score — {error ?? 'unavailable'}</p>
      </div>
    </div>
  )

  const color = scoreColor(score.overall)
  const subScoreEntries = Object.values(score.sub_scores)

  return (
    <div
      className="card border-l-4 animate-slide-up"
      style={{ borderLeftColor: color }}
    >
      
      <div className="flex items-center gap-2 mb-5">
        <span className="text-lg">🎯</span>
        <h2 className="font-extrabold text-navy-700 text-lg">"Lab on Monday" Readiness Score</h2>
        <div className="relative ml-auto group flex-shrink-0">
          <button className="w-5 h-5 rounded-full bg-slate-200 text-slate-500 text-xs font-bold flex items-center justify-center hover:bg-slate-300 transition-colors">
            i
          </button>
          <div className="absolute right-0 top-7 w-72 bg-slate-800 text-white text-xs rounded-xl p-3 shadow-xl z-20
                          opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity leading-relaxed">
            <p className="font-semibold mb-1">What is the Readiness Score?</p>
            A second AI scores your generated plan against 6 lab criteria: protocol completeness, reagent availability, budget realism, statistical power, safety coverage, and citation density. The score reflects whether a real PI could order materials and run this experiment immediately.
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-6">
        
        <div className="flex flex-col items-center gap-3 flex-shrink-0">
          <CircleGauge target={score.overall} color={color} />
          <p className="text-xs text-slate-500 text-center max-w-[140px] leading-snug italic">
            "{score.verdict}"
          </p>
        </div>

        
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          {subScoreEntries.map((sub) => (
            <SubScoreBar
              key={sub.label}
              label={sub.label}
              icon={sub.icon}
              score={sub.score}
              feedback={sub.feedback}
            />
          ))}
        </div>
      </div>

      {score.top_issues && score.top_issues.length > 0 && (
        <div className="mt-5 pt-4 border-t border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            Top Issues to Address
          </p>
          <ul className="space-y-1">
            {score.top_issues.map((issue, i) => (
              <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                <span className="text-amber-400 mt-0.5 flex-shrink-0">▸</span>
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
