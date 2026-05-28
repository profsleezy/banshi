const STORAGE_MONITORED_KEY = 'banshi_monitored_clients'
const STORAGE_API_KEY = 'banshi_api_base_url'
const DEFAULT_API_BASE = 'http://localhost:3000'

function renderClients(list) {
  const container = document.getElementById('clients')
  container.innerHTML = ''
  const keys = Object.keys(list || {})
  if (keys.length === 0) {
    container.innerHTML = '<div class="small">No monitored clients yet.</div>'
    return
  }

  keys.forEach(h => {
    const item = list[h]
    const el = document.createElement('div')
    el.className = 'client'
    el.innerHTML = `<div>
      <div style="font-weight:600">${item.name || h}</div>
      <div class="small">@${h}${item.last_synced ? ' - ' + new Date(item.last_synced).toLocaleString() : ''}</div>
    </div>
    <div>
      <button data-h="${h}" class="unmonitor">Unmonitor</button>
    </div>`
    container.appendChild(el)
  })

  Array.from(document.getElementsByClassName('unmonitor')).forEach(b => b.addEventListener('click', (e) => {
    e.currentTarget.disabled = true
    e.currentTarget.textContent = 'Unmonitoring...'
    const h = e.currentTarget.getAttribute('data-h')
    chrome.storage.local.get([STORAGE_MONITORED_KEY, STORAGE_API_KEY], (res) => {
      const m = (res && res[STORAGE_MONITORED_KEY]) ? res[STORAGE_MONITORED_KEY] : {}
      const item = m[h] || {}
      const base = (res && res[STORAGE_API_KEY]) ? res[STORAGE_API_KEY] : DEFAULT_API_BASE
      const params = new URLSearchParams()

      if (item.client_id) params.set('client_id', item.client_id)
      if (h) params.set('handle', h)
      if (item.name) params.set('name', item.name)

      try {
        chrome.tabs.create({ url: base.replace(/\/$/, '') + '/extension/unlinked?' + params.toString() })
      } catch (err) {
        console.warn('failed to open unlinked page', err)
      }

      delete m[h]
      chrome.storage.local.set({ [STORAGE_MONITORED_KEY]: m }, () => renderClients(m))
    })
  }))
}

function init() {
  const linkBtn = document.getElementById('link')

  chrome.storage.local.get([STORAGE_MONITORED_KEY], (res) => {
    const m = (res && res[STORAGE_MONITORED_KEY]) ? res[STORAGE_MONITORED_KEY] : {}
    renderClients(m)
  })

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[STORAGE_MONITORED_KEY]) return
    renderClients(changes[STORAGE_MONITORED_KEY].newValue || {})
  })

  linkBtn.addEventListener('click', () => {
    linkBtn.disabled = true
    linkBtn.textContent = 'Opening...'
    chrome.runtime.sendMessage({ type: 'OPEN_LINK_AND_ENABLE' }, () => {
      const err = chrome.runtime.lastError
      if (err) {
        linkBtn.disabled = false
        linkBtn.textContent = 'Link current profile'
      }
    })
  })
}

document.addEventListener('DOMContentLoaded', init)
