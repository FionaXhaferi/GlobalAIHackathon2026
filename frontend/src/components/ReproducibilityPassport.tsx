import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { ShieldCheck, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'
import type { ExperimentPlan } from '../types'

interface Props {
  plan: ExperimentPlan
  defaultExpanded?: boolean
}

interface PassportData {
  passport_id: string
  generated_at: string
  plan_title: string
  protocol_hash: string
  reagents: { name: string; catalog_number: string; supplier: string }[]
  equipment: { name: string; catalog_number: string; supplier: string }[]
  software: string[]
  random_seed: string
  budget_usd: number | null
  total_duration: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function extractSoftware(plan: ExperimentPlan): string[] {
  const text = [
    plan.validation?.statistical_approach ?? '',
    ...(plan.protocol?.steps ?? []).map((s) => s.description + ' ' + (s.notes ?? '')),
  ].join(' ')

  const known = [
    'GraphPad Prism', 'Prism', 'R ', 'Python', 'SPSS', 'SAS', 'MATLAB',
    'ImageJ', 'Fiji', 'FlowJo', 'G\\*Power', 'GPower', 'STATA', 'Excel',
    'Seurat', 'DESeq2', 'edgeR', 'Bowtie', 'STAR ', 'HISAT', 'Salmon',
    'FastQC', 'Trimmomatic', 'GATK', 'Picard',
  ]
  const found = known.filter((s) => new RegExp(s, 'i').test(text))
  return [...new Set(found)]
}

async function buildPassport(plan: ExperimentPlan): Promise<PassportData> {
  const materials = plan.materials ?? []
  const reagents = materials
    .filter((m) => !['Equipment', 'Instrument'].some((k) => m.category?.includes(k)))
    .map(({ name, catalog_number, supplier }) => ({ name, catalog_number: catalog_number ?? '', supplier: supplier ?? '' }))

  const equipment = materials
    .filter((m) => ['Equipment', 'Instrument'].some((k) => m.category?.includes(k)))
    .map(({ name, catalog_number, supplier }) => ({ name, catalog_number: catalog_number ?? '', supplier: supplier ?? '' }))

  const steps = (plan.protocol?.steps ?? []).map((s) => s.description).join('|')
  const protocol_hash = (await sha256(steps)).slice(0, 16)

  const software = extractSoftware(plan)
  const generated_at = new Date().toISOString()

  // Deterministic seed from protocol hash (reproducible random seed for analysis)
  const random_seed = parseInt(protocol_hash.slice(0, 8), 16).toString()

  const canonical = JSON.stringify({ plan_title: plan.title, protocol_hash, reagents, equipment, software, generated_at })
  const passport_id = (await sha256(canonical)).slice(0, 12).toUpperCase()

  const budget_usd = (plan.budget?.total_usd) ?? null
  const total_duration = plan.timeline?.total_duration ?? null

  return { passport_id, generated_at, plan_title: plan.title, protocol_hash, reagents, equipment, software, random_seed, budget_usd, total_duration }
}

function toBase64Unicode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
}

function qrPayload(p: PassportData, plan: ExperimentPlan, baseUrl: string): string {
  const compact = {
    id: p.passport_id,
    title: p.plan_title.slice(0, 60),
    summary: (plan.summary ?? '').slice(0, 120),
    endpoint: (plan.validation?.primary_endpoints?.[0] ?? '').slice(0, 80),
    steps: plan.protocol?.steps?.length ?? 0,
    proto: p.protocol_hash,
    seed: p.random_seed,
    cats: p.reagents.slice(0, 5).map((r) => r.catalog_number).filter(Boolean),
    sw: p.software.slice(0, 3),
    budget: p.budget_usd,
    duration: p.total_duration,
    ts: p.generated_at,
  }
  return `${baseUrl}#${toBase64Unicode(JSON.stringify(compact))}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReproducibilityPassport({ plan, defaultExpanded = false }: Props) {
  const [passport, setPassport] = useState<PassportData | null>(null)
  const apiUrl = import.meta.env.VITE_API_URL ?? ''
  const defaultPassportBase = apiUrl
    ? `${apiUrl}/passport`
    : `http://${window.location.hostname}:8000/passport`
  const [passportBaseUrl, setPassportBaseUrl] = useState(defaultPassportBase)
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    buildPassport(plan).then(setPassport)
    // Only fetch network-info in local dev (no VITE_API_URL set)
    if (!apiUrl) {
      fetch('/api/network-info')
        .then((r) => r.json())
        .then((d) => { if (d.passport_base_url) setPassportBaseUrl(d.passport_base_url) })
        .catch(() => {/* keep default */})
    }
  }, [plan])

  if (!passport) return null

  const payload = qrPayload(passport, plan, passportBaseUrl)

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(passport, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="card border border-slate-200">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h2 className="font-bold text-navy-700 text-sm">Reproducibility Passport</h2>
            <p className="text-xs text-slate-400 font-mono">ID: {passport.passport_id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 hidden sm:block">Scan to reproduce exactly</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="mt-5 pt-5 border-t border-slate-100 animate-fade-in space-y-5">
          {/* QR code — centred, prominent */}
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm inline-block">
              <QRCodeSVG value={payload} size={148} level="M" />
            </div>
            <p className="text-xs text-slate-400 text-center max-w-[200px] leading-relaxed">
              Scan to load exact reagents, protocol hash &amp; seed on any device
            </p>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200
                         text-xs font-medium text-slate-600 hover:bg-slate-50 transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy passport JSON'}
            </button>
          </div>

          {/* Key fields in a tight grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
            <PassportField label="Protocol Hash" value={passport.protocol_hash} mono />
            <PassportField label="Random Seed"   value={passport.random_seed}   mono />
            <PassportField label="Passport ID"   value={passport.passport_id}   mono />
            <PassportField label="Generated"     value={new Date(passport.generated_at).toLocaleString()} />
          </div>

          {/* Reagents, equipment, software — compact chips */}
          {passport.reagents.length > 0 && (
            <div className="text-xs">
              <p className="font-semibold text-slate-500 uppercase tracking-wide text-[10px] mb-1.5">
                Reagents ({passport.reagents.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {passport.reagents.slice(0, 6).map((r, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium truncate max-w-[160px]">
                    {r.name}{r.catalog_number ? ` · ${r.catalog_number}` : ''}
                  </span>
                ))}
                {passport.reagents.length > 6 && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-400">
                    +{passport.reagents.length - 6} more
                  </span>
                )}
              </div>
            </div>
          )}

          {passport.software.length > 0 && (
            <div className="text-xs">
              <p className="font-semibold text-slate-500 uppercase tracking-wide text-[10px] mb-1.5">Software</p>
              <div className="flex flex-wrap gap-1">
                {passport.software.map((s, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-mono">{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PassportField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-slate-400 font-medium mb-0.5">{label}</p>
      <p className={`text-slate-700 break-all ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}
