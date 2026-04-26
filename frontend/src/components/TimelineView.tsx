import type { Timeline } from '../types'

interface Props {
  timeline: Timeline
}

const PHASE_COLORS = [
  'bg-blue-600',
  'bg-violet-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-red-500',
  'bg-teal-600',
  'bg-pink-600',
]

export default function TimelineView({ timeline }: Props) {
  if (!timeline || !timeline.phases?.length) {
    return <p className="text-slate-400 text-sm">No timeline data available.</p>
  }

  const totalWeeks = timeline.total_weeks || Math.max(...timeline.phases.map((p) => p.end_week || 0), 4)
  const weekNumbers = Array.from({ length: totalWeeks }, (_, i) => i + 1)

  return (
    <div className="space-y-6">
      
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-navy-50 border border-navy-100 px-4 py-2">
          <span className="text-xs text-slate-500">Total Duration</span>
          <p className="font-bold text-navy-700">{timeline.total_duration}</p>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-2">
          <span className="text-xs text-slate-500">Phases</span>
          <p className="font-bold text-slate-700">{timeline.phases.length}</p>
        </div>
      </div>

      
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          
          <div className="flex mb-3">
            <div className="w-48 flex-shrink-0" />
            <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${totalWeeks}, 1fr)` }}>
              {weekNumbers.map((w) => (
                <div key={w} className="text-center text-xs text-slate-400 font-medium">
                  W{w}
                </div>
              ))}
            </div>
          </div>

          
          <div className="space-y-2">
            {timeline.phases.map((phase, i) => {
              const start = (phase.start_week || 1) - 1
              const end = phase.end_week || phase.start_week || 1
              const span = end - start
              const colorClass = PHASE_COLORS[i % PHASE_COLORS.length]

              return (
                <div key={phase.phase} className="flex items-center gap-0">
                  
                  <div className="w-48 flex-shrink-0 pr-3">
                    <p className="text-xs font-semibold text-slate-700 truncate">{phase.name}</p>
                    <p className="text-xs text-slate-400">{phase.duration}</p>
                  </div>

                  
                  <div className="flex-1 relative h-10">
                    
                    <div
                      className="absolute inset-0 grid"
                      style={{ gridTemplateColumns: `repeat(${totalWeeks}, 1fr)` }}
                    >
                      {weekNumbers.map((w) => (
                        <div key={w} className="border-l border-slate-100 h-full" />
                      ))}
                    </div>

                    
                    <div
                      className={`absolute top-1 bottom-1 rounded-lg ${colorClass} opacity-90
                                   flex items-center px-2 shadow-sm cursor-pointer
                                   hover:opacity-100 transition-opacity group`}
                      style={{
                        left: `${(start / totalWeeks) * 100}%`,
                        width: `${(span / totalWeeks) * 100}%`,
                      }}
                      title={`${phase.name}: Week ${phase.start_week}–${phase.end_week}`}
                    >
                      <span className="text-white text-xs font-semibold truncate">
                        Phase {phase.phase}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      
      <div className="space-y-4">
        {timeline.phases.map((phase, i) => {
          const colorClass = PHASE_COLORS[i % PHASE_COLORS.length]
          return (
            <div key={phase.phase} className="rounded-xl border border-slate-200 overflow-hidden">
              <div className={`${colorClass} px-4 py-3 flex items-center justify-between`}>
                <div>
                  <span className="text-white/80 text-xs font-medium">Phase {phase.phase}</span>
                  <h3 className="text-white font-bold">{phase.name}</h3>
                </div>
                <div className="text-right">
                  <span className="text-white/80 text-xs">
                    Wk {phase.start_week}–{phase.end_week} · {phase.duration}
                  </span>
                </div>
              </div>
              <div className="p-4 grid sm:grid-cols-3 gap-4">
                
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Tasks</p>
                  <ul className="space-y-1">
                    {(phase.tasks ?? []).map((task, j) => (
                      <li key={j} className="flex items-start gap-2 text-xs text-slate-700">
                        <span className="text-slate-300 mt-0.5">▸</span>
                        {task}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Dependencies</p>
                  <ul className="space-y-1">
                    {(phase.dependencies ?? []).map((dep, j) => (
                      <li key={j} className="text-xs text-slate-600 bg-slate-50 rounded px-2 py-1">
                        {dep}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Deliverables</p>
                  <ul className="space-y-1">
                    {(phase.deliverables ?? []).map((del, j) => (
                      <li key={j} className="flex items-start gap-2 text-xs text-emerald-700">
                        <span className="text-emerald-400 mt-0.5">✓</span>
                        {del}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
