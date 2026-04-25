import { FlaskConical, RotateCcw } from 'lucide-react'

interface Props {
  onReset?: () => void
}

export default function Header({ onReset }: Props) {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-navy-700 flex items-center justify-center">
            <FlaskConical className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-extrabold text-navy-700 text-lg leading-none">AI Scientist</span>
            <span className="hidden sm:block text-xs text-slate-400 leading-none mt-0.5">
              Hypothesis → Experiment Plan
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://fulcrum.science"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Challenge from <span className="font-bold text-slate-500">Fulcrum Science</span>
          </a>
          {onReset && (
            <button
              onClick={onReset}
              className="btn-secondary text-sm py-1.5 px-3"
              title="Start over"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Question</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
