import { useState } from 'react'
import { CheckCircle2, XCircle, Target, BarChart3, Layers, Repeat, ChevronDown, ChevronUp } from 'lucide-react'
import type { ValidationApproach } from '../types'

interface Props {
  validation: ValidationApproach
}

function ExpandableText({ text, maxChars = 180 }: { text: string; maxChars?: number }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = text.length > maxChars

  return (
    <div>
      <p className="text-sm text-slate-700 leading-relaxed">
        {isLong && !expanded ? text.slice(0, maxChars).trimEnd() + '…' : text}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1.5 flex items-center gap-1 text-xs text-navy-600 hover:text-navy-800 font-medium"
        >
          {expanded ? <><ChevronUp className="w-3 h-3" />Show less</> : <><ChevronDown className="w-3 h-3" />Show more</>}
        </button>
      )}
    </div>
  )
}

export default function ValidationSection({ validation }: Props) {
  if (!validation) return <p className="text-slate-400 text-sm">No validation data available.</p>

  return (
    <div className="space-y-4">
      
      <div className="grid sm:grid-cols-2 gap-4">
        {validation.primary_endpoints?.length > 0 && (
          <div className="rounded-xl bg-navy-50 border border-navy-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-navy-700" />
              <span className="text-xs font-bold text-navy-700 uppercase tracking-wide">Primary Endpoints</span>
            </div>
            <ul className="space-y-1.5">
              {validation.primary_endpoints.map((ep, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-navy-800">
                  <span className="text-navy-400 mt-0.5 flex-shrink-0">•</span>{ep}
                </li>
              ))}
            </ul>
          </div>
        )}
        {validation.secondary_endpoints?.length > 0 && (
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Secondary Endpoints</span>
            </div>
            <ul className="space-y-1.5">
              {validation.secondary_endpoints.map((ep, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="text-slate-300 mt-0.5 flex-shrink-0">•</span>{ep}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Success Criteria</span>
          </div>
          <ul className="space-y-1.5">
            {(validation.success_criteria ?? []).map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-emerald-800">
                <span className="text-emerald-400 mt-0.5 flex-shrink-0">✓</span>{c}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl bg-red-50 border border-red-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-red-600" />
            <span className="text-xs font-bold text-red-800 uppercase tracking-wide">Failure Criteria</span>
          </div>
          <ul className="space-y-1.5">
            {(validation.failure_criteria ?? []).map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-red-800">
                <span className="text-red-400 mt-0.5 flex-shrink-0">✗</span>{c}
              </li>
            ))}
          </ul>
        </div>
      </div>

      
      <div className="grid sm:grid-cols-3 gap-4">
        {validation.statistical_approach && (
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Statistics</span>
            </div>
            <ExpandableText text={validation.statistical_approach} maxChars={160} />
          </div>
        )}
        {validation.controls?.length > 0 && (
          <div className="rounded-xl bg-violet-50 border border-violet-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-4 h-4 text-violet-600" />
              <span className="text-xs font-bold text-violet-800 uppercase tracking-wide">Controls</span>
            </div>
            <ul className="space-y-1.5">
              {validation.controls.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-violet-800">
                  <span className="text-violet-400 mt-0.5 flex-shrink-0">•</span>{c}
                </li>
              ))}
            </ul>
          </div>
        )}
        {validation.replicates && (
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Repeat className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">Replicates</span>
            </div>
            <ExpandableText text={validation.replicates} maxChars={160} />
          </div>
        )}
      </div>
    </div>
  )
}
