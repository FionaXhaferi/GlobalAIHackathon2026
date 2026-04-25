import { useState } from 'react'
import { ExternalLink, ChevronUp, ChevronDown } from 'lucide-react'
import type { Material } from '../types'

interface Props {
  materials: Material[]
}

type SortKey = 'category' | 'supplier' | 'total_cost'

const SUPPLIER_COLORS: Record<string, string> = {
  'Sigma-Aldrich':      'bg-orange-100 text-orange-800',
  'Thermo Fisher':      'bg-blue-100 text-blue-800',
  'Promega':            'bg-purple-100 text-purple-800',
  'Qiagen':             'bg-teal-100 text-teal-800',
  'ATCC':               'bg-green-100 text-green-800',
  'Addgene':            'bg-pink-100 text-pink-800',
  'IDT':                'bg-indigo-100 text-indigo-800',
}

function supplierClass(supplier: string): string {
  for (const [key, cls] of Object.entries(SUPPLIER_COLORS)) {
    if (supplier?.toLowerCase().includes(key.toLowerCase())) return cls
  }
  return 'bg-slate-100 text-slate-700'
}

export default function MaterialsTable({ materials }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('category')
  const [sortAsc, setSortAsc] = useState(true)
  const [filter, setFilter] = useState('')

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(true) }
  }

  const filtered = materials
    .filter((m) =>
      !filter ||
      m.name?.toLowerCase().includes(filter.toLowerCase()) ||
      m.supplier?.toLowerCase().includes(filter.toLowerCase()) ||
      m.category?.toLowerCase().includes(filter.toLowerCase())
    )
    .sort((a, b) => {
      let av: string | number = a[sortKey] ?? ''
      let bv: string | number = b[sortKey] ?? ''
      if (sortKey === 'total_cost') {
        av = Number(av) || 0
        bv = Number(bv) || 0
        return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number)
      }
      return sortAsc
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })

  const total = materials.reduce((s, m) => s + (Number(m.total_cost) || 0), 0)

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      onClick={() => toggleSort(k)}
      className="flex items-center gap-1 group hover:text-navy-700"
    >
      {label}
      {sortKey === k
        ? sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        : <ChevronUp className="w-3 h-3 opacity-0 group-hover:opacity-40" />}
    </button>
  )

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Filter materials…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-navy-400 focus:border-transparent"
        />
        <span className="text-xs text-slate-500">{filtered.length} items</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <th className="px-4 py-3 text-left">Item</th>
              <th className="px-4 py-3 text-left">Catalog #</th>
              <th className="px-4 py-3 text-left">
                <SortBtn k="supplier" label="Supplier" />
              </th>
              <th className="px-4 py-3 text-left">
                <SortBtn k="category" label="Category" />
              </th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Unit</th>
              <th className="px-4 py-3 text-right">
                <SortBtn k="total_cost" label="Total" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((m, i) => (
              <tr key={i} className="table-row-hover group">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{m.name}</p>
                  {m.notes && (
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{m.notes}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                    {m.catalog_number || '—'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {m.supplier ? (
                    <span className={`badge text-xs ${supplierClass(m.supplier)}`}>
                      {m.supplier}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className="tag">{m.category || 'Other'}</span>
                </td>
                <td className="px-4 py-3 text-right text-slate-600 text-xs">{m.quantity}</td>
                <td className="px-4 py-3 text-right text-slate-600 text-xs">
                  ${(Number(m.unit_cost) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-800">
                  ${(Number(m.total_cost) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-navy-50 border-t-2 border-navy-200">
              <td colSpan={6} className="px-4 py-3 text-sm font-bold text-navy-700">
                Materials Total
              </td>
              <td className="px-4 py-3 text-right text-sm font-bold text-navy-700">
                ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
