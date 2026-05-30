"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import DashboardShell from '../../components/DashboardShell'
import TerminalIcon from '../../components/TerminalIcon'
import { signOut } from '../../lib/auth'
import supabase from '../../lib/supabase'
import { PaywallPanel, useAccessStatus } from '../../components/AccessGate'

type NotificationSettings = {
  email_enabled: boolean
  email_recipients: string[]
  webhook_enabled: boolean
  webhook_url?: string | null
  min_level: 'Watch' | 'Risk' | 'Critical'
  dedupe_minutes: number
}

type StatusItem = {
  key: string
  label: string
  status: 'ok' | 'warn' | 'bad'
  detail: string
}

type Delivery = {
  id: string
  channel: 'email' | 'webhook'
  destination?: string | null
  status: 'sent' | 'failed' | 'skipped'
  trigger_key: string
  response_status?: number | null
  error?: string | null
  created_at?: string | null
}

const defaultSettings: NotificationSettings = {
  email_enabled: false,
  email_recipients: [],
  webhook_enabled: false,
  webhook_url: '',
  min_level: 'Risk',
  dedupe_minutes: 60,
}

function statusClass(status: StatusItem['status'] | Delivery['status']) {
  if (status === 'ok' || status === 'sent') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
  if (status === 'warn' || status === 'skipped') return 'border-amber-500/30 bg-amber-500/10 text-amber-100'
  return 'border-red-500/30 bg-red-500/10 text-red-200'
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const token = data.session?.access_token
  if (!token) throw new Error('Not authenticated')
  return token
}

async function apiFetch(path: string, token: string, options: RequestInit = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    cache: 'no-store',
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.success) throw new Error(body?.error || `Request failed (${res.status})`)
  return body
}

function downloadJsonFile(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function SettingsPage() {
  const router = useRouter()
  const access = useAccessStatus()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [checking, setChecking] = useState(false)
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings)
  const [statusItems, setStatusItems] = useState<StatusItem[]>([])
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exportingAccount, setExportingAccount] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')

  const enabledChannels = useMemo(() => {
    const channels = []
    if (settings.webhook_enabled) channels.push('Webhook')
    return channels.length ? channels.join(' + ') : 'No active channels'
  }, [settings.webhook_enabled])

  const loadSettings = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true)
    setError(null)
    try {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.push('/auth')
        return
      }

      const token = await getAccessToken()
      const [settingsBody, statusBody, deliveriesBody] = await Promise.all([
        apiFetch('/api/notification-settings', token),
        apiFetch('/api/integrations/status', token),
        apiFetch('/api/notification-deliveries?limit=20', token),
      ])

      const nextSettings = { ...defaultSettings, ...(settingsBody.settings ?? {}) }
      setSettings(nextSettings)
      setStatusItems(statusBody.items ?? [])
      setDeliveries(deliveriesBody.deliveries ?? [])
    } catch (loadError) {
      setError((loadError as Error).message)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    loadSettings(true)
  }, [loadSettings])

  async function saveSettings() {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const token = await getAccessToken()
      const body = await apiFetch('/api/notification-settings', token, {
        method: 'PATCH',
        body: JSON.stringify({
          ...settings,
          email_enabled: false,
          email_recipients: [],
        }),
      })

      const nextSettings = { ...defaultSettings, ...(body.settings ?? {}) }
      setSettings(nextSettings)
      setMessage('Notification settings saved.')
      await loadSettings(false)
    } catch (saveError) {
      setError((saveError as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function persistCurrentSettings(token: string) {
    const body = await apiFetch('/api/notification-settings', token, {
      method: 'PATCH',
      body: JSON.stringify({
        ...settings,
        email_enabled: false,
        email_recipients: [],
      }),
    })

    const nextSettings = { ...defaultSettings, ...(body.settings ?? {}) }
    setSettings(nextSettings)
    return nextSettings
  }

  async function sendTest() {
    setTesting(true)
    setError(null)
    setMessage(null)
    try {
      const token = await getAccessToken()
      await persistCurrentSettings(token)
      await apiFetch('/api/notification-test', token, { method: 'POST', body: JSON.stringify({}) })
      setMessage('Webhook test sent. Check webhook.site and the delivery log below.')
      await loadSettings(false)
    } catch (testError) {
      setError((testError as Error).message)
    } finally {
      setTesting(false)
    }
  }

  async function runCheck() {
    setChecking(true)
    setError(null)
    try {
      const token = await getAccessToken()
      const [statusBody, deliveriesBody] = await Promise.all([
        apiFetch('/api/integrations/status', token),
        apiFetch('/api/notification-deliveries?limit=20', token),
      ])
      setStatusItems(statusBody.items ?? [])
      setDeliveries(deliveriesBody.deliveries ?? [])
      setMessage('Integration check refreshed.')
    } catch (checkError) {
      setError((checkError as Error).message)
    } finally {
      setChecking(false)
    }
  }

  async function exportAccountData() {
    setExportingAccount(true)
    setError(null)
    setMessage(null)
    try {
      const token = await getAccessToken()
      const body = await apiFetch('/api/account/export', token)
      downloadJsonFile(`banshi-account-export-${new Date().toISOString().slice(0, 10)}.json`, body)
      setMessage('Account export downloaded.')
    } catch (exportError) {
      setError((exportError as Error).message)
    } finally {
      setExportingAccount(false)
    }
  }

  async function deleteAccount() {
    if (deleteConfirm !== 'DELETE') {
      setError('Type DELETE before deleting the account.')
      return
    }

    const confirmed = window.confirm('This permanently deletes your workspace data and auth account. Continue?')
    if (!confirmed) return

    setDeletingAccount(true)
    setError(null)
    setMessage(null)
    try {
      const token = await getAccessToken()
      await apiFetch('/api/account/delete', token, {
        method: 'DELETE',
        body: JSON.stringify({ confirm: 'DELETE' }),
      })
      await signOut()
      router.push('/auth')
    } catch (deleteError) {
      setError((deleteError as Error).message)
    } finally {
      setDeletingAccount(false)
    }
  }

  if (access.loading) {
    return (
      <DashboardShell>
        <div className="p-4 sm:p-6">
          <div className="terminal-panel rounded p-5 text-sm text-zinc-400">Checking workspace access...</div>
        </div>
      </DashboardShell>
    )
  }

  if (loading) {
    return (
      <DashboardShell>
        <div className="p-4 sm:p-6">
          <div className="mb-6 h-8 w-56 animate-pulse rounded bg-zinc-900" />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {[0, 1, 2].map((item) => <div key={item} className="h-72 animate-pulse rounded border border-zinc-800 bg-zinc-900" />)}
          </div>
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
      <div className="terminal-boot p-4 sm:p-6">
        <div className="terminal-panel mb-6 rounded p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="terminal-label text-xs">workspace controls</div>
              <h1 className="mt-2 text-2xl font-semibold text-zinc-50">Settings</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                Notification routing, delivery checks, and integration health for the monitoring pipeline.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={checking}
                onClick={runCheck}
                className="terminal-button-secondary focus-ring inline-flex items-center gap-2 rounded px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                <TerminalIcon name="refresh" className="h-4 w-4" />
                {checking ? 'Checking...' : 'Run check'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await signOut()
                  router.push('/auth')
                }}
                className="terminal-button-secondary focus-ring rounded px-3 py-2 text-sm"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {error && <div className="mb-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</div>}
        {message && <div className="mb-4 rounded border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">{message}</div>}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <section className="terminal-panel rounded p-5">
            <div className="flex flex-col gap-3 border-b border-zinc-800 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="terminal-label text-xs">alert routing</div>
                <h2 className="mt-1 text-xl font-semibold text-zinc-50">{enabledChannels}</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-500">Alerts send only when a client moves into a configured risk level, then cool down to prevent repeat noise.</p>
              </div>
              <button
                type="button"
                disabled={testing}
                onClick={sendTest}
                className="terminal-button focus-ring inline-flex items-center justify-center gap-2 rounded px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
              >
                <TerminalIcon name="zap" className="h-4 w-4" />
                {testing ? 'Sending...' : 'Save & send test'}
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-5">
              <label className="rounded border border-zinc-800 bg-black/25 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-zinc-100">Webhook alerts</div>
                    <div className="mt-1 text-xs text-zinc-500">Discord, Slack, webhook.site, Zapier, or internal ops.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.webhook_enabled}
                    onChange={(event) => setSettings((current) => ({ ...current, webhook_enabled: event.target.checked }))}
                    className="h-5 w-5 accent-emerald-400"
                  />
                </div>
                <input
                  value={settings.webhook_url ?? ''}
                  onChange={(event) => setSettings((current) => ({ ...current, webhook_url: event.target.value }))}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="terminal-input mt-4 w-full rounded px-3 py-2 text-sm placeholder:text-zinc-700"
                />
              </label>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label>
                <div className="text-xs uppercase tracking-wide text-zinc-500">Minimum level</div>
                <select
                  value={settings.min_level}
                  onChange={(event) => setSettings((current) => ({ ...current, min_level: event.target.value as NotificationSettings['min_level'] }))}
                  className="terminal-input mt-2 w-full rounded px-3 py-2 text-sm"
                >
                  <option value="Watch">Watch and above</option>
                  <option value="Risk">Risk and above</option>
                  <option value="Critical">Critical only</option>
                </select>
              </label>

              <label>
                <div className="text-xs uppercase tracking-wide text-zinc-500">Cooldown minutes</div>
                <input
                  type="number"
                  min={5}
                  max={1440}
                  value={settings.dedupe_minutes}
                  onChange={(event) => setSettings((current) => ({ ...current, dedupe_minutes: Number(event.target.value || 60) }))}
                  className="terminal-input mt-2 w-full rounded px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4">
              <div className="text-sm text-zinc-500">Recommended MVP default: Risk and above, 60 minute cooldown.</div>
              <button
                type="button"
                disabled={saving}
                onClick={saveSettings}
                className="terminal-button focus-ring inline-flex items-center gap-2 rounded px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
              >
                <TerminalIcon name="check" className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save settings'}
              </button>
            </div>
          </section>

          <section className="terminal-card rounded p-5">
            <div className="terminal-label text-xs">integration health</div>
            <h2 className="mt-1 text-xl font-semibold text-zinc-50">System Check</h2>
            <div className="mt-4 space-y-3">
              {statusItems.map((item) => (
                <div key={item.key} className="rounded border border-zinc-800 bg-black/25 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-zinc-100">{item.label}</div>
                      <div className="mt-1 text-xs leading-5 text-zinc-500">{item.detail}</div>
                    </div>
                    <span className={`shrink-0 rounded border px-2 py-1 text-xs font-medium ${statusClass(item.status)}`}>{item.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="terminal-card mt-6 rounded">
          <div className="flex flex-col gap-3 border-b border-zinc-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="terminal-label text-xs">delivery audit</div>
              <h2 className="mt-1 text-lg font-medium text-zinc-100">Recent Notification Attempts</h2>
            </div>
            <Link href="/alerts" className="terminal-button-secondary focus-ring inline-flex items-center gap-2 rounded px-3 py-2 text-sm">
              Alert feed
              <TerminalIcon name="arrowRight" className="h-4 w-4" />
            </Link>
          </div>

          {deliveries.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-zinc-500">No delivery attempts yet. Save a channel and send a test.</div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {deliveries.map((delivery) => (
                <div key={delivery.id} className="grid grid-cols-1 gap-3 px-5 py-4 text-sm lg:grid-cols-[140px_minmax(0,1fr)_140px_180px] lg:items-center">
                  <div>
                    <span className={`rounded border px-2 py-1 text-xs font-medium ${statusClass(delivery.status)}`}>{delivery.status}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-zinc-100">{delivery.channel}</div>
                    <div className="mt-1 truncate text-xs text-zinc-500">{delivery.destination || delivery.trigger_key}</div>
                    {delivery.error && <div className="mt-1 text-xs text-red-200">{delivery.error}</div>}
                  </div>
                  <div className="text-zinc-500">{delivery.response_status ?? '-'}</div>
                  <div className="text-zinc-500">{formatDate(delivery.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="terminal-card mt-6 rounded p-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="terminal-label text-xs">account and data</div>
              <h2 className="mt-1 text-lg font-medium text-zinc-100">Export or delete your workspace</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Export downloads a JSON archive of your clients, snapshots, risk history, alerts, investigation logs, notification settings, and delivery attempts. Delete removes workspace data and then attempts to delete the auth user.
              </p>
            </div>
            <button
              type="button"
              disabled={exportingAccount}
              onClick={exportAccountData}
              className="terminal-button-secondary focus-ring inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            >
              <TerminalIcon name="database" className="h-4 w-4" />
              {exportingAccount ? 'Exporting...' : 'Export account data'}
            </button>
          </div>

          <div className="mt-5 rounded border border-red-500/25 bg-red-500/5 p-4">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-end">
              <div>
                <div className="text-sm font-medium text-red-100">Delete account</div>
                <p className="mt-1 text-xs leading-5 text-red-100/70">
                  Permanent. Type DELETE, then confirm. This also unlinks all clients from the hosted workspace.
                </p>
              </div>
              <input
                value={deleteConfirm}
                onChange={(event) => setDeleteConfirm(event.target.value)}
                placeholder="Type DELETE"
                className="terminal-input rounded px-3 py-2 text-sm placeholder:text-zinc-700"
              />
              <button
                type="button"
                disabled={deletingAccount || deleteConfirm !== 'DELETE'}
                onClick={deleteAccount}
                className="focus-ring rounded border border-red-500/35 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-100 transition hover:border-red-400/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingAccount ? 'Deleting...' : 'Delete account'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  )
}
