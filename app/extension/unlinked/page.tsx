"use client"

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import DashboardShell from '../../../components/DashboardShell'
import TerminalIcon from '../../../components/TerminalIcon'
import { setClientMonitoring } from '../../../lib/clients'

export default function UnlinkedPage() {
  const params = useSearchParams()
  const clientId = params.get('client_id')
  const handle = params.get('handle')
  const syncOnly = params.get('sync_only') === '1'
  const [status, setStatus] = useState<'syncing' | 'ready' | 'error'>('syncing')
  const [closeBlocked, setCloseBlocked] = useState(false)

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

  function handleCloseTab() {
    setCloseBlocked(false)
    window.open('', '_self')
    window.close()
    window.setTimeout(() => {
      setCloseBlocked(true)
    }, 250)
  }

  return (
    <DashboardShell>
      <div className="terminal-boot p-6">
        <div className="terminal-panel max-w-xl rounded p-5">
          <div className="terminal-label text-xs">Extension Sync</div>
          <h1 className="mt-2 flex items-center gap-2 text-xl font-semibold text-zinc-100">
            <TerminalIcon name={status === 'error' ? 'alert' : status === 'syncing' ? 'refresh' : 'check'} className="h-5 w-5 text-emerald-200" />
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

          {closeBlocked && (
            <div className="mt-4 rounded border border-zinc-800 bg-zinc-950/70 p-3 text-sm text-zinc-400">
              Chrome blocked automatic tab closing. You can close this setup tab manually.
            </div>
          )}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <a href="/dashboard" className="terminal-button inline-flex flex-1 justify-center rounded px-3 py-2 text-sm font-medium">
              Open Dashboard
            </a>
            <button
              type="button"
              disabled={status === 'syncing'}
              onClick={handleCloseTab}
              className="terminal-button-secondary inline-flex flex-1 justify-center rounded px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === 'syncing' ? 'Syncing...' : 'Close Setup Tab'}
            </button>
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}
