import { useState, useRef } from 'react'
import { ArrowRight, Lightbulb, ChevronDown } from 'lucide-react'

const EXAMPLES = [
  {
    label: 'Diagnostics',
    text: 'A paper-based electrochemical biosensor functionalized with anti-CRP antibodies will detect C-reactive protein in whole blood at concentrations below 0.5 mg/L within 10 minutes, matching laboratory ELISA sensitivity without requiring sample preprocessing.',
  },
  {
    label: 'Gut Health',
    text: 'Supplementing C57BL/6 mice with Lactobacillus rhamnosus GG for 4 weeks will reduce intestinal permeability by at least 30% compared to controls, measured by FITC-dextran assay, due to upregulation of tight junction proteins claudin-1 and occludin.',
  },
  {
    label: 'Cell Biology',
    text: 'Replacing sucrose with trehalose as a cryoprotectant in the freezing medium will increase post-thaw viability of HeLa cells by at least 15 percentage points compared to the standard DMSO protocol, due to trehalose\'s superior membrane stabilization at low temperatures.',
  },
  {
    label: 'Climate',
    text: 'Introducing Sporomusa ovata into a bioelectrochemical system at a cathode potential of −400 mV vs SHE will fix CO₂ into acetate at a rate of at least 150 mmol/L/day, outperforming current biocatalytic carbon capture benchmarks by at least 20%.',
  },
]

interface Props {
  onSubmit: (question: string) => void
}

export default function QuestionInput({ onSubmit }: Props) {
  const [text, setText] = useState('')
  const [showExamples, setShowExamples] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = () => {
    const trimmed = text.trim()
    if (trimmed.length < 20) return
    onSubmit(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
  }

  const insertExample = (ex: string) => {
    setText(ex)
    setShowExamples(false)
    textareaRef.current?.focus()
  }

  const charCount = text.trim().length
  const valid = charCount >= 20

  return (
    <div className="card animate-slide-up">
      <label className="block text-sm font-semibold text-slate-700 mb-2">
        Scientific Hypothesis
      </label>
      <p className="text-sm text-slate-500 mb-4">
        State your hypothesis with a specific intervention, measurable outcome, and mechanistic reason.
        The more precise, the better the plan.
      </p>

      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={5}
        placeholder="e.g. Replacing sucrose with trehalose as a cryoprotectant will increase post-thaw HeLa cell viability by ≥15 percentage points compared to the standard DMSO protocol…"
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm
                   text-slate-900 placeholder-slate-400 resize-none
                   focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent
                   transition-all"
      />

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowExamples(!showExamples)}
            className="btn-secondary text-xs py-1.5"
          >
            <Lightbulb className="w-3.5 h-3.5" />
            Examples
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showExamples ? 'rotate-180' : ''}`} />
          </button>
          <span className={`text-xs ${charCount > 0 && !valid ? 'text-amber-500' : 'text-slate-400'}`}>
            {charCount > 0 && !valid ? 'Add more detail…' : charCount > 0 ? `${charCount} chars` : 'Ctrl+Enter to submit'}
          </span>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!valid}
          className="btn-primary"
        >
          Check Literature
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {showExamples && (
        <div className="mt-4 grid gap-2 animate-fade-in">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Example hypotheses
          </p>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              onClick={() => insertExample(ex.text)}
              className="text-left p-3 rounded-xl border border-slate-200 hover:border-navy-300
                         hover:bg-navy-50 transition-all group"
            >
              <span className="text-xs font-bold text-navy-600 mb-1 block">{ex.label}</span>
              <span className="text-xs text-slate-600 line-clamp-2 group-hover:text-slate-800">
                {ex.text}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
