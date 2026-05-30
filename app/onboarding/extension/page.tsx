"use client"

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardShell from '../../../components/DashboardShell'
import TerminalIcon from '../../../components/TerminalIcon'
import { supabase } from '../../../lib/supabase'
import { PaywallPanel, useAccessStatus } from '../../../components/AccessGate'

const extensionUrl = process.env.NEXT_PUBLIC_CHROME_EXTENSION_URL || 'https://microsoftedge.microsoft.com/addons/detail/your-extension-id'

type Step = {
  title: string
  copy: string
  detail: string
  icon: 'lock' | 'shield' | 'eye' | 'zap' | 'chart'
}

function SetupStep({ index, step }: { index: number; step: Step }) {
  return (
    <div className="terminal-card rounded p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
          <TerminalIcon name={step.icon} className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="terminal-label text-xs">step {index + 1}</div>
          <h3 className="mt-1 text-base font-semibold text-zinc-50">{step.title}</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{step.copy}</p>
          <p className="mt-3 rounded border border-zinc-800 bg-black/30 px-3 py-2 text-xs leading-5 text-zinc-500">{step.detail}</p>
        </div>
      </div>
    </div>
  )
}

export default function ExtensionOnboardingPage() {
  const router = useRouter()
  const access = useAccessStatus()
  const [checkingSession, setCheckingSession] = useState(true)
  const [installOpened, setInstallOpened] = useState(false)
  const [continuing, setContinuing] = useState(false)

  const steps = useMemo<Step[]>(
    () => [
      {
        title: 'Install the browser extension',
        copy: 'Use the Edge Add-ons link for production. During local development, load the unpacked extension from the browser extensions page.',
        detail: 'The extension is what reads the currently open public Instagram profile page and links it to your Banshi workspace.',
        icon: 'shield',
      },
      {
        title: 'Pin Banshi in the toolbar',
        copy: 'Pinning makes the workflow obvious for operators: open profile, click Banshi, link profile, leave the tab available.',
        detail: 'This reduces missed setup steps when an agency has multiple accounts to connect.',
        icon: 'lock',
      },
      {
        title: 'Open a real Instagram profile page',
        copy: 'The link button is meant for profile pages only. Do not link feeds, reels, search pages, settings pages, or random websites.',
        detail: 'A valid profile page gives the extension the handle, public profile metadata, and snapshot context it needs.',
        icon: 'eye',
      },
      {
        title: 'Link the profile from the extension',
        copy: 'Click Link current profile. The account becomes monitored immediately and gets a secure ingest token for snapshots.',
        detail: 'Unmonitor pauses future snapshots. Remove client deletes the client from the workspace.',
        icon: 'zap',
      },
      {
        title: 'Confirm the first snapshot',
        copy: 'Keep the Instagram profile tab open or in the background so the browser can keep the scraper context alive.',
        detail: 'Then check the dashboard: the client card should show latest snapshot time, followers, posts, stability, and live signals.',
        icon: 'chart',
      },
    ],
    [],
  )

  useEffect(() => {
    let mounted = true

    async function checkSession() {
      const { data } = await supabase.auth.getUser()
      if (!mounted) return
      if (!data.user) {
        router.push('/auth')
        return
      }
      setCheckingSession(false)
    }

    checkSession()

    return () => {
      mounted = false
    }
  }, [router])

  function openInstallLink() {
    setInstallOpened(true)
    window.open(extensionUrl, '_blank', 'noopener,noreferrer')
  }

  function continueToDashboard() {
    setContinuing(true)
    try {
      window.localStorage.setItem('banshi_extension_onboarding_seen', '1')
    } catch {
      // If browser storage is unavailable, still let the user continue.
    }
    router.push('/dashboard')
  }

  if (checkingSession || access.loading) {
    return (
      <DashboardShell>
        <div className="p-6">
          <div className="terminal-panel rounded p-5 text-sm text-zinc-400">Checking session...</div>
        </div>
      </DashboardShell>
    )
  }

  if (!access.active) {
    return (
      <DashboardShell>
        <PaywallPanel access={access.access} error={access.error} />
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
          <div className="terminal-panel rounded-lg p-6 sm:p-8">
            <div className="terminal-chip inline-flex items-center gap-2 rounded px-3 py-1 text-xs font-medium">
              <TerminalIcon name="terminal" className="h-3.5 w-3.5" />
              extension onboarding
            </div>
            <h1 className="mt-5 max-w-3xl text-3xl font-semibold leading-tight text-zinc-50">
              Connect the browser extension and get to the first live snapshot.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">
              Banshi works best when setup feels like an operator checklist: install, pin, open an Instagram profile, link it, and verify the first signal. The tab can stay in the background, but it must stay open for live scraping to continue.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={openInstallLink}
                className="terminal-button focus-ring inline-flex items-center justify-center gap-2 rounded px-5 py-3 text-sm font-semibold"
              >
                <TerminalIcon name="arrowRight" className="h-4 w-4" />
                Install extension
              </button>
              <button
                type="button"
                onClick={continueToDashboard}
                disabled={continuing}
                className="terminal-button-secondary focus-ring inline-flex items-center justify-center gap-2 rounded px-5 py-3 text-sm font-medium"
              >
                {continuing ? <TerminalIcon name="refresh" className="h-4 w-4" /> : <TerminalIcon name="check" className="h-4 w-4" />}
                {continuing ? 'Opening dashboard...' : 'Continue to dashboard'}
              </button>
            </div>

            <div className="mt-5 rounded border border-zinc-800 bg-black/30 p-3 text-xs leading-5 text-zinc-500">
              Extension URL: <span className="text-zinc-300">{extensionUrl}</span>
            </div>
          </div>

          <aside className="terminal-card rounded p-5">
            <div className="terminal-label text-xs">operator note</div>
            <h2 className="mt-2 text-xl font-semibold text-zinc-50">Keep the profile tab available</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Snapshots come from open Instagram profile tabs. The tab can sit behind other work, but if the browser closes or the tab navigates away, the extension cannot collect fresh profile data.
            </p>
            <div className="terminal-divider my-5" />
            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between rounded border border-zinc-800 bg-black/30 px-3 py-2">
                <span className="text-zinc-400">Install opened</span>
                <span className={installOpened ? 'text-emerald-200' : 'text-zinc-600'}>{installOpened ? 'yes' : 'pending'}</span>
              </div>
              <div className="flex items-center justify-between rounded border border-zinc-800 bg-black/30 px-3 py-2">
                <span className="text-zinc-400">Profile page required</span>
                <span className="text-emerald-200">yes</span>
              </div>
              <div className="flex items-center justify-between rounded border border-zinc-800 bg-black/30 px-3 py-2">
                <span className="text-zinc-400">Snapshots need open tab</span>
                <span className="text-amber-100">yes</span>
              </div>
            </div>
            <Link href="/support" className="mt-5 inline-flex text-sm text-zinc-500 hover:text-emerald-200">
              Need help with setup?
            </Link>
          </aside>
        </section>

        <section className="mt-5 grid gap-3 lg:grid-cols-5">
          {steps.map((step, index) => (
            <SetupStep key={step.title} index={index} step={step} />
          ))}
        </section>
      </div>
    </DashboardShell>
  )
}
