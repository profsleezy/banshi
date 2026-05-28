const STORAGE_CLIENT_KEY = 'banshi_client_id';
const STORAGE_API_KEY = 'banshi_api_base_url';
const STORAGE_ENABLED_KEY = 'banshi_enabled';
const STORAGE_SELECTED_CLIENT_KEY = 'banshi_selected_client_id';
const STORAGE_MONITORED_KEY = 'banshi_monitored_clients';
const DEFAULT_API_BASE = 'http://localhost:3000';
const IG_PROFILE_PATH_BLACKLIST = ['p', 'explore', 'stories', 'direct', 'accounts', 'a', 'reel', 'reels', 'tag', 'tv', 'about', 'developer', 'graphql'];

function normalizeHandle(value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase();
}

function cleanDisplayName(value, handle) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return null;

  const nameKey = normalizeHandle(text);
  const handleKey = normalizeHandle(handle);
  if (!nameKey || nameKey === handleKey) return null;

  const compactName = nameKey.replace(/[^a-z0-9]/g, '');
  const compactHandle = handleKey.replace(/[^a-z0-9]/g, '');
  const nameParts = nameKey.split(/[^a-z0-9]+/).filter((part) => part.length >= 3);
  const handleParts = handleKey.split(/[^a-z0-9]+/).filter((part) => part.length >= 3);
  const related =
    compactHandle.includes(compactName) ||
    compactName.includes(compactHandle) ||
    nameParts.some((part) => compactHandle.includes(part)) ||
    handleParts.some((part) => compactName.includes(part));

  return related ? text : null;
}

function getInstagramHandleFromUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    if (!parts.length) return '';
    const first = normalizeHandle(parts[0]);
    if (!first || IG_PROFILE_PATH_BLACKLIST.includes(first)) return '';
    return first;
  } catch (e) {
    return '';
  }
}

function setBadge(state) {
  // state: 'ON', 'ERR', ''
  try {
    chrome.action.setBadgeText({ text: state });
    if (state === 'ON') chrome.action.setBadgeBackgroundColor({ color: '#0aA' });
    else if (state === 'ERR') chrome.action.setBadgeBackgroundColor({ color: '#a00' });
    else chrome.action.setBadgeBackgroundColor({ color: '#888' });
  } catch (e) {
    // ignore
  }
}

function getStorageDefaults() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_CLIENT_KEY, STORAGE_API_KEY, STORAGE_SELECTED_CLIENT_KEY, STORAGE_MONITORED_KEY], (res) => {
      const out = {};
      if (res && res[STORAGE_CLIENT_KEY]) out.client_id = res[STORAGE_CLIENT_KEY];
      if (res && res[STORAGE_API_KEY]) out.api_base = res[STORAGE_API_KEY];
      if (res && res[STORAGE_SELECTED_CLIENT_KEY]) out.selected_client = res[STORAGE_SELECTED_CLIENT_KEY];
      if (res && res[STORAGE_MONITORED_KEY]) out.monitored = res[STORAGE_MONITORED_KEY];
      resolve(out);
    });
  });
}

function ensureDefaults() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_CLIENT_KEY, STORAGE_API_KEY, STORAGE_MONITORED_KEY], (res) => {
      const toSet = {};
      if (!res || !res[STORAGE_CLIENT_KEY]) {
        const id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : ('c_' + Math.random().toString(36).slice(2, 10));
        toSet[STORAGE_CLIENT_KEY] = id;
      }
      if (!res || !res[STORAGE_API_KEY]) {
        toSet[STORAGE_API_KEY] = DEFAULT_API_BASE;
      }
      if (!res || typeof res[STORAGE_ENABLED_KEY] === 'undefined') {
        // Harvesting is always enabled by default
        toSet[STORAGE_ENABLED_KEY] = true;
      }
      if (!res || !res[STORAGE_MONITORED_KEY]) {
        toSet[STORAGE_MONITORED_KEY] = {};
      }
      if (Object.keys(toSet).length === 0) return resolve();
      chrome.storage.local.set(toSet, () => resolve());
    });
  });
}

function getStoredValues() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_CLIENT_KEY, STORAGE_API_KEY, STORAGE_SELECTED_CLIENT_KEY, STORAGE_MONITORED_KEY], (res) => {
      resolve({
        client_id: res && res[STORAGE_CLIENT_KEY] ? res[STORAGE_CLIENT_KEY] : null,
        api_base: res && res[STORAGE_API_KEY] ? res[STORAGE_API_KEY] : DEFAULT_API_BASE,
        selected_client: res && res[STORAGE_SELECTED_CLIENT_KEY] ? res[STORAGE_SELECTED_CLIENT_KEY] : null,
        monitored: res && res[STORAGE_MONITORED_KEY] ? res[STORAGE_MONITORED_KEY] : {}
      });
    });
  });
}

function removeMonitoredHandle(handle, reason) {
  if (!handle) return;
  chrome.storage.local.get([STORAGE_MONITORED_KEY], (r) => {
    const m = r && r[STORAGE_MONITORED_KEY] ? r[STORAGE_MONITORED_KEY] : {};
    if (!m[handle]) return;
    delete m[handle];
    chrome.storage.local.set({ [STORAGE_MONITORED_KEY]: m }, () => {
      console.log('Removed monitored client', handle, reason || '');
      if (Object.keys(m).length === 0) setBadge('');
    });
  });
}

function sendMessageToTab(tabId, message, timeout = 10000) {
  return new Promise((resolve, reject) => {
    let handled = false;
    chrome.tabs.sendMessage(tabId, message, (resp) => {
      handled = true;
      const err = chrome.runtime.lastError;
      if (err) {
        // more descriptive error
        console.warn('sendMessageToTab lastError', err.message || err);
        // Try to inject the content script (may not be loaded due to SPA nav). Then retry once.
        try {
          chrome.scripting.executeScript({
            target: { tabId },
            files: ['content_scripts/profile_collector.js']
          }, () => {
            // after injection, try sending again
            chrome.tabs.sendMessage(tabId, message, (resp2) => {
              const err2 = chrome.runtime.lastError;
              if (err2) return reject(err2.message || err2);
              resolve(resp2);
            });
          });
        } catch (e) {
          return reject(err.message || err);
        }
        return;
      }
      resolve(resp);
    });
    setTimeout(() => {
      if (!handled) reject('timeout');
    }, timeout);
  });
}

// Safe wrapper: never throws, always resolves to response or null
async function safeSendMessageToTab(tabId, message, timeout = 10000) {
  try {
    return await sendMessageToTab(tabId, message, timeout);
  } catch (e) {
    console.warn('safeSendMessageToTab: message failed', e);
    return null;
  }
}

async function performSnapshots() {
  const { api_base, monitored } = await getStoredValues();

  if (!monitored || Object.keys(monitored).length === 0) {
    console.log('performSnapshots: no monitored clients configured');
    // nothing monitored -> clear badge and no-op
    setBadge('');
    return;
  }

  // find instagram tabs
  chrome.tabs.query({ url: '*://*.instagram.com/*' }, async (tabs) => {
    console.log('performSnapshots: found tabs', tabs && tabs.length);
    if (!tabs || tabs.length === 0) {
      console.log('performSnapshots: no instagram tabs found');
      return;
    }
    let anySuccess = false;
    let foundMonitoredOpen = false;
    let postAttempts = 0;
    let disabledSkips = 0;
    let hadActionableFailure = false;
    for (const tab of tabs) {
      try {
        // determine handle from URL path if possible
        let handle = getInstagramHandleFromUrl(tab.url);
        let profileData = null;

        // If we have a handle from the URL and it's not monitored, skip messaging this tab.
        if (handle) {
          const monitoredEntryCheck = monitored[handle];
          if (!monitoredEntryCheck) {
            // skip unmonitored profile pages (avoid unnecessary messaging/injection)
            continue;
          }
          // mark we have a monitored tab open
          foundMonitoredOpen = true;
          // attempt to collect profile data, but tolerate failures and still send a partial snapshot
          profileData = await safeSendMessageToTab(tab.id, { type: 'COLLECT_PROFILE', include_engagement: true });
        } else {
          // No handle in URL: ask content script for handle and counts
          profileData = await safeSendMessageToTab(tab.id, { type: 'COLLECT_PROFILE', include_engagement: true });
          if (!profileData || !profileData.handle) {
            // couldn't determine handle from page -> skip
            continue;
          }
          handle = (profileData.handle || '').toLowerCase();
          if (!monitored[handle]) {
            // discovered handle is not in monitored set -> skip
            continue;
          }
          foundMonitoredOpen = true;
        }

        const monitoredEntry = monitored[handle];
        if (!monitoredEntry) continue; // double-check safety

        const payload = {
          client_id: monitoredEntry.client_id,
          type: 'PROFILE_SNAPSHOT',
          metadata: {
            followers: (profileData && typeof profileData.followers === 'number') ? profileData.followers : null,
            following: (profileData && typeof profileData.following === 'number') ? profileData.following : null,
            posts: (profileData && typeof profileData.posts === 'number') ? profileData.posts : null,
            bio: (profileData && typeof profileData.bio === 'string') ? profileData.bio : '',
            handle: handle,
            name: cleanDisplayName(profileData && profileData.name, handle) || cleanDisplayName(monitoredEntry && monitoredEntry.name, handle),
            profile_picture_url: (profileData && profileData.profile_picture_url) ? profileData.profile_picture_url : null,
            // extras collected by the content script (best-effort)
            external_link_present: !!(profileData && profileData.external_link_present),
            verified_badge: !!(profileData && profileData.verified_badge),
            is_private: !!(profileData && profileData.is_private)
          },
          timestamp: Date.now()
        };

        // send to backend (partial payload allowed)
        try {
          console.log('performSnapshots: POST to', (api_base || DEFAULT_API_BASE) + '/api/events', 'payload', payload);
          postAttempts += 1;
          const res = await fetch((api_base || DEFAULT_API_BASE) + '/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          let body = null
          try { body = await res.json() } catch (e) { /* ignore */ }
          console.log('performSnapshots: response', res && res.status, body);
          if (res && res.ok && body && body.success && body.skipped && body.reason === 'monitoring_disabled') {
            disabledSkips += 1;
            removeMonitoredHandle(handle, 'after server disabled skip');
            continue;
          }
          if (res && body && body.error === 'Client not found') {
            disabledSkips += 1;
            removeMonitoredHandle(handle, 'after missing client response');
            continue;
          }
          if (res && res.ok && body && body.success) {
            anySuccess = true;
            // update monitored last_synced
            try {
              chrome.storage.local.get([STORAGE_MONITORED_KEY], (r) => {
                const m = r && r[STORAGE_MONITORED_KEY] ? r[STORAGE_MONITORED_KEY] : {};
                if (m[handle]) {
                  m[handle].last_synced = new Date().toISOString();
                  chrome.storage.local.set({ [STORAGE_MONITORED_KEY]: m });
                }
              });
            } catch (e) {
              // ignore
            }
          } else {
            hadActionableFailure = true;
            console.warn('performSnapshots: backend returned error', res && res.status, body)
          }
        } catch (e) {
          hadActionableFailure = true;
          console.error('performSnapshots: fetch exception', e);
        }
      } catch (e) {
        hadActionableFailure = true;
        console.warn('performSnapshots: tab processing failed', e);
        continue;
      }
    }
    if (anySuccess) setBadge('ON');
    else if (hadActionableFailure || (foundMonitoredOpen && postAttempts === 0 && disabledSkips === 0)) setBadge('ERR');
    else setBadge('');
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  await ensureDefaults();
  // ensure alarm exists and run an initial snapshot
  try { chrome.alarms.create('banshi_snapshot', { periodInMinutes: 1 }); } catch (e) {}
  performSnapshots();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureDefaults();
  // ensure alarm exists and resume snapshotting
  try { chrome.alarms.create('banshi_snapshot', { periodInMinutes: 1 }); } catch (e) {}
  performSnapshots();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm || alarm.name !== 'banshi_snapshot') return;
  // Always run snapshots on alarm; performSnapshots will no-op if nothing is monitored
  await performSnapshots();
});

// Toggle enable/disable when user clicks the extension action
chrome.action.onClicked.addListener(async (tab) => {
  // When the user clicks the extension icon:
  // 1) collect profile info from the active tab (if Instagram)
  // 2) open the site's extension link page with profile params
  // 3) enable periodic harvesting (crawler)
  try {
    if (!tab || !tab.id || !tab.url) return
    const isIg = /https?:\/\/(www\.)?instagram\.com\//i.test(tab.url)
    let profileData = null
    if (isIg) {
      try {
        profileData = await safeSendMessageToTab(tab.id, { type: 'COLLECT_PROFILE', include_engagement: true })
      } catch (e) {
        console.warn('action.onClicked: collect failed', e)
      }
    }

    const vals = await getStoredValues()
    const base = vals.api_base || DEFAULT_API_BASE
    const urlHandle = getInstagramHandleFromUrl(tab.url)
    const linkHandle = urlHandle || normalizeHandle(profileData && profileData.handle)
    const bio = profileData && typeof profileData.bio === 'string' ? profileData.bio.trim() : ''
    const params = new URLSearchParams()
    if (linkHandle) params.set('handle', linkHandle)
    if (profileData && typeof profileData.followers === 'number') params.set('followers', String(profileData.followers))
    if (bio && normalizeHandle(bio) !== linkHandle) params.set('bio', bio)

    const url = base.replace(/\/$/, '') + '/extension/link' + (params.toString() ? ('?' + params.toString()) : '')
    try { chrome.tabs.create({ url }) } catch (e) { console.warn('open link page failed', e) }

    // enable harvesting
    chrome.storage.local.set({ [STORAGE_ENABLED_KEY]: true }, () => {
      try { chrome.alarms.create('banshi_snapshot', { periodInMinutes: 1 }); } catch (e) {}
      performSnapshots();
    })
  } catch (e) {
    console.error('action.onClicked error', e)
  }
})

// Listen for tab updates to detect when the site redirects to /extension/linked?client_id=...
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo || !changeInfo.url) return
  try {
    const u = new URL(changeInfo.url)
    if (u.pathname === '/extension/linked') {
      const cid = u.searchParams.get('client_id')
      const handle = u.searchParams.get('handle')
      const name = u.searchParams.get('name')
      if (cid) {
        chrome.storage.local.set({ [STORAGE_SELECTED_CLIENT_KEY]: cid }, () => {
          console.log('Stored selected client id from linked page', cid)
        })
        if (handle) {
          // add to monitored mapping
          chrome.storage.local.get([STORAGE_MONITORED_KEY], (res) => {
            const m = (res && res[STORAGE_MONITORED_KEY]) ? res[STORAGE_MONITORED_KEY] : {};
            m[handle.toLowerCase()] = { client_id: cid, name: name || null };
            chrome.storage.local.set({ [STORAGE_MONITORED_KEY]: m }, () => {
              console.log('Added monitored client', handle, cid)
            })
          })
        }
      }
    } else if (u.pathname === '/extension/unlinked') {
      const cid = u.searchParams.get('client_id')
      const handle = u.searchParams.get('handle')
      if (cid || handle) {
        chrome.storage.local.get([STORAGE_SELECTED_CLIENT_KEY, STORAGE_MONITORED_KEY], (res) => {
          const m = (res && res[STORAGE_MONITORED_KEY]) ? res[STORAGE_MONITORED_KEY] : {};
          const next = {};
          const targetHandle = handle ? handle.toLowerCase() : null;

          Object.keys(m).forEach((key) => {
            const entry = m[key] || {};
            const keyMatches = targetHandle && key.toLowerCase() === targetHandle;
            const idMatches = cid && entry.client_id === cid;
            if (!keyMatches && !idMatches) next[key] = entry;
          });

          const updates = { [STORAGE_MONITORED_KEY]: next };
          if (cid && res && res[STORAGE_SELECTED_CLIENT_KEY] === cid) {
            updates[STORAGE_SELECTED_CLIENT_KEY] = null;
          }

          chrome.storage.local.set(updates, () => {
            console.log('Removed monitored client', handle, cid);
            if (Object.keys(next).length === 0) setBadge('');
          });
        });
      }
    }
  } catch (e) {
    // ignore
  }
})

// allow manual trigger via runtime message
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;
  if (message.type === 'TRIGGER_SNAPSHOT') {
    performSnapshots().then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true; // will respond asynchronously
  }
  if (message.type === 'OPEN_LINK_AND_ENABLE') {
    // Open site link page for current active tab and enable harvesting
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs && tabs[0]
      if (!tab || !tab.id || !tab.url) return sendResponse({ ok: false })
      const isIg = /https?:\/\/(www\.)?instagram\.com\//i.test(tab.url)
      let profileData = null
      if (isIg) {
        try { profileData = await safeSendMessageToTab(tab.id, { type: 'COLLECT_PROFILE', include_engagement: true }) } catch (e) { console.warn('OPEN_LINK: collect failed', e) }
      }
      const vals = await getStoredValues()
      const base = vals.api_base || DEFAULT_API_BASE
      const urlHandle = getInstagramHandleFromUrl(tab.url)
      const linkHandle = urlHandle || normalizeHandle(profileData && profileData.handle)
      const bio = profileData && typeof profileData.bio === 'string' ? profileData.bio.trim() : ''
      const params = new URLSearchParams()
      if (linkHandle) params.set('handle', linkHandle)
      if (profileData && typeof profileData.followers === 'number') params.set('followers', String(profileData.followers))
      if (bio && normalizeHandle(bio) !== linkHandle) params.set('bio', bio)

      const url = base.replace(/\/$/, '') + '/extension/link' + (params.toString() ? ('?' + params.toString()) : '')
      try { chrome.tabs.create({ url }) } catch (e) { console.warn('open link page failed', e) }

      // enable harvesting
      chrome.storage.local.set({ [STORAGE_ENABLED_KEY]: true }, () => {
        try { chrome.alarms.create('banshi_snapshot', { periodInMinutes: 1 }); } catch (e) {}
        performSnapshots();
      })
      sendResponse({ ok: true })
    })
    return true
  }
  if (message.type === 'SET_API_BASE') {
    const url = message.api_base;
    chrome.storage.local.set({ [STORAGE_API_KEY]: url }, () => sendResponse({ ok: true }));
    return true;
  }
});

