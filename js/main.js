/* MR5OBOT HQ — small, dependency-free interactions */
(function () {
  'use strict';

  var doc = document.documentElement;
  doc.classList.remove('no-js');

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  /* keep the mobile browser chrome in sync with the active mode */
  function syncThemeColor() {
    var meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', doc.dataset.mode === '0' ? '#0d0d10' : '#ffd23f');
  }
  syncThemeColor();

  /* ----- 1 / 0 theme switch ----- */
  function setMode(m) {
    doc.dataset.mode = m;
    syncThemeColor();
    try { localStorage.setItem('m', m); } catch (e) {}
    $$('.mode-switch').forEach(function (b) {
      b.setAttribute('aria-pressed', m === '0' ? 'true' : 'false');
    });
  }

  $$('.mode-switch').forEach(function (b) {
    b.setAttribute('aria-pressed', doc.dataset.mode === '0' ? 'true' : 'false');
    b.addEventListener('click', function () {
      setMode(doc.dataset.mode === '1' ? '0' : '1');
    });
  });

  /* ----- mobile menu ----- */
  var menuBtn = $('.menu-btn');
  var navLinks = $('#nav-links');
  if (menuBtn && navLinks) {
    menuBtn.addEventListener('click', function () {
      var open = navLinks.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* ----- toast ----- */
  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  /* ----- copy-to-clipboard buttons ----- */
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var text = b.getAttribute('data-copy');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          function () { toast('>> COPIED! <<'); },
          function () { toast('NO DICE. CTRL+C IT IS.'); }
        );
      } else {
        toast('NO DICE. CTRL+C IT IS.');
      }
    });
  });

  /* ----- konami code: ↑↑↓↓←→←→BA ----- */
  var seq = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  var ki = 0;
  window.addEventListener('keydown', function (e) {
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    ki = (k === seq[ki]) ? ki + 1 : (k === seq[0] ? 1 : 0);
    if (ki === seq.length) {
      ki = 0;
      setMode('0');
      toast('ACCESS GRANTED. HELLO, FRIEND.');
    }
  });

  /* ----- auto year ----- */
  $$('.year').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });
})();
