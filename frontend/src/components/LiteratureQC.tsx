import { BookOpen, ExternalLink, CheckCircle2, AlertCircle, XCircle, Sparkles, ArrowRight } from 'lucide-react'
import type { LiteratureResult, NoveltySignal } from '../types'

interface Props {
  result: LiteratureResult
  question: string
  onGeneratePlan?: () => void
}

const SIGNAL_CONFIG: Record<NoveltySignal, {
  label: string
  className: string
  icon: React.ReactNode
  description: string
}> = {
  not_found: {
    label: 'Novel — Not Found',
    className: 'badge-not-found',
    icon: <CheckCircle2 className="w-4 h-4" />,
    description: 'No closely related work found. This hypothesis appears to be novel territory.',
  },
  similar_exists: {
    label: 'Similar Work Exists',
    className: 'badge-similar',
    icon: <AlertCircle className="w-4 h-4" />,
    description: 'Related work exists, but your specific hypothesis/conditions appear untested.',
  },
  exact_match: {
    label: 'Exact Match Found',
    className: 'badge-exact-match',
    icon: <XCircle className="w-4 h-4" />,
    description: 'A nearly identical experiment has been published. Consider refining your hypothesis.',
  },
}

export default function LiteratureQC({ result, question: _question, onGeneratePlan }: Props) {
  const cfg = SIGNAL_CONFIG[result.novelty_signal] ?? SIGNAL_CONFIG.similar_exists

  return (
    <div className="card animate-slide-up space-y-5">
      
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5 text-navy-700" />
          </div>
          <div>
            <h2 className="font-bold text-navy-700 text-lg">Literature QC</h2>
            <p className="text-sm text-slate-500">
              {result.sources_searched && result.sources_searched.length > 0
                ? result.sources_searched.join(' · ')
                : 'Semantic Scholar · PubMed · arXiv'}
            </p>
          </div>
        </div>
        <span className={cfg.className}>
          {cfg.icon}
          {cfg.label}
        </span>
      </div>

      
      <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
        <p className="text-sm text-slate-700 leading-relaxed">{result.summary}</p>
      </div>

      <p className="text-xs text-slate-500">{cfg.description}</p>

      
      {result.references && result.references.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Relevant Prior Work
          </h3>
          {result.references.map((ref, i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-200 p-4 hover:border-navy-200 hover:bg-navy-50/30 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 leading-snug">{ref.title}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {ref.authors?.slice(0, 3).join(', ')}
                    {ref.authors?.length > 3 ? ' et al.' : ''} · {ref.year}
                  </p>
                  {ref.relevance_reason && (
                    <p className="text-xs text-navy-600 mt-2 italic">"{ref.relevance_reason}"</p>
                  )}
                </div>
                {ref.url && (
                  <a
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 text-slate-400 hover:text-navy-600 transition-colors"
                    title="Open paper"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      
      {onGeneratePlan && (
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Ready to generate your full experiment plan?
          </p>
          <button onClick={onGeneratePlan} className="btn-primary">
            <Sparkles className="w-4 h-4" />
            Generate Plan
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
