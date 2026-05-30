const STORAGE_MONITORED_KEY = 'banshi_monitored_clients'
const STORAGE_API_KEY = 'banshi_api_base_url'
const STORAGE_INTERVAL_KEY = 'banshi_snapshot_interval_minutes'
const DEFAULT_API_BASE = 'http://localhost:3000'
const DEFAULT_SNAPSHOT_INTERVAL_MINUTES = 5
const SNAPSHOT_INTERVAL_OPTIONS = [1, 5, 15, 30]
const IG_PROFILE_PATH_BLACKLIST = ['p', 'explore', 'stories', 'direct', 'accounts', 'a', 'reel', 'reels', 'tag', 'tv', 'about', 'developer', 'graphql']
let currentSnapshotIntervalMinutes = DEFAULT_SNAPSHOT_INTERVAL_MINUTES

function normalizeHandle(value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase()
}

function isValidInstagramHandle(value) {
  return /^[a-z0-9._]{1,30}$/i.test(value) && !IG_PROFILE_PATH_BLACKLIST.includes(value)
}

function instagramUrl(handle) {
  const normalized = normalizeHandle(handle)
  return normalized ? `https://www.instagram.com/${encodeURIComponent(normalized)}/` : 'https://www.instagram.com/'
}

function normalizeSnapshotInterval(value) {
  const parsed = Number(value)
  return SNAPSHOT_INTERVAL_OPTIONS.includes(parsed) ? parsed : DEFAULT_SNAPSHOT_INTERVAL_MINUTES
}

function staleSyncMs() {
  return Math.max(15 * 60 * 1000, currentSnapshotIntervalMinutes * 3 * 60 * 1000)
}

function getInstagramHandleFromUrl(url) {
  try {
    const parsed = new URL(url)
    if (!/(^|\.)instagram\.com$/i.test(parsed.hostname)) return ''
    const parts = parsed.pathname.split('/').filter(Boolean)
    if (parts.length !== 1) return ''
    const handle = normalizeHandle(parts[0])
    if (!isValidInstagramHandle(handle)) return ''
    return handle
  } catch (e) {
    return ''
  }
}

function formatRelative(value) {
  if (!value) return 'never synced'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'never synced'
  const diff = Date.now() - date.getTime()
  if (diff < 60 * 1000) return 'just now'
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function isStale(item) {
  if (!item || !item.last_synced) return true
  const ts = new Date(item.last_synced).getTime()
  if (Number.isNaN(ts)) return true
  return Date.now() - ts > staleSyncMs()
}

function openUrl(url) {
  try {
    chrome.tabs.create({ url })
  } catch (err) {
    console.warn('failed to open tab', err)
  }
}

function dashboardUrl(base, path) {
  return `${(base || DEFAULT_API_BASE).replace(/\/$/, '')}${path}`
}

function setText(id, value) {
  const el = document.getElementById(id)
  if (el) el.textContent = value
}

function renderSummary(list) {
  const keys = Object.keys(list || {})
  const synced = keys.filter((handle) => list[handle] && list[handle].last_synced).length
  const stale = keys.filter((handle) => isStale(list[handle])).length

  setText('monitoredCount', String(keys.length))
  setText('syncedCount', String(synced))
  setText('staleCount', String(stale))
  setText('status', keys.length ? 'Monitoring' : 'Ready')
}

function renderAttention(list) {
  const container = document.getElementById('attention')
  container.innerHTML = ''

  const keys = Object.keys(list || {})
  const missingToken = keys.filter((handle) => !list[handle] || !list[handle].ingest_token)
  const stale = keys.filter((handle) => isStale(list[handle]))

  if (keys.length === 0) {
    container.appendChild(attentionRow('No clients linked', 'Open an Instagram profile and link it to start monitoring.', 'idle'))
    return
  }

  if (missingToken.length > 0) {
    container.appendChild(attentionRow('Reconnect clients', `Open each highlighted Instagram profile, then use the main Link button. This gives the extension a new secure key.`, 'review'))
    return
  }

  if (stale.length === 0) {
    container.appendChild(attentionRow('Local sync looks current', 'Recent snapshots have been accepted for monitored clients.', 'ok'))
    return
  }

  container.appendChild(attentionRow('Snapshot check needed', `${stale.length} monitored client${stale.length === 1 ? '' : 's'} missed the expected ${currentSnapshotIntervalMinutes}m cycle. Keep their Instagram tabs open for live snapshots.`, 'review'))
}

function attentionRow(title, copy, badge) {
  const row = document.createElement('div')
  row.className = 'attention-row'

  const text = document.createElement('div')
  const titleEl = document.createElement('div')
  titleEl.className = 'attention-title'
  titleEl.textContent = title
  const copyEl = document.createElement('div')
  copyEl.className = 'attention-copy'
  copyEl.textContent = copy
  text.appendChild(titleEl)
  text.appendChild(copyEl)

  const badgeEl = document.createElement('div')
  badgeEl.className = badge === 'review' ? 'badge warn' : 'badge'
  badgeEl.textContent = badge

  row.appendChild(text)
  row.appendChild(badgeEl)
  return row
}

function renderClients(list) {
  const container = document.getElementById('clients')
  container.innerHTML = ''
  const keys = Object.keys(list || {}).sort((a, b) => a.localeCompare(b))

  renderSummary(list)
  renderAttention(list)

  if (keys.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'empty'
    empty.textContent = 'No monitored clients yet.'
    container.appendChild(empty)
    return
  }

  keys.forEach((handle) => {
    const item = list[handle] || {}
    const normalized = normalizeHandle(handle)
    const needsRelink = !item.ingest_token
    const row = document.createElement('div')
    row.className = needsRelink ? 'client needs-link' : 'client'
    row.setAttribute('role', 'button')
    row.setAttribute('tabindex', '0')
    row.title = `Open @${normalized} on Instagram`
    row.addEventListener('click', () => openUrl(instagramUrl(normalized)))
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        openUrl(instagramUrl(normalized))
      }
    })

    const main = document.createElement('div')
    const name = document.createElement('div')
    name.className = 'client-name'
    name.textContent = item.name || normalized
    const meta = document.createElement('div')
    meta.className = 'client-meta'
    meta.textContent = needsRelink ? `@${normalized} - open profile to reconnect` : `@${normalized} - ${formatRelative(item.last_synced)}`
    main.appendChild(name)
    main.appendChild(meta)

    const action = document.createElement('button')
    action.type = 'button'
    action.className = needsRelink ? 'client-action primary' : 'client-action'
    action.dataset.h = normalized
    action.textContent = needsRelink ? 'Open profile' : 'Unmonitor'
    action.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (needsRelink) openProfileForRelink(normalized, action)
      else unmonitorClient(normalized, action)
    })

    row.appendChild(main)
    row.appendChild(action)
    container.appendChild(row)
  })
}

function renderIntervalControl(minutes) {
  currentSnapshotIntervalMinutes = normalizeSnapshotInterval(minutes)
  const label = document.getElementById('intervalLabel')
  if (label) label.textContent = `Every ${currentSnapshotIntervalMinutes} min`

  document.querySelectorAll('[data-interval]').forEach((button) => {
    const value = normalizeSnapshotInterval(button.getAttribute('data-interval'))
    button.classList.toggle('active', value === currentSnapshotIntervalMinutes)
    button.setAttribute('aria-pressed', value === currentSnapshotIntervalMinutes ? 'true' : 'false')
  })
}

function setSnapshotInterval(minutes, sourceButton) {
  const interval = normalizeSnapshotInterval(minutes)
  if (sourceButton) sourceButton.disabled = true

  chrome.runtime.sendMessage({ type: 'SET_SNAPSHOT_INTERVAL', minutes: interval }, (resp) => {
    const err = chrome.runtime.lastError
    if (err || !resp || !resp.ok) {
      console.warn('snapshot interval update failed', err || resp)
      if (sourceButton) sourceButton.disabled = false
      return
    }

    currentSnapshotIntervalMinutes = normalizeSnapshotInterval(resp.minutes)
    renderIntervalControl(currentSnapshotIntervalMinutes)
    chrome.storage.local.get([STORAGE_MONITORED_KEY], (res) => {
      renderClients((res && res[STORAGE_MONITORED_KEY]) ? res[STORAGE_MONITORED_KEY] : {})
      if (sourceButton) sourceButton.disabled = false
    })
  })
}

function updateLinkButtonForActiveTab(button) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0]
    const handle = tab && tab.url ? getInstagramHandleFromUrl(tab.url) : ''

    if (!handle) {
      button.disabled = true
      button.textContent = 'Open an Instagram profile'
      button.title = 'Go to a public Instagram profile page, then open Banshi again.'
      return
    }

    button.disabled = false
    button.textContent = `Link @${handle}`
    button.title = `Link @${handle} to Banshi`
  })
}

function openProfileForRelink(handle, button) {
  if (!handle) return
  button.disabled = true
  button.textContent = 'Opening...'
  openUrl(instagramUrl(handle))
  window.setTimeout(() => {
    button.disabled = false
    button.textContent = 'Open profile'
  }, 1200)
}

function unmonitorClient(handle, button) {
  if (!handle) return
  button.disabled = true
  button.textContent = 'Working...'

  chrome.storage.local.get([STORAGE_MONITORED_KEY, STORAGE_API_KEY], (res) => {
    const monitored = (res && res[STORAGE_MONITORED_KEY]) ? res[STORAGE_MONITORED_KEY] : {}
    const item = monitored[handle] || {}
    const base = (res && res[STORAGE_API_KEY]) ? res[STORAGE_API_KEY] : DEFAULT_API_BASE
    const params = new URLSearchParams()

    if (item.client_id) params.set('client_id', item.client_id)
    if (handle) params.set('handle', handle)
    if (item.name) params.set('name', item.name)

    openUrl(dashboardUrl(base, `/extension/unlinked?${params.toString()}`))

    delete monitored[handle]
    chrome.storage.local.set({ [STORAGE_MONITORED_KEY]: monitored }, () => renderClients(monitored))
  })
}

function init() {
  const linkBtn = document.getElementById('link')
  const dashboardBtn = document.getElementById('dashboard')
  const alertsBtn = document.getElementById('alerts')

  chrome.storage.local.get([STORAGE_MONITORED_KEY, STORAGE_API_KEY, STORAGE_INTERVAL_KEY], (res) => {
    const monitored = (res && res[STORAGE_MONITORED_KEY]) ? res[STORAGE_MONITORED_KEY] : {}
    const base = (res && res[STORAGE_API_KEY]) ? res[STORAGE_API_KEY] : DEFAULT_API_BASE
    currentSnapshotIntervalMinutes = normalizeSnapshotInterval(res && res[STORAGE_INTERVAL_KEY])
    renderIntervalControl(currentSnapshotIntervalMinutes)
    renderClients(monitored)

    dashboardBtn.addEventListener('click', () => openUrl(dashboardUrl(base, '/dashboard')))
    alertsBtn.addEventListener('click', () => openUrl(dashboardUrl(base, '/alerts')))
  })

  updateLinkButtonForActiveTab(linkBtn)

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return
    if (changes[STORAGE_INTERVAL_KEY]) {
      renderIntervalControl(changes[STORAGE_INTERVAL_KEY].newValue)
    }
    if (changes[STORAGE_MONITORED_KEY]) {
      renderClients(changes[STORAGE_MONITORED_KEY].newValue || {})
    }
  })

  document.querySelectorAll('[data-interval]').forEach((button) => {
    button.addEventListener('click', () => setSnapshotInterval(button.getAttribute('data-interval'), button))
  })

  linkBtn.addEventListener('click', () => {
    if (linkBtn.disabled) return
    linkBtn.disabled = true
    linkBtn.textContent = 'Opening...'
    chrome.runtime.sendMessage({ type: 'OPEN_LINK_AND_ENABLE' }, (resp) => {
      const err = chrome.runtime.lastError
      if (err || !resp || !resp.ok) {
        linkBtn.disabled = false
        updateLinkButtonForActiveTab(linkBtn)
      }
    })
  })
}

document.addEventListener('DOMContentLoaded', init)
