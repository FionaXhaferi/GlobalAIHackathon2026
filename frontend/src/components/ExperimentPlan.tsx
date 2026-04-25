import { useState, useEffect } from 'react'
import {
  FlaskConical, List, Package, DollarSign, Calendar, CheckSquare,
  ShieldAlert, BookMarked, Download, Brain, MessageSquarePlus
} from 'lucide-react'
import type { ExperimentPlan as PlanType, ReadinessScore as ScoreType } from '../types'
import { scorePlan } from '../api'
import type { FeedbackUsedEvent } from '../api'
import ProtocolSection from './ProtocolSection'
import MaterialsTable from './MaterialsTable'
import BudgetSection from './BudgetSection'
import TimelineView from './TimelineView'
import ValidationSection from './ValidationSection'
import ScientistReview from './ScientistReview'
import ReadinessScore from './ReadinessScore'
import ReproducibilityPassport from './ReproducibilityPassport'

interface Props {
  plan: PlanType
  question: string
  experimentTags: string[]
  feedbackUsed?: FeedbackUsedEvent | null
}

const TABS = [
  { id: 'protocol',    label: 'Protocol',    icon: List },
  { id: 'materials',   label: 'Materials',   icon: Package },
  { id: 'budget',      label: 'Budget',      icon: DollarSign },
  { id: 'timeline',    label: 'Timeline',    icon: Calendar },
  { id: 'validation',  label: 'Validation',  icon: CheckSquare },
] as const

type TabId = typeof TABS[number]['id']

export default function ExperimentPlan({ plan, question, experimentTags, feedbackUsed }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('protocol')
  const [reviewSection, setReviewSection] = useState<string | null>(null)
  const [reviewSaved, setReviewSaved] = useState<Set<string>>(new Set())
  const [score, setScore] = useState<ScoreType | null>(null)
  const [scoreLoading, setScoreLoading] = useState(true)
  const [scoreError, setScoreError] = useState<string | null>(null)

  useEffect(() => {
    setScoreLoading(true)
    setScoreError(null)
    scorePlan(question, plan)
      .then(setScore)
      .catch((e: Error) => setScoreError(e.name === 'AbortError' ? 'Timed out' : e.message))
      .finally(() => setScoreLoading(false))
  }, [plan, question])

  const handleReviewSaved = (section: string) => {
    setReviewSaved((prev) => new Set([...prev, section]))
    setReviewSection(null)
  }

  const getSectionContent = (section: string) => {
    switch (section) {
      case 'protocol': return plan.protocol
      case 'materials': return plan.materials
      case 'budget': return plan.budget
      case 'timeline': return plan.timeline
      case 'validation': return plan.validation
      default: return null
    }
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Plan header — full width */}
      <div className="card bg-gradient-to-br from-navy-700 to-navy-800 text-white border-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <FlaskConical className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {(experimentTags ?? []).map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded-md bg-white/10 text-white/80 text-xs font-medium">
                    {tag}
                  </span>
                ))}
              </div>
              <h1 className="text-2xl font-extrabold leading-tight">{plan.title}</h1>
              <p className="text-white/70 text-sm mt-2 leading-relaxed max-w-2xl">{plan.summary}</p>
            </div>
          </div>
          <button
            onClick={() => handleExportPDF(plan)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10
                       hover:bg-white/20 text-white text-xs font-medium transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <StatCard label="Total Budget" value={`$${(plan.budget?.total_usd ?? 0).toLocaleString()}`} />
          <StatCard label="Duration" value={plan.timeline?.total_duration ?? 'N/A'} />
          <StatCard label="Protocol Steps" value={`${plan.protocol?.steps?.length ?? 0} steps`} />
          <StatCard label="Materials" value={`${plan.materials?.length ?? 0} items`} />
        </div>
      </div>

      {/* Main content + sticky passport sidebar */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-6 items-start">

        {/* ── Left: main content column ── */}
        <div className="space-y-6 min-w-0 w-full">

          {/* Feedback applied banner */}
          {feedbackUsed && feedbackUsed.count > 0 && (
            <div className="rounded-xl bg-violet-50 border border-violet-200 px-4 py-3 flex items-start gap-3 animate-fade-in">
              <Brain className="w-4 h-4 text-violet-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-violet-800">
                  This plan incorporated {feedbackUsed.count} expert correction{feedbackUsed.count > 1 ? 's' : ''} from similar experiments
                </p>
                <p className="text-xs text-violet-600 mt-0.5">
                  Sections improved: {feedbackUsed.corrections.map(c => c.section).join(', ')}
                </p>
              </div>
            </div>
          )}

          {/* Readiness Score */}
          <ReadinessScore score={score} loading={scoreLoading} error={scoreError} />

          {/* Safety notes */}
          {plan.safety_notes && plan.safety_notes.length > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-bold text-amber-800">Safety Notes</span>
              </div>
              <ul className="space-y-1">
                {plan.safety_notes.map((note, i) => (
                  <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                    <span className="text-amber-400 mt-0.5">•</span>
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tabs */}
          <div className="card !p-0 overflow-hidden">
            <div className="flex border-b border-slate-100 overflow-x-auto">
              {TABS.map(({ id, label, icon: Icon }) => {
                const reviewed = reviewSaved.has(id)
                return (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`flex items-center gap-2 px-5 py-4 text-sm font-semibold whitespace-nowrap
                               transition-all border-b-2 flex-shrink-0 ${
                      activeTab === id
                        ? 'border-navy-700 text-navy-700 bg-navy-50/50'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                    {reviewed && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                  </button>
                )
              })}
            </div>

            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-slate-400 italic flex items-center gap-1">
                  <Brain className="w-3 h-3" />
                  Expert corrections train future plans
                </p>
                <button
                  onClick={() => setReviewSection(activeTab)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                              transition-all border ${
                    reviewSaved.has(activeTab)
                      ? 'bg-violet-50 border-violet-200 text-violet-700'
                      : 'bg-violet-600 border-violet-600 text-white hover:bg-violet-700'
                  }`}
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                  {reviewSaved.has(activeTab) ? '✓ Correction saved' : 'Correct this section'}
                </button>
              </div>

              {activeTab === 'protocol'   && <ProtocolSection   protocol={plan.protocol} />}
              {activeTab === 'materials'  && <MaterialsTable    materials={plan.materials ?? []} />}
              {activeTab === 'budget'     && <BudgetSection     budget={plan.budget} />}
              {activeTab === 'timeline'   && <TimelineView      timeline={plan.timeline} />}
              {activeTab === 'validation' && <ValidationSection validation={plan.validation} />}
            </div>
          </div>

          {/* Protocol references */}
          {plan.protocol_references && plan.protocol_references.length > 0 && (
            <div className="card">
              <div className="section-title">
                <BookMarked className="w-4 h-4" />
                Grounding References
              </div>
              <ul className="space-y-1">
                {plan.protocol_references.map((ref, i) => (
                  <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                    <span className="text-slate-400 mt-0.5">[{i + 1}]</span>
                    {ref.startsWith('http') ? (
                      <a href={ref} target="_blank" rel="noopener noreferrer"
                         className="text-navy-600 hover:underline break-all">
                        {ref}
                      </a>
                    ) : (
                      <span>{ref}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* ── Right: sticky passport sidebar ── */}
        <div className="md:sticky md:top-6">
          <ReproducibilityPassport plan={plan} defaultExpanded />
        </div>
      </div>

      {/* Scientist Review Modal */}
      {reviewSection && (
        <ScientistReview
          section={reviewSection}
          content={getSectionContent(reviewSection)}
          question={question}
          experimentTags={experimentTags}
          onSaved={() => handleReviewSaved(reviewSection)}
          onClose={() => setReviewSection(null)}
        />
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-4 py-3">
      <p className="text-white/60 text-xs font-medium">{label}</p>
      <p className="text-white font-bold text-base mt-0.5 truncate">{value}</p>
    </div>
  )
}

function handleExportPDF(plan: PlanType) {
  const content = JSON.stringify(plan, null, 2)
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${plan.title.replace(/\s+/g, '_')}_plan.json`
  a.click()
  URL.revokeObjectURL(url)
}
