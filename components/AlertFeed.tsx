"use client"

import TerminalIcon from './TerminalIcon'

export type AlertRow = {
  id: string
  title: string
  severity: 'warning' | 'critical'
  message: string
  created_at?: string
}

type Props = {
  alerts: AlertRow[]
}

function formatDate(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

export default function AlertFeed({ alerts }: Props) {
  return (
    <section className="terminal-card rounded">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-100">
          <TerminalIcon name="alert" className="h-4 w-4 text-amber-100" />
          Recent Alerts
        </h3>
      </div>

      {!alerts || alerts.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-zinc-500">No recent alerts in the queue</div>
      ) : (
        <div className="max-h-[360px] overflow-y-auto">
          {alerts.map((alert) => (
            <div key={alert.id} className="group border-b border-zinc-800/70 px-4 py-3 transition hover:bg-emerald-300/[0.03] last:border-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-zinc-100">{alert.title}</div>
                  <div className="mt-1 max-h-10 overflow-hidden text-xs leading-5 text-zinc-500">{alert.message}</div>
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded border px-2 py-1 text-xs font-medium ${alert.severity === 'critical' ? 'border-red-500/40 bg-red-500/10 text-red-200' : 'border-amber-500/40 bg-amber-500/10 text-amber-100'}`}>
                  <TerminalIcon name={alert.severity === 'critical' ? 'zap' : 'alert'} className="h-3 w-3" />
                  {alert.severity}
                </span>
              </div>
              <div className="mt-2 text-xs text-zinc-600">{formatDate(alert.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
