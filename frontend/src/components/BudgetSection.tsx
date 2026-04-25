import type { Budget } from '../types'

interface Props {
  budget: Budget
}

const CATEGORY_COLORS: string[] = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500',
  'bg-amber-500', 'bg-red-400', 'bg-teal-500', 'bg-pink-500',
]

export default function BudgetSection({ budget }: Props) {
  if (!budget) return <p className="text-slate-400 text-sm">No budget data available.</p>

  const categories = Object.entries(budget.categories ?? {})
  const total = budget.total_usd || categories.reduce((s, [, v]) => s + Number(v), 0)

  return (
    <div className="space-y-6">
      {/* Total + visual breakdown */}
      <div className="rounded-xl bg-navy-700 text-white p-5">
        <p className="text-white/70 text-sm font-medium">Total Estimated Budget</p>
        <p className="text-4xl font-extrabold mt-1">${total.toLocaleString()}</p>
        <p className="text-white/50 text-xs mt-1">{budget.currency || 'USD'}</p>

        {/* Stacked bar */}
        {categories.length > 0 && (
          <div className="mt-4">
            <div className="flex rounded-lg overflow-hidden h-4">
              {categories.map(([cat, val], i) => {
                const pct = total > 0 ? (Number(val) / total) * 100 : 0
                return (
                  <div
                    key={cat}
                    className={`${CATEGORY_COLORS[i % CATEGORY_COLORS.length]} transition-all`}
                    style={{ width: `${pct}%` }}
                    title={`${cat}: $${Number(val).toLocaleString()} (${pct.toFixed(1)}%)`}
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-3">
          {categories.map(([cat, val], i) => {
            const pct = total > 0 ? ((Number(val) / total) * 100).toFixed(1) : '0'
            return (
              <div key={cat} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-sm ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}`} />
                <span className="text-xs text-white/70">
                  {cat} <span className="text-white/90 font-semibold">{pct}%</span>
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Category summary cards */}
      {categories.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {categories.map(([cat, val], i) => {
            const pct = total > 0 ? ((Number(val) / total) * 100).toFixed(1) : '0'
            return (
              <div key={cat} className="rounded-xl border border-slate-200 p-4">
                <div className={`w-8 h-1.5 rounded-full mb-2 ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}`} />
                <p className="text-xs text-slate-500 font-medium">{cat}</p>
                <p className="text-lg font-bold text-slate-800 mt-0.5">${Number(val).toLocaleString()}</p>
                <p className="text-xs text-slate-400">{pct}% of total</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Line items table */}
      {budget.line_items && budget.line_items.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Line Items</h3>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Item</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Unit Cost</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {budget.line_items.map((item, i) => (
                  <tr key={i} className="table-row-hover">
                    <td className="px-4 py-2.5">
                      <span className="tag">{item.category}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="text-slate-800">{item.item}</p>
                      {item.notes && (
                        <p className="text-xs text-slate-400 mt-0.5">{item.notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-500 text-xs">{item.quantity}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">
                      ${(Number(item.unit_cost) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-800">
                      ${(Number(item.total_cost) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-navy-50 border-t-2 border-navy-200">
                  <td colSpan={4} className="px-4 py-3 text-sm font-bold text-navy-700">Total</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-navy-700">
                    ${total.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
