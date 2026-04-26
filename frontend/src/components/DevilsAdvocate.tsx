import { useState } from 'react'
import { Flame, AlertTriangle, Info, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import type { DevilsAdvocateResult, Critique } from '../types'

interface Props {
  result: DevilsAdvocateResult | null
  loading: boolean
  error: string | null
}

const SEVERITY_STYLES: Record<Critique['severity'], { bar: string; badge: string; label: string }> = {
  high:   { bar: 'border-l-red-500',    badge: 'bg-red-100 text-red-700',    label: 'Critical' },
  medium: { bar: 'border-l-amber-400',  badge: 'bg-amber-100 text-amber-700', label: 'Moderate' },
  low:    { bar: 'border-l-slate-300',  badge: 'bg-slate-100 text-slate-600', label: 'Minor' },
}

const SEVERITY_ICON: Record<Critique['severity'], typeof Flame> = {
  high:   Flame,
  medium: AlertTriangle,
  low:    Info,
}

function InfoButton() {
  return (
    <div className="relative group flex-shrink-0 ml-auto">
      <button className="w-5 h-5 rounded-full bg-red-200 text-red-600 text-xs font-bold flex items-center justify-center hover:bg-red-300 transition-colors">
        i
      </button>
      <div className="absolute right-0 top-7 w-72 bg-slate-800 text-white text-xs rounded-xl p-3 shadow-xl z-20
                      opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity leading-relaxed">
        <p className="font-semibold mb-1">What is the Devil's Advocate?</p>
        A separate AI agent attacks your plan like a tough peer reviewer — looking for missing controls, underpowered statistics, wrong assumptions, confounded variables, and safety gaps. It has no knowledge of the plan generator, so its critique is fully independent.
      </div>
    </div>
  )
}

export default function DevilsAdvocate({ result, loading, error }: Props) {
  if (loading) {
    return (
      <div className="card border border-red-100 bg-red-50/40">
        <div className="flex items-center gap-3">
          <Flame className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-red-800">Devil's Advocate is reviewing your plan…</p>
            <p className="text-xs text-red-500 mt-0.5">Finding flaws before you order materials</p>
          </div>
          <Loader2 className="w-4 h-4 text-red-400 animate-spin flex-shrink-0" />
          <InfoButton />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card border border-slate-200 bg-slate-50">
        <div className="flex items-center gap-3">
          <Flame className="w-5 h-5 text-slate-400 flex-shrink-0" />
          <p className="text-sm text-slate-500 flex-1">Devil's Advocate unavailable: {error}</p>
          <InfoButton />
        </div>
      </div>
    )
  }

  if (!result) return null

  if (result.critiques.length === 0) {
    if (result.parse_error) {
      return (
        <div className="card border border-amber-200 bg-amber-50/40 animate-fade-in">
          <div className="flex items-center gap-3">
            <Flame className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-800">Devil's Advocate could not complete</p>
              <p className="text-xs text-amber-600 mt-0.5">The critique agent returned an unexpected response. Try regenerating the plan.</p>
            </div>
            <InfoButton />
          </div>
        </div>
      )
    }
    return (
      <div className="card border border-emerald-200 bg-emerald-50/40 animate-fade-in">
        <div className="flex items-center gap-3">
          <Flame className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-emerald-800">Devil's Advocate found no critical flaws</p>
            <p className="text-xs text-emerald-600 mt-0.5">{result.verdict}</p>
          </div>
          <InfoButton />
        </div>
      </div>
    )
  }

  const highCount = result.critiques.filter(c => c.severity === 'high').length
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="card border border-red-200 bg-red-50/30 animate-fade-in">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-start gap-3 text-left"
      >
        <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Flame className="w-4 h-4 text-red-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-red-800">Devil's Advocate</p>
          <p className="text-xs text-red-600 mt-0.5">
            {highCount > 0
              ? `${highCount} critical flaw${highCount > 1 ? 's' : ''} found — fix before ordering materials`
              : 'No critical flaws, but review these before proceeding'}
          </p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-red-400 flex-shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-red-400 flex-shrink-0 mt-1" />}
        <InfoButton />
      </button>

      {expanded && (
        <>
          <div className="space-y-3 mt-4">
            {result.critiques.map((c, i) => {
              const styles = SEVERITY_STYLES[c.severity] ?? SEVERITY_STYLES.low
              const Icon = SEVERITY_ICON[c.severity] ?? Info
              return (
                <div key={i} className={`rounded-lg bg-white border-l-4 ${styles.bar} px-4 py-3 shadow-sm`}>
                  <div className="flex items-start gap-2 mb-1">
                    <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-current opacity-70" />
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${styles.badge}`}>
                        {styles.label}
                      </span>
                      <span className="text-xs text-slate-400 capitalize">{c.section}</span>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-slate-800 mb-1">{c.issue}</p>
                  <p className="text-xs text-slate-500">
                    <span className="font-semibold text-slate-600">Fix: </span>{c.suggestion}
                  </p>
                </div>
              )
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-red-100">
            <p className="text-xs text-red-700 italic">{result.verdict}</p>
          </div>
        </>
      )}
    </div>
  )
}
