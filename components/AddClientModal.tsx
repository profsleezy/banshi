"use client"

import { useEffect, useState, type FormEvent } from 'react'

export type NewClientData = {
  client_name: string
  platform: 'Meta' | 'IG'
  account_id: string
  notes?: string
}

type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (data: NewClientData) => void | Promise<void>
  submitting?: boolean
}

export default function AddClientModal({ open, onClose, onSubmit, submitting = false }: Props) {
  const [clientName, setClientName] = useState('')
  const [platform, setPlatform] = useState<NewClientData['platform']>('Meta')
  const [accountId, setAccountId] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) {
      setClientName('')
      setPlatform('Meta')
      setAccountId('')
      setNotes('')
      setErrors({})
    }
  }, [open])

  if (!open) return null

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!clientName.trim()) e.client_name = 'Client name is required'
    if (!accountId.trim()) e.account_id = 'Account ID is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault()
    if (submitting) return
    if (!validate()) return
    await onSubmit({ client_name: clientName.trim(), platform, account_id: accountId.trim(), notes: notes.trim() || undefined })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={submitting ? undefined : onClose} />

      <div className="relative w-full max-w-md mx-4 bg-zinc-900 border border-zinc-800 rounded shadow-lg p-6">
        <h3 className="text-lg font-medium mb-4">Add Client</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Client name</label>
            <input
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              className="w-full px-3 py-2 bg-transparent border border-zinc-800 rounded focus:outline-none"
              placeholder="Acme Co"
            />
            {errors.client_name && <div className="text-xs text-rose-400 mt-1">{errors.client_name}</div>}
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Platform</label>
            <select
              value={platform}
              onChange={e => setPlatform(e.target.value as NewClientData['platform'])}
              className="w-full px-3 py-2 bg-transparent border border-zinc-800 rounded"
            >
              <option value="Meta">Meta</option>
              <option value="IG">IG</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Account ID</label>
            <input
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
              className="w-full px-3 py-2 bg-transparent border border-zinc-800 rounded"
              placeholder="1234567890"
            />
            {errors.account_id && <div className="text-xs text-rose-400 mt-1">{errors.account_id}</div>}
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-transparent border border-zinc-800 rounded min-h-[72px]"
              placeholder="Anything useful to remember"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={submitting} className="px-3 py-1 border border-zinc-800 rounded text-sm disabled:cursor-not-allowed disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="px-3 py-1 bg-emerald-700 text-white rounded text-sm disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? 'Adding...' : 'Add client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
