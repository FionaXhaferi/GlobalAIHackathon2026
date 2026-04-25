import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { ShieldCheck, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'
import type { ExperimentPlan } from '../types'

interface Props {
  plan: ExperimentPlan
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

  return { passport_id, generated_at, plan_title: plan.title, protocol_hash, reagents, equipment, software, random_seed }
}

function toBase64Unicode(str: string): string {
  // unicode-safe base64: handles °C, µL, etc.
  return btoa(unescape(encodeURIComponent(str)))
}

function qrPayload(p: PassportData, baseUrl: string): string {
  // Only encode the essential fields — full passport is too long for a QR code
  const compact = {
    id: p.passport_id,
    title: p.plan_title.slice(0, 60),
    proto: p.protocol_hash,
    seed: p.random_seed,
    cats: p.reagents.slice(0, 5).map((r) => r.catalog_number).filter(Boolean),
    sw: p.software.slice(0, 3),
    ts: p.generated_at,
  }
  return `${baseUrl}#${toBase64Unicode(JSON.stringify(compact))}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReproducibilityPassport({ plan }: Props) {
  const [passport, setPassport] = useState<PassportData | null>(null)
  const apiUrl = import.meta.env.VITE_API_URL ?? ''
  const defaultPassportBase = apiUrl
    ? `${apiUrl}/passport`
    : `http://${window.location.hostname}:8000/passport`
  const [passportBaseUrl, setPassportBaseUrl] = useState(defaultPassportBase)
  const [expanded, setExpanded] = useState(false)
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

  const payload = qrPayload(passport, passportBaseUrl)

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
        <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-6 animate-fade-in">
          {/* QR code */}
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
              <QRCodeSVG value={payload} size={160} level="M" />
            </div>
            <p className="text-xs text-slate-400 text-center max-w-[180px]">
              Scan to load exact reagents, protocol hash &amp; software versions
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

          {/* Passport details */}
          <div className="space-y-4 text-xs">
            <PassportField label="Protocol Hash" value={passport.protocol_hash} mono />
            <PassportField label="Passport ID" value={passport.passport_id} mono />
            <PassportField label="Random Seed" value={passport.random_seed} mono />
            <PassportField label="Generated" value={new Date(passport.generated_at).toLocaleString()} />

            {passport.reagents.length > 0 && (
              <div>
                <p className="font-semibold text-slate-600 mb-1">Reagents ({passport.reagents.length})</p>
                <ul className="space-y-0.5">
                  {passport.reagents.slice(0, 6).map((r, i) => (
                    <li key={i} className="text-slate-500 flex gap-1 flex-wrap">
                      <span className="font-medium text-slate-700 truncate max-w-[120px]">{r.name}</span>
                      {r.catalog_number && <span className="font-mono text-slate-400">· {r.catalog_number}</span>}
                    </li>
                  ))}
                  {passport.reagents.length > 6 && (
                    <li className="text-slate-400">+{passport.reagents.length - 6} more</li>
                  )}
                </ul>
              </div>
            )}

            {passport.equipment.length > 0 && (
              <div>
                <p className="font-semibold text-slate-600 mb-1">Equipment</p>
                <ul className="space-y-0.5">
                  {passport.equipment.map((e, i) => (
                    <li key={i} className="text-slate-500 truncate">{e.name}</li>
                  ))}
                </ul>
              </div>
            )}

            {passport.software.length > 0 && (
              <div>
                <p className="font-semibold text-slate-600 mb-1">Software</p>
                <p className="text-slate-500">{passport.software.join(', ')}</p>
              </div>
            )}
          </div>
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
