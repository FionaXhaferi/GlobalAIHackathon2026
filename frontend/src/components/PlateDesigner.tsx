import { useState, useCallback } from 'react'
import { X, Shuffle, AlertTriangle, Trash2, Plus, Grid3x3, Download, CheckCircle2 } from 'lucide-react'
import type { ExperimentPlan } from '../types'

interface Props {
  plan: ExperimentPlan
  onClose: () => void
}

type PlateSize = 96 | 384

const PLATE_CONFIG: Record<PlateSize, { rows: number; cols: number }> = {
  96:  { rows: 8,  cols: 12 },
  384: { rows: 16, cols: 24 },
}

const ROW_LABELS_96  = ['A','B','C','D','E','F','G','H']
const ROW_LABELS_384 = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P']

const CONDITION_COLORS = [
  { bg: '#6366f1', light: '#e0e7ff', label: 'indigo' },
  { bg: '#10b981', light: '#d1fae5', label: 'emerald' },
  { bg: '#f59e0b', light: '#fef3c7', label: 'amber' },
  { bg: '#ef4444', light: '#fee2e2', label: 'red' },
  { bg: '#8b5cf6', light: '#ede9fe', label: 'violet' },
  { bg: '#06b6d4', light: '#cffafe', label: 'cyan' },
  { bg: '#f97316', light: '#ffedd5', label: 'orange' },
  { bg: '#ec4899', light: '#fce7f3', label: 'pink' },
]

function extractConditions(plan: ExperimentPlan): string[] {
  const seen = new Set<string>()
  const add = (s: string) => {
    const clean = s.trim()
    if (clean && !seen.has(clean.toLowerCase())) {
      seen.add(clean.toLowerCase())
      raw.push(clean)
    }
  }
  const raw: string[] = []

  const controls = plan.validation?.controls ?? []
  controls.forEach(c => {
    const short = c.replace(/\s*(control|condition|group)\s*/gi, '').trim()
    add(short.charAt(0).toUpperCase() + short.slice(1))
  })

  const tags = plan.experiment_tags ?? []
  tags.slice(0, 3).forEach(t => add(t.charAt(0).toUpperCase() + t.slice(1)))

  const endpoints = plan.validation?.primary_endpoints ?? []
  endpoints.slice(0, 2).forEach(e => {
    const short = e.replace(/\s*(measurement|assay|level|concentration|activity)\s*/gi, '').trim()
    if (short.split(' ').length <= 3) add(short.charAt(0).toUpperCase() + short.slice(1))
  })

  const standards = ['Treatment', 'Positive Control', 'Negative Control', 'Blank', 'Vehicle', 'Reference']
  for (const s of standards) {
    if (raw.length >= 6) break
    add(s)
  }

  return raw.slice(0, 8)
}

function isEdge(row: number, col: number, rows: number, cols: number) {
  return row === 0 || row === rows - 1 || col === 0 || col === cols - 1
}

function parseExpectedN(replicates: string | undefined): number | null {
  if (!replicates) return null
  const m = replicates.match(/n\s*=\s*(\d+)/i)
  return m ? parseInt(m[1], 10) : null
}

function exportCSV(
  wells: (number | null)[],
  conditions: string[],
  rowLabels: string[],
  cols: number,
  plateSize: number,
) {
  const rows = ['Well,Row,Column,Condition']
  wells.forEach((condIdx, i) => {
    const r = Math.floor(i / cols)
    const c = (i % cols) + 1
    const well = `${rowLabels[r]}${c}`
    const condition = condIdx !== null ? conditions[condIdx] : ''
    rows.push(`${well},${rowLabels[r]},${c},${condition}`)
  })
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `plate_layout_${plateSize}well.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function PlateDesigner({ plan, onClose }: Props) {
  const [plateSize, setPlateSize] = useState<PlateSize>(96)
  const [conditions, setConditions] = useState<string[]>(() => extractConditions(plan))
  const [newCondition, setNewCondition] = useState('')
  const [activeCondition, setActiveCondition] = useState<number>(0)
  const [wells, setWells] = useState<(number | null)[]>(() => new Array(96).fill(null))
  const [painting, setPainting] = useState(false)

  const { rows, cols } = PLATE_CONFIG[plateSize]
  const totalWells = rows * cols

  const switchPlate = (size: PlateSize) => {
    setPlateSize(size)
    setWells(new Array(size).fill(null))
  }

  const paintWell = useCallback((idx: number) => {
    setWells(prev => {
      const next = [...prev]
      next[idx] = next[idx] === activeCondition ? null : activeCondition
      return next
    })
  }, [activeCondition])

  const handleMouseEnter = useCallback((idx: number) => {
    if (painting) {
      setWells(prev => {
        const next = [...prev]
        next[idx] = activeCondition
        return next
      })
    }
  }, [painting, activeCondition])

  const randomize = () => {
    const assigned = wells.filter(w => w !== null)
    if (assigned.length === 0) return
    const counts: Record<number, number> = {}
    assigned.forEach(c => { counts[c!] = (counts[c!] ?? 0) + 1 })
    const pool: number[] = []
    Object.entries(counts).forEach(([c, n]) => {
      for (let i = 0; i < n; i++) pool.push(Number(c))
    })
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]]
    }
    const next = new Array(totalWells).fill(null)
    pool.forEach((c, i) => { next[i] = c })
    setWells(next)
  }

  const fillAll = () => {
    if (conditions.length === 0) return
    const perCondition = Math.floor(totalWells / conditions.length)
    const pool: number[] = []
    conditions.forEach((_, ci) => {
      for (let i = 0; i < perCondition; i++) pool.push(ci)
    })
    while (pool.length < totalWells) pool.push(0)
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]]
    }
    setWells(pool.slice(0, totalWells))
  }

  const clearAll = () => setWells(new Array(totalWells).fill(null))

  const addCondition = () => {
    const name = newCondition.trim()
    if (!name || conditions.includes(name) || conditions.length >= 8) return
    setConditions(prev => [...prev, name])
    setNewCondition('')
  }

  const removeCondition = (ci: number) => {
    setConditions(prev => prev.filter((_, i) => i !== ci))
    setWells(prev => prev.map(w => w === ci ? null : w === null ? null : w > ci ? w - 1 : w))
    if (activeCondition >= ci) setActiveCondition(Math.max(0, activeCondition - 1))
  }

  const rowLabels = plateSize === 96 ? ROW_LABELS_96 : ROW_LABELS_384

  const edgeCount = wells.filter((w, i) => {
    const r = Math.floor(i / cols), c = i % cols
    return w !== null && isEdge(r, c, rows, cols)
  }).length

  const assignedCount = wells.filter(w => w !== null).length

  const wellSize = plateSize === 96 ? 'w-7 h-7' : 'w-3.5 h-3.5'
  const gapSize  = plateSize === 96 ? 'gap-1' : 'gap-0.5'

  const expectedN = parseExpectedN(plan.validation?.replicates)
  const replicateCounts = conditions.map((_, ci) => wells.filter(w => w === ci).length)
  const replicateIssues = expectedN
    ? conditions.map((cond, ci) => {
        const count = replicateCounts[ci]
        if (count === 0) return null
        if (count < expectedN) return { cond, count, expected: expectedN, type: 'under' as const }
        if (count > expectedN * 1.5) return { cond, count, expected: expectedN, type: 'over' as const }
        return null
      }).filter(Boolean)
    : []
  const replicatesOk = expectedN !== null && assignedCount > 0 && replicateIssues.length === 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-y-auto flex flex-col">

        
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-navy-700 flex items-center justify-center">
            <Grid3x3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-extrabold text-navy-700 text-lg">Plate Layout Designer</h2>
            <p className="text-xs text-slate-400">Click or drag to assign conditions · Auto-randomize for unbiased placement</p>
          </div>
          <button onClick={onClose} className="ml-auto p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 p-6">

          
          <div className="lg:w-56 flex-shrink-0 space-y-5">

            
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Plate Format</p>
              <div className="flex gap-2">
                {([96, 384] as PlateSize[]).map(s => (
                  <button
                    key={s}
                    onClick={() => switchPlate(s)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${
                      plateSize === s
                        ? 'bg-navy-700 text-white border-navy-700'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-navy-300'
                    }`}
                  >
                    {s}-well
                  </button>
                ))}
              </div>
            </div>

            
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Conditions</p>
              <div className="space-y-1.5">
                {conditions.map((cond, ci) => (
                  <div
                    key={ci}
                    onClick={() => setActiveCondition(ci)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border transition-all ${
                      activeCondition === ci
                        ? 'border-2 shadow-sm'
                        : 'border border-slate-100 hover:border-slate-200'
                    }`}
                    style={activeCondition === ci ? { borderColor: CONDITION_COLORS[ci % 8].bg, background: CONDITION_COLORS[ci % 8].light } : {}}
                  >
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: CONDITION_COLORS[ci % 8].bg }} />
                    <span className="text-xs font-medium text-slate-700 flex-1 truncate">{cond}</span>
                    <button
                      onClick={e => { e.stopPropagation(); removeCondition(ci) }}
                      className="opacity-40 hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3 text-slate-500" />
                    </button>
                  </div>
                ))}
              </div>
              {conditions.length < 8 && (
                <div className="flex gap-1 mt-2">
                  <input
                    value={newCondition}
                    onChange={e => setNewCondition(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCondition()}
                    placeholder="Add condition…"
                    className="flex-1 text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-navy-400"
                  />
                  <button onClick={addCondition} className="px-2 py-1.5 rounded-lg bg-navy-700 text-white hover:bg-navy-800 transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Actions</p>
              <button
                onClick={fillAll}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
              >
                <Shuffle className="w-3.5 h-3.5" />
                Auto-fill &amp; Randomize
              </button>
              <button
                onClick={randomize}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors"
              >
                <Shuffle className="w-3.5 h-3.5" />
                Randomize Existing
              </button>
              <button
                onClick={clearAll}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-500 text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear All
              </button>
              <button
                onClick={() => exportCSV(wells, conditions, rowLabels, cols, plateSize)}
                disabled={assignedCount === 0}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>

            
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Stats</p>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Total wells</span>
                <span className="font-semibold text-slate-700">{totalWells}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Assigned</span>
                <span className="font-semibold text-slate-700">{assignedCount}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Empty</span>
                <span className="font-semibold text-slate-700">{totalWells - assignedCount}</span>
              </div>
              {edgeCount > 0 && (
                <div className="flex justify-between text-xs pt-1 border-t border-slate-200">
                  <span className="text-amber-600 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Edge wells
                  </span>
                  <span className="font-semibold text-amber-600">{edgeCount}</span>
                </div>
              )}
            </div>
          </div>

          
          <div className="flex-1 min-w-0">

            
            {replicatesOk && (
              <div className="mb-3 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <p className="text-xs text-emerald-700">
                  <span className="font-semibold">Replicates match your plan.</span>{' '}
                  All assigned conditions have n≥{expectedN} wells, consistent with the validation section.
                </p>
              </div>
            )}
            {replicateIssues.length > 0 && (
              <div className="mb-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 space-y-1">
                <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Replicate mismatch — your plan specifies n={expectedN}
                </p>
                {replicateIssues.map((issue, i) => issue && (
                  <p key={i} className="text-xs text-red-600">
                    <span className="font-medium">{issue.cond}:</span>{' '}
                    {issue.count} wells assigned
                    {issue.type === 'under' ? ` — needs ${issue.expected - issue.count} more` : ' — consider reducing'}
                  </p>
                ))}
              </div>
            )}

            
            {edgeCount > 0 && (
              <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  <span className="font-semibold">{edgeCount} assigned wells are on the plate edge.</span>{' '}
                  Edge wells evaporate faster and experience temperature gradients — avoid placing key conditions there, or add extra replicates.
                </p>
              </div>
            )}

            
            <div
              className="inline-block rounded-2xl p-4 select-none"
              style={{ background: 'linear-gradient(135deg, #2d3748 0%, #1a202c 100%)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
              onMouseLeave={() => setPainting(false)}
            >
              
              <div className={`flex ${gapSize} mb-1 ml-6`}>
                {Array.from({ length: cols }, (_, c) => (
                  <div key={c} className={`${wellSize} flex items-center justify-center text-slate-500`}
                    style={{ fontSize: plateSize === 96 ? '9px' : '6px' }}>
                    {c + 1}
                  </div>
                ))}
              </div>

              {Array.from({ length: rows }, (_, r) => (
                <div key={r} className={`flex ${gapSize} mb-${plateSize === 96 ? '1' : '0.5'}`}>
                  
                  <div className={`${wellSize} flex items-center justify-center text-slate-400 font-mono flex-shrink-0`}
                    style={{ fontSize: plateSize === 96 ? '9px' : '6px' }}>
                    {rowLabels[r]}
                  </div>
                  {Array.from({ length: cols }, (_, c) => {
                    const idx = r * cols + c
                    const condIdx = wells[idx]
                    const edge = isEdge(r, c, rows, cols)
                    const color = condIdx !== null ? CONDITION_COLORS[condIdx % 8].bg : null

                    return (
                      <div
                        key={c}
                        className={`${wellSize} rounded-full cursor-pointer transition-transform hover:scale-110 flex-shrink-0`}
                        style={{
                          background: color
                            ? `radial-gradient(circle at 35% 35%, ${color}cc, ${color})`
                            : edge
                              ? 'radial-gradient(circle at 35% 35%, #4a5568, #2d3748)'
                              : 'radial-gradient(circle at 35% 35%, #374151, #1f2937)',
                          boxShadow: color
                            ? `inset 1px 1px 3px rgba(255,255,255,0.3), inset -1px -1px 2px rgba(0,0,0,0.4), 0 0 6px ${color}66`
                            : 'inset 1px 1px 3px rgba(255,255,255,0.05), inset -1px -1px 2px rgba(0,0,0,0.6)',
                          outline: edge && condIdx === null ? '1px dashed #f59e0b44' : undefined,
                        }}
                        onMouseDown={() => { setPainting(true); paintWell(idx) }}
                        onMouseUp={() => setPainting(false)}
                        onMouseEnter={() => handleMouseEnter(idx)}
                        title={`${rowLabels[r]}${c + 1}${condIdx !== null ? ` — ${conditions[condIdx]}` : ''}${edge ? ' (edge)' : ''}`}
                      />
                    )
                  })}
                </div>
              ))}
            </div>

            
            <div className="flex flex-wrap gap-3 mt-4">
              {conditions.map((cond, ci) => (
                <div key={ci} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ background: CONDITION_COLORS[ci % 8].bg }} />
                  <span className="text-xs text-slate-600">{cond}</span>
                  <span className="text-xs text-slate-400">({wells.filter(w => w === ci).length})</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full border border-dashed border-amber-400" style={{ background: '#2d3748' }} />
                <span className="text-xs text-slate-500">Edge well (unassigned)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
