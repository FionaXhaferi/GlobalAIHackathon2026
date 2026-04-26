import { useState, useCallback } from 'react'
import Header from './components/Header'
import QuestionInput from './components/QuestionInput'
import LiteratureQC from './components/LiteratureQC'
import LoadingState from './components/LoadingState'
import ExperimentPlan from './components/ExperimentPlan'
import { checkLiterature, streamPlan } from './api'
import type { FeedbackUsedEvent } from './api'
import type { AppStage, LiteratureResult, ExperimentPlan as PlanType } from './types'

export default function App() {
  const [stage, setStage] = useState<AppStage>('input')
  const [question, setQuestion] = useState('')
  const [litResult, setLitResult] = useState<LiteratureResult | null>(null)
  const [streamingText, setStreamingText] = useState('')
  const [plan, setPlan] = useState<PlanType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [feedbackUsed, setFeedbackUsed] = useState<FeedbackUsedEvent | null>(null)

  const handleSubmitQuestion = useCallback(async (q: string) => {
    setQuestion(q)
    setLitResult(null)
    setPlan(null)
    setStreamingText('')
    setError(null)
    setStage('lit-loading')

    try {
      const result = await checkLiterature(q)
      setLitResult(result)
      setStage('lit-done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Literature check failed')
      setStage('input')
    }
  }, [])

  const handleGeneratePlan = useCallback(async () => {
    setStreamingText('')
    setPlan(null)
    setError(null)
    setFeedbackUsed(null)
    setStage('plan-loading')

    await streamPlan(
      question,
      litResult,
      (chunk) => setStreamingText((prev) => prev + chunk),
      (p) => {
        if (p && 'error' in p) {
          setError('Plan generation failed: Claude\'s response could not be parsed as JSON. Please try again — this sometimes happens with very complex hypotheses.')
          setStage('lit-done')
          return
        }
        setPlan(p)
        setStage('plan-done')
      },
      (msg) => {
        setError(msg)
        setStage('lit-done')
      },
      (fb) => setFeedbackUsed(fb),
    )
  }, [question, litResult])

  const handleReset = useCallback(() => {
    setStage('input')
    setQuestion('')
    setLitResult(null)
    setStreamingText('')
    setPlan(null)
    setError(null)
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <Header onReset={stage !== 'input' ? handleReset : undefined} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 space-y-8">

        
        {stage !== 'input' && (
          <StepIndicator stage={stage} />
        )}

        
        {stage === 'input' && (
          <div className="animate-slide-up">
            <HeroSection />
            <QuestionInput onSubmit={handleSubmitQuestion} />
          </div>
        )}

        
        {error && (
          <div className="animate-fade-in rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-3">
            <span className="text-red-500 text-xl">⚠</span>
            <div>
              <p className="font-semibold text-red-800">Something went wrong</p>
              <p className="text-red-700 text-sm mt-0.5">{error}</p>
            </div>
          </div>
        )}

        
        {stage === 'lit-loading' && (
          <LoadingState
            title="Checking if the hypothesis exists or not…"
            stillWorkingMessage="Checking if the hypothesis exists or not…"
            steps={[
              'Searching literature',
              'Analysing related papers',
              'Classifying novelty signal',
            ]}
          />
        )}

        
        {(stage === 'lit-done' || stage === 'plan-loading' || stage === 'plan-done') && litResult && (
          <LiteratureQC
            result={litResult}
            question={question}
            onGeneratePlan={stage === 'lit-done' ? handleGeneratePlan : undefined}
          />
        )}

        
        {stage === 'plan-loading' && (
          <LoadingState
            title="Structuring the experiment plan"
            subtitle="Designing your full protocol, materials list, budget, and timeline."
            steps={[
              'Designing step-by-step protocol',
              'Sourcing real reagents & catalog numbers',
              'Calculating realistic budget',
              'Building phased timeline',
              'Defining validation approach',
            ]}
            streamingText={streamingText}
            feedbackUsed={feedbackUsed}
          />
        )}

        
        {stage === 'plan-done' && plan && (
          <div className="animate-fade-in">
            <ExperimentPlan
              plan={plan}
              question={question}
              experimentTags={plan.experiment_tags ?? []}
              feedbackUsed={feedbackUsed}
            />
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-400">
        Built for Global AI Hackathon 2026 · Challenge from{' '}
        <span className="font-semibold text-slate-500">Fulcrum Science</span>
      </footer>
    </div>
  )
}

function HeroSection() {
  return (
    <div className="text-center mb-12 pt-8">
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-navy-50 border border-navy-100 text-navy-700 text-sm font-medium mb-6">
        <span className="w-2 h-2 rounded-full bg-science-teal animate-pulse-slow" />
        Global AI Hackathon 2026
      </div>
      <h1 className="text-5xl font-extrabold text-navy-700 mb-4 leading-tight">
        The AI Scientist
      </h1>
      <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
        From hypothesis to{' '}
        <span className="text-navy-600 font-semibold">runnable experiment plan</span>.
        <br />
        Protocol · Materials · Budget · Timeline — in minutes.
      </p>
    </div>
  )
}

function StepIndicator({ stage }: { stage: AppStage }) {
  const steps = [
    { key: 'lit', label: 'Literature QC' },
    { key: 'plan', label: 'Experiment Plan' },
  ]
  const active = stage === 'lit-loading' || stage === 'lit-done' ? 0 : 1
  const done = stage === 'plan-done' ? [0, 1] : stage === 'plan-loading' ? [0] : []

  return (
    <div className="flex items-center justify-center gap-4 animate-fade-in">
      {steps.map((s, i) => {
        const isDone = done.includes(i)
        const isActive = active === i && !isDone
        return (
          <div key={s.key} className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  isDone
                    ? 'bg-emerald-500 text-white'
                    : isActive
                    ? 'bg-navy-700 text-white ring-4 ring-navy-100'
                    : 'bg-slate-200 text-slate-400'
                }`}
              >
                {isDone ? '✓' : i + 1}
              </div>
              <span
                className={`text-sm font-medium ${
                  isDone ? 'text-emerald-600' : isActive ? 'text-navy-700' : 'text-slate-400'
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-16 h-0.5 ${isDone ? 'bg-emerald-300' : 'bg-slate-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
