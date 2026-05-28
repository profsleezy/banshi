(() => {
  // Read meta description if available
  function parseMetaDescription() {
    const meta = document.querySelector('meta[property="og:description"]') || document.querySelector('meta[name="description"]');
    return meta ? meta.content : null;
  }

  // Parse small snippets from meta description like "1.2K Followers"
  function parseCountsFromMeta(desc) {
    if (!desc) return {};
    const out = {};
    const followerMatch = desc.match(/([0-9,.KMkmbB]+)\s*Followers?/i);
    if (followerMatch) out.followers = followerMatch[1];
    const followingMatch = desc.match(/([0-9,.KMkmbB]+)\s*Following/i);
    if (followingMatch) out.following = followingMatch[1];
    const postsMatch = desc.match(/([0-9,.KMkmbB]+)\s*Posts?/i);
    if (postsMatch) out.posts = postsMatch[1];
    const handleMatch = desc.match(/\((@[^)]+)\)/);
    if (handleMatch) out.handle = handleMatch[1].replace(/^@/, '');
    return out;
  }

  // Convert abbreviated strings to integers: 1.2K -> 1200, 2.4M -> 2400000, "1,234" -> 1234
  function parseAbbreviatedNumber(str) {
    if (str == null) return null;
    try {
      let s = String(str).trim();
      if (!s) return null;
      s = s.replace(/[\s,]+/g, '');
      const m = s.match(/^([0-9]*\.?[0-9]+)\s*([KkMmBb])?$/);
      if (m) {
        let num = parseFloat(m[1]);
        const suf = m[2] ? m[2].toUpperCase() : null;
        if (suf === 'K') num *= 1e3;
        else if (suf === 'M') num *= 1e6;
        else if (suf === 'B') num *= 1e9;
        return Math.round(num);
      }
      const digits = s.match(/[0-9]+/g);
      if (digits) return parseInt(digits.join(''), 10);
    } catch (e) {
      // ignore
    }
    return null;
  }

  function trySelectors(selectors) {
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          const text = (el.innerText || el.textContent || '').trim();
          if (text) return { el, text };
        }
      } catch (e) {
        // invalid selector -> skip
      }
    }
    return null;
  }

  const PROFILE_PATH_BLACKLIST = ['p', 'explore', 'stories', 'direct', 'accounts', 'a', 'reel', 'reels', 'tag', 'tv', 'about', 'developer', 'graphql'];

  function getProfileHandleFromUrl() {
    try {
      const parts = location.pathname.split('/').filter(Boolean);
      if (!parts.length) return '';
      const first = parts[0].toLowerCase();
      if (PROFILE_PATH_BLACKLIST.includes(first)) return '';
      return first.replace(/^@/, '');
    } catch (e) {
      return '';
    }
  }

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

  function extractHandle(metaDesc) {
    const urlHandle = getProfileHandleFromUrl();
    if (urlHandle) return urlHandle;

    try {
      const og = document.querySelector('meta[property="og:title"]') || document.querySelector('meta[name="title"]');
      if (og && og.content) {
        const t = og.content;
        const m = t.match(/\((@[^)]+)\)/);
        if (m) return m[1].replace(/^@/, '');
        const first = t.split(/[\u2022\u00b7]/)[0].trim().split(' ')[0];
        if (first) return first.replace(/^@/, '');
      }
    } catch (e) {}

    try {
      if (metaDesc) {
        const pm = metaDesc.match(/\((@[^)]+)\)/);
        if (pm) return pm[1].replace(/^@/, '');
      }
    } catch (e) {}

    const nameSel = trySelectors(['header section h2', 'header section h1', 'header h1', 'header h2']);
    if (nameSel) {
      const parts = nameSel.text.split(/\s+/);
      for (const p of parts) if (p.startsWith('@')) return p.replace(/^@/, '');
      return parts[0].replace(/^@/, '');
    }

    try {
      const p = location.pathname.split('/').filter(Boolean)[0];
      if (p) return p.toLowerCase();
    } catch (e) {}

    return '';
  }

  function extractCounts(metaDesc) {
    const out = { followers: null, following: null, posts: null };
    try {
      const header = document.querySelector('header') || document.querySelector('main') || document;
      const headerText = header && (header.innerText || header.textContent || '') || '';

      // 1) try header text (covers most layouts where numbers are visible)
      try {
        const postsMatch = headerText.match(/([0-9,.KMkmbB]+)\s+posts?/i);
        if (postsMatch) out.posts = parseAbbreviatedNumber(postsMatch[1]);
        const followersMatch = headerText.match(/([0-9,.KMkmbB]+)\s+followers?/i);
        if (followersMatch) out.followers = parseAbbreviatedNumber(followersMatch[1]);
        const followingMatch = headerText.match(/([0-9,.KMkmbB]+)\s+following/i);
        if (followingMatch) out.following = parseAbbreviatedNumber(followingMatch[1]);
      } catch (e) {}

      // 2) primary: header ul/li style
      if (out.followers === null || out.following === null || out.posts === null) {
        try {
          const lis = Array.from(header.querySelectorAll('ul li, section ul li, header ul li'));
          for (const li of lis) {
            const text = (li.innerText || li.textContent || '').trim();
            if (!text) continue;
            const m = text.match(/([0-9,.KMkmbB]+)\s*(Posts?|Followers?|Following)/i);
            if (m) {
              const val = parseAbbreviatedNumber(m[1]);
              const label = (m[2] || '').toLowerCase();
              if (label.indexOf('post') !== -1 && out.posts === null) out.posts = val;
              else if (label.indexOf('follower') !== -1 && out.followers === null) out.followers = val;
              else if (label.indexOf('following') !== -1 && out.following === null) out.following = val;
              continue;
            }
            try {
              const span = li.querySelector('span');
              const s = span && (span.innerText || span.textContent || '').trim();
              const maybe = parseAbbreviatedNumber(s);
              if (maybe !== null) {
                const labelText = text.replace(s, '').trim();
                if (/post/i.test(labelText) && out.posts === null) out.posts = maybe;
                else if (/follower/i.test(labelText) && out.followers === null) out.followers = maybe;
                else if (/following/i.test(labelText) && out.following === null) out.following = maybe;
              }
            } catch (e) {}
          }
        } catch (e) {}
      }

      // 3) tertiary: anchors or small spans linking to followers/following
      if (out.followers === null || out.following === null) {
        try {
          const aFollowers = header.querySelector('a[href$="/followers/"]') || Array.from(document.querySelectorAll('a')).find(x => x.href && x.href.toLowerCase().includes('/followers'));
          if (aFollowers && out.followers === null) {
            const v = (aFollowers.querySelector('span') && (aFollowers.querySelector('span').innerText || aFollowers.querySelector('span').textContent)) || (aFollowers.innerText || aFollowers.textContent || '');
            const num = parseAbbreviatedNumber(v);
            if (num !== null) out.followers = num;
          }
          const aFollowing = header.querySelector('a[href$="/following/"]') || Array.from(document.querySelectorAll('a')).find(x => x.href && x.href.toLowerCase().includes('/following'));
          if (aFollowing && out.following === null) {
            const v = (aFollowing.querySelector('span') && (aFollowing.querySelector('span').innerText || aFollowing.querySelector('span').textContent)) || (aFollowing.innerText || aFollowing.textContent || '');
            const num = parseAbbreviatedNumber(v);
            if (num !== null) out.following = num;
          }
        } catch (e) {}
      }

      // 4) fallback: broader document scan
      if (out.followers === null || out.following === null || out.posts === null) {
        try {
          const bodyText = document.body && (document.body.innerText || document.body.textContent) || '';
          if (out.followers === null) {
            const m = bodyText.match(/([0-9,.KMkmbB]+)\s+Followers?/i);
            if (m) out.followers = parseAbbreviatedNumber(m[1]);
          }
          if (out.following === null) {
            const m2 = bodyText.match(/([0-9,.KMkmbB]+)\s+Following/i);
            if (m2) out.following = parseAbbreviatedNumber(m2[1]);
          }
          if (out.posts === null) {
            const m3 = bodyText.match(/([0-9,.KMkmbB]+)\s+Posts?/i);
            if (m3) out.posts = parseAbbreviatedNumber(m3[1]);
          }
        } catch (e) {}
      }
    } catch (e) {
      // ignore
    }
    return out;
  }

  function extractBioAndExtras() {
    const result = { bio: '', external_link_present: false, verified_badge: false, is_private: false, category_label: null };
    try {
      const header = document.querySelector('header') || document.querySelector('main') || document;
      // try primary selectors
      const bioSelectors = [
        'header section .-vDIg span',
        'header section div.-vDIg span',
        'header section div > span',
        'header section span',
        'article header div div span',
        'header p',
        'main header p',
        'header div span'
      ];
      let bioEl = null;
      for (const sel of bioSelectors) {
        try {
          const el = document.querySelector(sel);
          if (el && (el.innerText || el.textContent)) { bioEl = el; break; }
        } catch (e) {}
      }

      // heuristic: after stats list or before follow button
      if (!bioEl) {
        try {
          const stats = header.querySelector('ul');
          let cand = null;
          if (stats) {
            let node = stats.nextElementSibling;
            while (node) {
              const txt = (node.innerText || node.textContent || '').trim();
              if (txt && txt.length > 10 && !/followers|following|posts|follow|message/i.test(txt)) { cand = node; break; }
              node = node.nextElementSibling;
            }
          }
          if (!cand) {
            const followBtn = header.querySelector('button') || header.querySelector('[role="button"]');
            if (followBtn) {
              let node = followBtn.previousElementSibling;
              while (node) {
                const txt = (node.innerText || node.textContent || '').trim();
                if (txt && txt.length > 10 && !/followers|following|posts|follow|message/i.test(txt)) { cand = node; break; }
                node = node.previousElementSibling;
              }
            }
          }
          if (!cand) {
            const divs = header.querySelectorAll('div');
            for (const d of divs) {
              const txt = (d.innerText || d.textContent || '').trim();
              if (txt && txt.length > 10 && !/followers|following|posts|follow|message/i.test(txt)) { cand = d; break; }
            }
          }
          if (cand) bioEl = cand;
        } catch (e) {}
      }

      if (bioEl) {
        const txt = (bioEl.innerText || bioEl.textContent || '').replace(/\u00A0/g, ' ').trim();
        result.bio = txt;
        try { if (bioEl.querySelector && bioEl.querySelector('a')) result.external_link_present = true; } catch (e) {}
        if (!result.external_link_present) if (/https?:\/\//i.test(txt) || /www\./i.test(txt)) result.external_link_present = true;
      }

      // verified badge
      try {
        const v = header.querySelector('[aria-label*="Verified"], [title*="Verified"], svg[aria-label*="Verified"]');
        if (v) result.verified_badge = true;
        else {
          const txt = (header && (header.innerText || header.textContent)) || '';
          if (/verified/i.test(txt)) result.verified_badge = true;
        }
      } catch (e) {}

      // is_private
      try {
        const bodyTxt = (document.body && (document.body.innerText || document.body.textContent)) || '';
        if (/this account is private/i.test(bodyTxt)) result.is_private = true;
      } catch (e) {}

      // category label (legacy) - left for compatibility but will be replaced by `name` extraction
      try {
        const catCandidates = header.querySelectorAll('h2 + span, h1 + span, header ._bzw5 span, header div span');
        for (const el of catCandidates) {
          try {
            const t = (el.innerText || el.textContent || '').trim();
            if (t && t.length > 0 && t.length < 80 && t !== result.bio) { result.category_label = t; break; }
          } catch (e) {}
        }
      } catch (e) {}
    } catch (e) {
      // never crash
    }
    return result;
  }

  // Attempt to parse JSON data embedded in script tags (window._sharedData / graphql payload) to get recent posts and engagement
  function parseEmbeddedJson() {
    try {
      const scripts = Array.from(document.scripts || []);
      for (const s of scripts) {
        const t = s.textContent || '';
        if (!t || t.length < 50) continue;
        // common pattern: window._sharedData = { ... };
        const sharedMatch = t.match(/window\._sharedData\s*=\s*(\{.*\})\s*;/s);
        if (sharedMatch && sharedMatch[1]) {
          try { return JSON.parse(sharedMatch[1]); } catch (e) { /* ignore */ }
        }
        // fallback: look for graphql user payload marker
        if (t.indexOf('edge_owner_to_timeline_media') !== -1 || t.indexOf('edge_followed_by') !== -1) {
          // try to extract first json object in the script
          const firstBrace = t.indexOf('{');
          const lastBrace = t.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            const sub = t.slice(firstBrace, lastBrace + 1);
            try { return JSON.parse(sub); } catch (e) { /* ignore */ }
          }
        }
      }
    } catch (e) {}
    return null;
  }

  // Prefer parsing embedded JSON for engagement data; otherwise fallback to fetching individual posts (best-effort)
  async function collectRecentPostEngagements(maxPosts = 5, perPostTimeout = 2000) {
    try {
      // 1) try embedded JSON
      const shared = parseEmbeddedJson();
      if (shared) {
        try {
          // navigate possible locations
          const user = (shared.entry_data && shared.entry_data.ProfilePage && shared.entry_data.ProfilePage[0] && shared.entry_data.ProfilePage[0].graphql && shared.entry_data.ProfilePage[0].graphql.user) || (shared.graphql && shared.graphql.user) || null;
          if (user && user.edge_owner_to_timeline_media && Array.isArray(user.edge_owner_to_timeline_media.edges)) {
            const edges = user.edge_owner_to_timeline_media.edges.slice(0, maxPosts);
            const posts = edges.map(e => {
              const n = e.node || e;
              const likes = (n.edge_media_preview_like && typeof n.edge_media_preview_like.count === 'number') ? n.edge_media_preview_like.count : (n.edge_liked_by && typeof n.edge_liked_by.count === 'number' ? n.edge_liked_by.count : null);
              const comments = (n.edge_media_to_comment && typeof n.edge_media_to_comment.count === 'number') ? n.edge_media_to_comment.count : (n.edge_media_to_parent_comment && typeof n.edge_media_to_parent_comment.count === 'number' ? n.edge_media_to_parent_comment.count : null);
              const url = (n.shortcode) ? ('https://www.instagram.com/p/' + n.shortcode + '/') : (n.display_url || null);
              return { url, likes: (typeof likes === 'number') ? likes : null, comments: (typeof comments === 'number') ? comments : null };
            }).filter(p => p.url);
            if (posts.length > 0) {
              const sumLikes = posts.reduce((s, p) => s + (typeof p.likes === 'number' ? p.likes : 0), 0);
              const countLikes = posts.reduce((c, p) => c + (typeof p.likes === 'number' ? 1 : 0), 0);
              const avgLikes = countLikes > 0 ? Math.round(sumLikes / countLikes) : null;
              const sumComments = posts.reduce((s, p) => s + (typeof p.comments === 'number' ? p.comments : 0), 0);
              const countComments = posts.reduce((c, p) => c + (typeof p.comments === 'number' ? 1 : 0), 0);
              const avgComments = countComments > 0 ? Math.round(sumComments / countComments) : null;
              return { recent_posts: posts, avg_likes: avgLikes, avg_comments: avgComments };
            }
          }
        } catch (e) { /* ignore parsing errors */ }
      }

      // 2) fallback to fetch individual posts from thumbnails (best-effort)
      const anchors = Array.from(document.querySelectorAll('article a[href*="/p/"], a[href*="/p/"]'));
      const hrefs = [];
      for (const a of anchors) {
        const href = a.href || a.getAttribute('href');
        if (!href) continue;
        try {
          const u = new URL(href, location.href);
          if (u.pathname && u.pathname.startsWith('/p/')) {
            const full = u.origin + u.pathname;
            if (!hrefs.includes(full)) hrefs.push(full);
          }
        } catch (e) { continue; }
        if (hrefs.length >= maxPosts) break;
      }

      const posts = [];
      for (const url of hrefs.slice(0, maxPosts)) {
        try {
          const controller = new AbortController();
          const id = setTimeout(() => controller.abort(), perPostTimeout);
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(id);
          if (!res.ok) continue;
          const text = await res.text();
          let likes = null; let comments = null;
          const likeMatch = text.match(/"edge_media_preview_like":\s*\{\s*"count"\s*:\s*([0-9]+)/i);
          if (likeMatch) likes = Number(likeMatch[1]);
          const commentMatch = text.match(/"edge_media_to_parent_comment":\s*\{\s*"count"\s*:\s*([0-9]+)/i);
          if (commentMatch) comments = Number(commentMatch[1]);
          if ((likes === null || comments === null)) {
            try {
              const parser = new DOMParser();
              const doc = parser.parseFromString(text, 'text/html');
              const og = doc.querySelector('meta[property="og:description"]');
              if (og && og.content) {
                const mLikes = og.content.match(/([0-9,.KMkmbB]+)\s+Likes?/i);
                if (mLikes) likes = parseAbbreviatedNumber(mLikes[1]);
                const mComments = og.content.match(/([0-9,.KMkmbB]+)\s+Comments?/i);
                if (mComments) comments = parseAbbreviatedNumber(mComments[1]);
              }
            } catch (e) { /* ignore */ }
          }

          posts.push({ url, likes: (typeof likes === 'number') ? likes : null, comments: (typeof comments === 'number') ? comments : null });
        } catch (e) { continue; }
      }

      if (posts.length === 0) return null;
      const sumLikes = posts.reduce((s, p) => s + (typeof p.likes === 'number' ? p.likes : 0), 0);
      const countLikes = posts.reduce((c, p) => c + (typeof p.likes === 'number' ? 1 : 0), 0);
      const avgLikes = countLikes > 0 ? Math.round(sumLikes / countLikes) : null;
      const sumComments = posts.reduce((s, p) => s + (typeof p.comments === 'number' ? p.comments : 0), 0);
      const countComments = posts.reduce((c, p) => c + (typeof p.comments === 'number' ? 1 : 0), 0);
      const avgComments = countComments > 0 ? Math.round(sumComments / countComments) : null;

      return { recent_posts: posts, avg_likes: avgLikes, avg_comments: avgComments };
    } catch (e) { return null; }
  }

  // SPA navigation hooks
  (function () {
    try {
      const _push = history.pushState;
      history.pushState = function () { _push.apply(this, arguments); window.dispatchEvent(new Event('banshi_navigation')); };
      const _replace = history.replaceState;
      history.replaceState = function () { _replace.apply(this, arguments); window.dispatchEvent(new Event('banshi_navigation')); };
      window.addEventListener('popstate', () => window.dispatchEvent(new Event('banshi_navigation')));
    } catch (e) { /* ignore */ }
  })();

  function waitForProfileData(timeout = 5000, interval = 300) {
    return new Promise((resolve) => {
      let elapsed = 0;
      const check = () => {
        const d = collectProfile();
        if ((typeof d.followers === 'number' && d.followers > 0) || (typeof d.following === 'number' && d.following > 0) || (typeof d.posts === 'number' && d.posts > 0)) return resolve(d);
        elapsed += interval;
        if (elapsed >= timeout) return resolve(d);
        setTimeout(check, interval);
      };
      check();
    });
  }

  async function collectRecentPostEngagements(maxPosts = 5, perPostTimeout = 2000) {
    try {
      const anchors = Array.from(document.querySelectorAll('article a[href*="/p/"], a[href*="/p/"]'));
      const hrefs = [];
      for (const a of anchors) {
        const href = a.href || a.getAttribute('href');
        if (!href) continue;
        try {
          const u = new URL(href, location.href);
          if (u.pathname && u.pathname.startsWith('/p/')) {
            const full = u.origin + u.pathname;
            if (!hrefs.includes(full)) hrefs.push(full);
          }
        } catch (e) { continue; }
        if (hrefs.length >= maxPosts) break;
      }

      const posts = [];
      for (const url of hrefs.slice(0, maxPosts)) {
        try {
          const controller = new AbortController();
          const id = setTimeout(() => controller.abort(), perPostTimeout);
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(id);
          if (!res.ok) continue;
          const text = await res.text();
          let likes = null; let comments = null;
          const likeMatch = text.match(/"edge_media_preview_like":\s*\{\s*"count"\s*:\s*([0-9]+)/i);
          if (likeMatch) likes = Number(likeMatch[1]);
          const commentMatch = text.match(/"edge_media_to_parent_comment":\s*\{\s*"count"\s*:\s*([0-9]+)/i);
          if (commentMatch) comments = Number(commentMatch[1]);

          if ((likes === null || comments === null)) {
            try {
              const parser = new DOMParser();
              const doc = parser.parseFromString(text, 'text/html');
              const og = doc.querySelector('meta[property="og:description"]');
              if (og && og.content) {
                const mLikes = og.content.match(/([0-9,.KMkmbB]+)\s+Likes?/i);
                if (mLikes) likes = parseAbbreviatedNumber(mLikes[1]);
                const mComments = og.content.match(/([0-9,.KMkmbB]+)\s+Comments?/i);
                if (mComments) comments = parseAbbreviatedNumber(mComments[1]);
              }
            } catch (e) { /* ignore */ }
          }

          posts.push({ url, likes: (typeof likes === 'number') ? likes : null, comments: (typeof comments === 'number') ? comments : null });
        } catch (e) { continue; }
      }

      if (posts.length === 0) return null;
      const sumLikes = posts.reduce((s, p) => s + (typeof p.likes === 'number' ? p.likes : 0), 0);
      const countLikes = posts.reduce((c, p) => c + (typeof p.likes === 'number' ? 1 : 0), 0);
      const avgLikes = countLikes > 0 ? Math.round(sumLikes / countLikes) : null;
      const sumComments = posts.reduce((s, p) => s + (typeof p.comments === 'number' ? p.comments : 0), 0);
      const countComments = posts.reduce((c, p) => c + (typeof p.comments === 'number' ? 1 : 0), 0);
      const avgComments = countComments > 0 ? Math.round(sumComments / countComments) : null;

      return { recent_posts: posts, avg_likes: avgLikes, avg_comments: avgComments };
    } catch (e) { return null; }
  }

  function collectProfile() {
    try {
      const metaDesc = parseMetaDescription();
      const urlHandle = getProfileHandleFromUrl();
      const handle = normalizeHandle(extractHandle(metaDesc) || urlHandle);
      const counts = extractCounts(metaDesc);
      // extract display name and profile picture (try embedded JSON first)
      function extractNameAndPic() {
        try {
          // try embedded JSON
          const shared = parseEmbeddedJson();
          let user = null;
          if (shared) user = (shared.entry_data && shared.entry_data.ProfilePage && shared.entry_data.ProfilePage[0] && shared.entry_data.ProfilePage[0].graphql && shared.entry_data.ProfilePage[0].graphql.user) || (shared.graphql && shared.graphql.user) || null;
          const header = document.querySelector('header') || document.querySelector('main') || document;
          let name = null;
          let profile_picture_url = null;
          if (user && normalizeHandle(user.username || '') === handle) {
            if (user.full_name && user.full_name.trim()) name = cleanDisplayName(user.full_name, handle);
            profile_picture_url = user.profile_pic_url_hd || user.profile_pic_url || null;
          }
          if (!name) {
            // meta title: sometimes "Full Name (@handle) - Instagram"
            try {
              const og = document.querySelector('meta[property="og:title"]') || document.querySelector('meta[name="title"]');
              if (og && og.content) {
                const m = og.content.match(/(.+?)\s*\(@?([^\)]+)\)/);
                if (m && m[1]) {
                  const cand = m[1].trim();
                  if (normalizeHandle(m[2]) === handle) name = cleanDisplayName(cand, handle);
                } else {
                  const split = og.content.split(/[\u2022\u00b7]/)[0].trim();
                  if (split && split.toLowerCase().includes(handle)) name = cleanDisplayName(split, handle);
                }
              }
            } catch (e) {}
          }
          if (!name) {
            const nameSelectors = ['header section h1','header section h2','header h1','header h2','header h2 + h1','main header h1','main header h2'];
            for (const sel of nameSelectors) {
              try {
                const el = document.querySelector(sel);
                if (!el) continue;
                const t = (el.innerText || el.textContent || '').trim();
                const clean = cleanDisplayName(t, handle);
                if (clean) { name = clean; break; }
              } catch (e) {}
            }
          }
          if (!profile_picture_url) {
            try {
              const img = header.querySelector('img');
              if (img) profile_picture_url = img.src || img.getAttribute('src') || null;
            } catch (e) {}
          }
          return { name: name || null, profile_picture_url: profile_picture_url || null };
        } catch (e) { return { name: null, profile_picture_url: null }; }
      }

      const namePic = extractNameAndPic();
      const extras = extractBioAndExtras();
      const displayName = cleanDisplayName(namePic.name, handle) || cleanDisplayName(extras.category_label, handle);

      const followers = (counts.followers !== null) ? counts.followers : null;
      const following = (counts.following !== null) ? counts.following : null;
      const posts = (counts.posts !== null) ? counts.posts : null;

      // Avoid returning the handle as the bio; prefer an empty bio in that case
      let bioVal = (extras.bio || '');
      const bioKey = normalizeHandle(bioVal);
      const nameKey = normalizeHandle(namePic.name || '');
      if (bioVal && (bioKey === handle || bioKey === urlHandle || (nameKey && bioKey === nameKey))) bioVal = '';

      return {
        followers: (typeof followers === 'number') ? followers : null,
        following: (typeof following === 'number') ? following : null,
        posts: (typeof posts === 'number') ? posts : null,
        handle: handle || '',
        bio: bioVal,
        external_link_present: !!extras.external_link_present,
        verified_badge: !!extras.verified_badge,
        is_private: !!extras.is_private,
        name: displayName,
        profile_picture_url: namePic.profile_picture_url || null
      };
    } catch (e) {
      return { followers: null, following: null, posts: null, handle: '', bio: '', external_link_present: false, verified_badge: false, is_private: false, name: null, profile_picture_url: null };
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== 'COLLECT_PROFILE') return;
    (async () => {
      try {
        let base = collectProfile();
        if (base.followers === null && base.following === null && base.posts === null) {
          base = await waitForProfileData(5000, 300);
        }

        if (message && message.include_engagement) {
          try {
            const eng = await collectRecentPostEngagements(5, 2000);
            if (eng) base = Object.assign({}, base, eng);
          } catch (e) { /* ignore engagement failures */ }
        }

        const coreMissing = (base.followers === null && base.following === null && base.posts === null);
        if (coreMissing) return sendResponse(null);

        sendResponse(base);
      } catch (e) {
        sendResponse(null);
      }
    })();
    return true;
  });

})();
