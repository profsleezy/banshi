"use client"

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import DashboardShell from '../../../components/DashboardShell'
import { setClientMonitoring } from '../../../lib/clients'

export default function UnlinkedPage() {
  const params = useSearchParams()
  const clientId = params.get('client_id')
  const handle = params.get('handle')
  const syncOnly = params.get('sync_only') === '1'
  const [status, setStatus] = useState<'syncing' | 'ready' | 'error'>('syncing')

  useEffect(() => {
    let mounted = true

    async function syncMonitoring() {
      if (syncOnly || !clientId) {
        setStatus('ready')
        return
      }

      const res = await setClientMonitoring(clientId, false)
      if (!mounted) return
      setStatus(res.error ? 'error' : 'ready')
    }

    syncMonitoring()
    return () => {
      mounted = false
    }
  }, [clientId, syncOnly])

  return (
    <DashboardShell>
      <div className="p-6">
        <div className="max-w-xl rounded border border-zinc-800 bg-zinc-900 p-5">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Extension Sync</div>
          <h1 className="mt-2 text-xl font-semibold text-zinc-100">
            {syncOnly ? 'Extension Updated' : status === 'ready' ? 'Monitoring Paused' : status === 'error' ? 'Needs Attention' : 'Pausing Monitoring'}
          </h1>

          <p className="mt-3 text-sm text-zinc-400">
            {handle ? <><strong className="text-zinc-100">@{handle}</strong> </> : null}
            {syncOnly
              ? 'was removed from the extension monitored list.'
              : status === 'ready'
                ? 'will remain in your dashboard history, but the extension will stop taking new snapshots.'
                : status === 'error'
                  ? 'was removed locally, but the dashboard state could not be confirmed.'
                  : 'is being removed from active extension monitoring.'}
          </p>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <a href="/dashboard" className="inline-flex flex-1 justify-center rounded border border-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:border-zinc-700">
              Open Dashboard
            </a>
            <button
              type="button"
              disabled={status === 'syncing'}
              onClick={() => window.close()}
              className="inline-flex flex-1 justify-center rounded border border-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:border-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === 'syncing' ? 'Syncing...' : 'Close Tab'}
            </button>
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}
