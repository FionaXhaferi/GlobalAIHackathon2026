import { Clock, AlertTriangle } from 'lucide-react'

interface Step {
  step: number
  title: string
  description: string
  duration: string
  notes: string
}

interface Protocol {
  overview: string
  steps: Step[]
}

interface Props {
  protocol: Protocol
}

export default function ProtocolSection({ protocol }: Props) {
  if (!protocol) return <p className="text-slate-400 text-sm">No protocol data available.</p>

  return (
    <div className="space-y-6">
      {/* Overview */}
      {protocol.overview && (
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{protocol.overview}</p>
        </div>
      )}

      {/* Steps */}
      <div className="space-y-4">
        {(protocol.steps ?? []).map((step) => (
          <div key={step.step} className="flex gap-4 group">
            {/* Step number */}
            <div className="flex-shrink-0 pt-1">
              <div className="w-8 h-8 rounded-full bg-navy-700 text-white text-xs font-bold
                              flex items-center justify-center group-hover:bg-navy-800 transition-colors">
                {step.step}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 pb-4 border-b border-slate-100 last:border-0">
              <div className="flex items-start justify-between gap-3 mb-1">
                <h3 className="font-semibold text-slate-800 text-sm">{step.title}</h3>
                {step.duration && (
                  <span className="flex items-center gap-1 text-xs text-slate-500 flex-shrink-0
                                   bg-slate-100 px-2 py-0.5 rounded-full">
                    <Clock className="w-3 h-3" />
                    {step.duration}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {step.description}
              </p>
              {step.notes && (
                <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700 leading-relaxed">{step.notes}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
