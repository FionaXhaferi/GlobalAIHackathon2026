import { useState } from 'react'
import { X, Star, Save, Loader2, MessageSquare } from 'lucide-react'
import { submitFeedback } from '../api'

interface Props {
  section: string
  content: unknown
  question: string
  experimentTags: string[]
  onSaved: () => void
  onClose: () => void
}

const SECTION_LABELS: Record<string, string> = {
  protocol:   'Protocol',
  materials:  'Materials List',
  budget:     'Budget',
  timeline:   'Timeline',
  validation: 'Validation Approach',
}

export default function ScientistReview({ section, content, question, experimentTags, onSaved, onClose }: Props) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [correctedText, setCorrectedText] = useState(
    typeof content === 'string' ? content : JSON.stringify(content, null, 2)
  )
  const [annotations, setAnnotations] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const originalText = typeof content === 'string' ? content : JSON.stringify(content, null, 2)
  const hasChanges = correctedText !== originalText || annotations.trim()

  const handleSave = async () => {
    if (rating === 0) { setError('Please select a star rating before saving.'); return }
    setSaving(true)
    setError('')
    try {
      let corrected: unknown = correctedText
      try { corrected = JSON.parse(correctedText) } catch { /* keep as string */ }

      await submitFeedback({
        question,
        experiment_tags: experimentTags,
        section,
        original_content: content,
        corrected_content: corrected,
        rating,
        annotations,
      })
      setSaved(true)
      setTimeout(onSaved, 800)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save feedback')
    } finally {
      setSaving(false)
    }
  }

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6"
         onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl animate-slide-up overflow-hidden">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-navy-100 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-navy-700" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">Scientist Review</h2>
              <p className="text-xs text-slate-500">{SECTION_LABELS[section] || section} · Your feedback trains future plans</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              How accurate is this section? <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onMouseEnter={() => setHoverRating(s)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(s)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-8 h-8 transition-colors ${
                      s <= (hoverRating || rating) ? 'star-filled fill-current' : 'star-empty'
                    }`}
                  />
                </button>
              ))}
              {rating > 0 && (
                <span className="ml-2 text-sm text-slate-500">
                  {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
                </span>
              )}
            </div>
          </div>

          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Edit / Correct this section
              <span className="ml-2 text-xs font-normal text-slate-400">(changes are highlighted as training signal)</span>
            </label>
            <textarea
              value={correctedText}
              onChange={(e) => setCorrectedText(e.target.value)}
              rows={10}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5
                         text-xs font-mono text-slate-800 resize-y
                         focus:outline-none focus:ring-2 focus:ring-navy-400 focus:border-transparent"
            />
          </div>

          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Annotations / Notes
              <span className="ml-2 text-xs font-normal text-slate-400">optional — explain why you made changes</span>
            </label>
            <textarea
              value={annotations}
              onChange={(e) => setAnnotations(e.target.value)}
              rows={3}
              placeholder="e.g. The DMSO concentration should be 0.5% not 1% to avoid cytotoxicity at 37°C. See Smith et al. 2022."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5
                         text-sm text-slate-800 resize-none
                         focus:outline-none focus:ring-2 focus:ring-navy-400 focus:border-transparent
                         placeholder-slate-400"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            {hasChanges ? '⚡ Your corrections will improve future plans for similar experiments.' : 'No changes yet — even a rating without edits is valuable.'}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-secondary text-sm">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || saved}
              className="btn-primary text-sm"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
              ) : saved ? (
                <>✓ Saved!</>
              ) : (
                <><Save className="w-4 h-4" />Save Review</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
