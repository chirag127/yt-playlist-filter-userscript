// ==UserScript==
// @name         YT Playlist Filter
// @namespace    https://github.com/chirag127
// @version      1.0.0
// @description  Live filter over a YouTube playlist or its sidebar panel. Hides rows that do not match, Esc clears. Read-only.
// @author       chirag127
// @license      MIT
// @match        https://www.youtube.com/*
// @icon         https://www.youtube.com/favicon.ico
// @homepageURL  https://github.com/chirag127/yt-playlist-filter-userscript
// @supportURL   https://github.com/chirag127/yt-playlist-filter-userscript/issues
// @downloadURL  https://github.com/chirag127/yt-playlist-filter-userscript/raw/main/yt-playlist-filter.user.js
// @updateURL    https://github.com/chirag127/yt-playlist-filter-userscript/raw/main/yt-playlist-filter.user.js
// @require      https://raw.githubusercontent.com/chirag127/yt-core-lib/main/yt-core-lib-1.2.0.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @noframes
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  if (typeof Ytk === 'undefined') { console.error('[playlist-filter] core did not load'); return; }
  if (!Ytk.featureOn('filter', true)) return;

  // Live shapes: lockups today, legacy renderers in older sessions, panel on watch pages.
  var ROW_SELECTORS = ['yt-lockup-view-model', 'ytd-playlist-video-renderer', 'ytd-playlist-panel-video-renderer'];

  function playlistId() {
    var q = new URLSearchParams(location.search).get('list');
    if (q) return q;
    var panel = document.querySelector('ytd-playlist-panel-renderer[playlist-id]');
    return panel ? panel.getAttribute('playlist-id') : null;
  }

  function rows() {
    for (var i = 0; i < ROW_SELECTORS.length; i++) {
      var found = Array.prototype.slice.call(document.querySelectorAll(ROW_SELECTORS[i]));
      if (found.length) return found;
    }
    return [];
  }

  function rowText(node) {
    var titleA = node.querySelector('yt-lockup-metadata-view-model h3 a, a#video-title');
    var title = titleA ? (titleA.getAttribute('title') || titleA.textContent || '') : '';
    var chan = node.querySelector('a[href^="/channel/"], a[href^="/@"]');
    var channel = chan ? chan.textContent || '' : '';
    return (title + ' ' + channel).toLowerCase();
  }

  var hidden = [];

  function apply(query) {
    var q = String(query || '').trim().toLowerCase();
    for (var i = 0; i < hidden.length; i++) {
      if (hidden[i].node.parentNode) hidden[i].node.style.display = hidden[i].before || '';
    }
    hidden = [];
    if (!q) return { shown: rows().length, total: rows().length };
    var all = rows();
    var shown = 0;
    for (var j = 0; j < all.length; j++) {
      var node = all[j];
      if (rowText(node).indexOf(q) !== -1) { shown += 1; continue; }
      hidden.push({ node: node, before: node.style.display });
      node.style.display = 'none';
    }
    return { shown: shown, total: all.length };
  }

  function openFilter() {
    var s = Ytk.settings();
    var input = Ytk.h('input', {
      type: 'text',
      placeholder: 'filter by title or channel…  (Esc clears)',
      style: 'width:100%;font:inherit;font-size:12.5px;padding:8px 11px;border-radius:10px;color:inherit;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);outline:none'
    });

    Ytk.panel('Playlist filter', function (body) {
      body.appendChild(input);
      var info = Ytk.h('div', { class: 'ytk2-dim', style: 'padding-top:8px;font-size:11.5px' });
      body.appendChild(info);

      var run = function () {
        var r = apply(input.value);
        info.textContent = input.value.trim()
          ? 'showing ' + r.shown + ' of ' + r.total
          : r.total + ' rows — type to filter';
      };

      input.addEventListener('input', run);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { input.value = ''; run(); input.blur(); }
        e.stopPropagation();
      });

      Ytk.note(body, 'Hidden rows come back when the filter is cleared or the page reloads. Nothing is changed on YouTube.');
      run();
      if (s.filterAutoOpen !== false) setTimeout(function () { input.focus(); }, 60);
    });
  }

  function settingsPopup() {
    if (typeof Ytk.openSettings !== 'function') {
      alert('The shared core is out of date (v' + Ytk.VERSION + '). Reinstall this script.');
      return;
    }
    Ytk.openSettings({
      title: 'YT Playlist Filter',
      subtitle: 'Hides rows that do not match what you type. Read-only — nothing is removed from the playlist.',
      sectionTitle: 'Filtering',
      fields: [
        { key: 'filterAutoOpen', label: 'Focus the filter box as soon as it opens', type: 'checkbox', def: true },
        { key: 'filterHold', label: 'Keep the current filter after switching videos in the playlist', type: 'checkbox', def: false },
        { key: 'filterMinLength', label: 'Minimum characters before filtering starts', type: 'number', def: 1, min: 1 }
      ],
      actions: [
        { label: 'Open the filter box', run: openFilter },
        { label: 'Clear the filter', run: function () { apply(''); Ytk.toast('Filter cleared'); } }
      ]
    });
  }

  if (!playlistId() && !rows().length) return;

  Ytk.mountToolbar([{ label: 'Filter', run: openFilter }]);
  if (typeof GM_registerMenuCommand === 'function') GM_registerMenuCommand('Settings…', settingsPopup);
})();
