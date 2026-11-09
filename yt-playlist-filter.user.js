// ==UserScript==
// @name         YT Playlist Filter
// @namespace    https://github.com/chirag127
// @version      1.0.0
// @description  Live filter over playlist rows on /playlist and in the watch-page playlist panel. Escape clears.
// @author       chirag127
// @license      MIT
// @match        https://www.youtube.com/*
// @require      https://raw.githubusercontent.com/chirag127/yt-core-lib/main/yt-core-lib-1.3.0.js
// @downloadURL  https://raw.githubusercontent.com/chirag127/yt-playlist-filter-userscript/main/yt-playlist-filter.user.js
// @updateURL    https://raw.githubusercontent.com/chirag127/yt-playlist-filter-userscript/main/yt-playlist-filter.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @noframes
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  if (typeof Ytk === 'undefined') { console.error('[yt-playlist-filter] core did not load'); return; }
  if (!Ytk.featureOn('filter', true)) return;

  const HIDDEN = 'data-ytpf-hidden';
  const ROW_SEL = 'yt-lockup-view-model, ytd-playlist-video-renderer, ytd-playlist-panel-video-renderer';
  const DURATION_RE = /^\d{1,2}:\d{2}(?::\d{2})?$/;

  let query = '';
  let cssDone = false;
  let observer = null;
  let view = null;        // { input, count } of the open panel
  let applyTimer = null;

  function onPlaylistSurface() {
    return location.pathname === '/playlist' || !!document.querySelector('ytd-playlist-panel-renderer');
  }

  function raw() { return Ytk.storeGet('settings', {}) || {}; }

  function rowRoot() {
    const root = location.pathname === '/playlist'
      ? document.querySelector('ytd-playlist-video-list-renderer') || document.querySelector('ytd-browse[page-subtype="playlist"]')
      : document.querySelector('ytd-playlist-panel-renderer');
    return root || null;
  }

  function readRows() {
    const root = rowRoot();
    return root ? Array.from(root.querySelectorAll(ROW_SEL)) : [];
  }

  // One rule for every row shape: rows carry the attribute, the rule hides them.
  function ensureCss() {
    if (cssDone) return;
    cssDone = true;
    const style = document.createElement('style');
    style.textContent = '[' + HIDDEN + '="1"]{display:none!important}';
    (document.head || document.documentElement).appendChild(style);
  }

  /** Title, channel and duration for both DOM generations (lockup view-model or legacy row). */
  function rowInfo(node) {
    const vm = node.data && node.data.lockupViewModel ? Ytk.lockupToItem(node.data.lockupViewModel) : null;
    const titleEl = node.querySelector('yt-lockup-metadata-view-model h3 a, a#video-title, #video-title');
    const chanEl = node.querySelector('ytd-channel-name a, #channel-name a, a[href^="/@"], a[href^="/channel/"]');
    const durEl = node.querySelector('#time-status #text, ytd-thumbnail-overlay-time-status-renderer #text');
    let duration = (vm && vm.duration) || (durEl && durEl.textContent) || '';
    if (!duration) {
      // Lockup rows render the length in a bare badge anchor.
      const anchors = node.querySelectorAll('a');
      for (let i = 0; i < anchors.length; i++) {
        const text = (anchors[i].textContent || '').trim();
        if (DURATION_RE.test(text)) { duration = text; break; }
      }
    }
    return {
      title: String((vm && vm.title) || (titleEl && (titleEl.getAttribute('title') || titleEl.textContent)) || '').trim(),
      channel: String((vm && vm.channel) || (chanEl && chanEl.textContent) || '').trim(),
      duration: String(duration).trim()
    };
  }

  function matcher() {
    if (!query) return null;
    if (raw().filterUseRegex) {
      try {
        const re = new RegExp(query, 'i');
        return function (hay) { return re.test(hay); };
      } catch (e) {
        Ytk.toast('Invalid regex — using plain text');
      }
    }
    const needle = query.toLowerCase();
    return function (hay) { return hay.toLowerCase().indexOf(needle) !== -1; };
  }

  function apply() {
    ensureCss();
    const scope = raw().filterScope || 'both';
    const test = matcher();
    const rows = readRows();
    let shown = 0;
    rows.forEach(function (node) {
      const info = rowInfo(node);
      const hay = scope === 'title' ? info.title : scope === 'channel' ? info.channel : info.title + ' ' + info.channel;
      if (test && !test(hay)) node.setAttribute(HIDDEN, '1');
      else { node.removeAttribute(HIDDEN); shown++; }
    });
    return { shown: shown, total: rows.length };
  }

  function paint() {
    if (!view) return;
    const result = apply();
    view.count.textContent = query ? result.shown + ' / ' + result.total + ' rows shown' : 'Filtering is off';
  }

  function applySoon() {
    clearTimeout(applyTimer);
    applyTimer = setTimeout(paint, 120);
  }

  /** Rows re-render as the playlist pages in, so re-apply to the fresh nodes. */
  function watch() {
    if (observer || !raw().filterReapply) return;
    const root = rowRoot();
    if (!root || typeof MutationObserver === 'undefined') return;
    observer = new MutationObserver(function () {
      if (!view || !document.body.contains(view.input)) { drop(); return; }
      if (query) applySoon();
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  function unhideAll() {
    document.querySelectorAll('[' + HIDDEN + ']').forEach(function (node) { node.removeAttribute(HIDDEN); });
  }

  function drop() {
    if (observer) { observer.disconnect(); observer = null; }
    view = null;
    clearTimeout(applyTimer);
  }

  function clearAll() {
    query = '';
    if (view) { view.input.value = ''; paint(); }
    else unhideAll();
    Ytk.toast('Filter cleared');
  }

  function openFilter() {
    if (view && document.body.contains(view.input)) { view.input.focus(); return; }
    ensureCss();
    query = '';
    Ytk.panel('Playlist filter', function (body) {
      const input = Ytk.h('input', {
        type: 'search',
        placeholder: 'Filter by title or channel…',
        style: 'width:100%;box-sizing:border-box;font:inherit;font-size:13px;padding:9px 12px;border-radius:10px;'
          + 'border:1px solid #3a3a3a;background:#262626;color:#fff;outline:none'
      });
      const count = Ytk.h('div', { class: 'ytk2-dim', style: 'padding:8px 0 2px;font-size:11.5px' });
      body.append(input, count);
      Ytk.note(body, 'Escape clears the filter. Rows are only hidden — nothing on YouTube changes.');

      input.addEventListener('input', function () {
        query = input.value.trim();
        applySoon();
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); clearAll(); return; }
        e.stopPropagation(); // typing must never reach YouTube's shortcuts
      });

      const clearBtn = Ytk.h('button', {
        text: 'Clear filter',
        style: 'font:inherit;font-size:12px;padding:6px 11px;border-radius:8px;cursor:pointer;'
          + 'border:1px solid #3a3a3a;background:#262626;color:#eaeaea',
        onclick: clearAll
      });
      body.appendChild(Ytk.h('div', { style: 'padding-top:10px' }, clearBtn));

      view = { input: input, count: count };
      input.focus();
      apply();
      count.textContent = 'Filtering is off';
      watch();
    });
    // The panel's own ✕ must not leave rows hidden behind a query nobody can see.
    const closeBtn = document.querySelector('.ytk2-panel header .x');
    if (closeBtn) closeBtn.addEventListener('click', clearAll);
  }

  const fields = [
    {
      key: 'filterScope', label: 'Match against', type: 'select',
      options: ['both', 'title', 'channel'], def: raw().filterScope || 'both',
      hint: 'both = title + channel, title = title only, channel = channel only.'
    },
    { key: 'filterUseRegex', label: 'Treat the query as a regular expression', type: 'checkbox', def: !!raw().filterUseRegex },
    { key: 'filterReapply', label: 'Re-apply as more rows load', type: 'checkbox', def: raw().filterReapply === undefined ? true : !!raw().filterReapply, hint: 'Off stops the filter from following newly rendered rows.' }
  ];

  GM_registerMenuCommand('Settings…', function () {
    const before = raw();
    Ytk.openSettings({
      title: 'YT Playlist Filter',
      subtitle: 'Live filter over the playlist page and the watch-page playlist panel.',
      sectionTitle: 'Matching',
      fields: fields,
      // Core 1.2.0 keeps only its own settings keys on save; re-merge this script's keys.
      onSave: function (next) { Ytk.storeSet('settings', Object.assign({}, before, next)); }
    });
  });

  let mounted = false;
  function mount() {
    if (mounted || !onPlaylistSurface()) return;
    mounted = true;
    Ytk.mountToolbar([{ label: 'Filter', run: openFilter }]);
  }
  mount();
  if (!mounted) document.addEventListener('yt-navigate-finish', mount);
  document.addEventListener('yt-navigate-finish', function () { drop(); unhideAll(); query = ''; });
})();
