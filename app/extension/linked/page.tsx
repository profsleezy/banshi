"use client"

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import DashboardShell from '../../../components/DashboardShell'
import TerminalIcon from '../../../components/TerminalIcon'
import { setClientMonitoring } from '../../../lib/clients'

export default function LinkedPage() {
  const params = useSearchParams()
  const clientId = params.get('client_id')
  const handle = params.get('handle')
  const existed = params.get('existed') === '1'
  const [status, setStatus] = useState<'syncing' | 'ready' | 'error'>('syncing')
  const [closeBlocked, setCloseBlocked] = useState(false)

  useEffect(() => {
    let mounted = true

    async function syncMonitoring() {
      if (!clientId) {
        setStatus('error')
        return
      }

      const res = await setClientMonitoring(clientId, true)
      if (!mounted) return
      setStatus(res.error ? 'error' : 'ready')
    }

    syncMonitoring()
    return () => {
      mounted = false
    }
  }, [clientId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (window.location.hash.includes('ingest_token')) {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
      }
    }, 1500)

    return () => window.clearTimeout(timer)
  }, [])

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
          <div className="terminal-label text-xs">Extension Link</div>
          <h1 className="mt-2 flex items-center gap-2 text-xl font-semibold text-zinc-100">
            <TerminalIcon name={status === 'error' ? 'alert' : status === 'ready' ? 'check' : 'refresh'} className="h-5 w-5 text-emerald-200" />
            {status === 'ready' ? 'Monitoring Started' : status === 'error' ? 'Needs Attention' : 'Finishing Setup'}
          </h1>

          <p className="mt-3 text-sm text-zinc-400">
            {handle ? <><strong className="text-zinc-100">@{handle}</strong> </> : null}
            {status === 'ready'
              ? 'is now linked to the extension and will be included in future snapshots.'
              : status === 'error'
                ? 'was detected, but monitoring state could not be confirmed.'
                : 'is being synced with your dashboard and extension.'}
          </p>

          {existed && <p className="mt-3 text-sm text-amber-200">This profile already existed, so monitoring was re-enabled instead of creating a duplicate.</p>}

          <div className="mt-4 rounded border border-zinc-800 bg-zinc-950/70 p-3 text-sm leading-6 text-zinc-400">
            For live snapshots, keep the Instagram profile tab open in Chrome. It can stay in the background; this setup tab is only for confirming the link.
          </div>

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
