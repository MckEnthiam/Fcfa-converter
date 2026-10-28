// Parcourt la page, convertit les montants dans les nœuds texte, et surveille les changements.
// On modifie nodeValue sur place (pas de nouveaux éléments) pour ne pas casser React/Vue & co.
(() => {
  "use strict";

  const DEFAULTS = { enabled: true, mode: "replace", dollar: "USD" };
  const SKIP = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "TEXTAREA",
    "CODE",
    "PRE",
  ]);

  let settings = { ...DEFAULTS };
  const touched = new Map(); // nœud -> { orig, out }
  const pending = new Set();
  let timer = null;

  function processText(node) {
    const p = node.parentElement;
    if (!p || SKIP.has(p.tagName) || p.isContentEditable) return;
    const v = node.nodeValue;
    const t = touched.get(node);
    if (t && t.out === v) return; // c'est notre propre écriture
    if (!/\d/.test(v)) {
      if (t) touched.delete(node);
      return;
    }
    const out = FCFA.convert(v);
    if (out !== v) {
      touched.set(node, { orig: v, out });
      node.nodeValue = out;
    } else if (t) {
      touched.delete(node);
    }
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) return processText(root);
    if (
      root.nodeType !== Node.ELEMENT_NODE &&
      root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE
    )
      return;
    if (root.nodeType === Node.ELEMENT_NODE && SKIP.has(root.tagName)) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) processText(n);
  }

  function restoreAll() {
    for (const [node, t] of touched) {
      if (node.nodeValue === t.out) node.nodeValue = t.orig;
    }
    touched.clear();
  }

  function prune() {
    if (touched.size < 3000) return;
    for (const node of touched.keys())
      if (!node.isConnected) touched.delete(node);
  }

  function flush() {
    timer = null;
    const items = [...pending];
    pending.clear();
    for (const n of items) if (n.isConnected) walk(n);
    prune();
  }

  const observer = new MutationObserver((mutations) => {
    if (!settings.enabled) return;
    for (const m of mutations) {
      if (m.type === "characterData") pending.add(m.target);
      else m.addedNodes.forEach((n) => pending.add(n));
    }
    if (!timer) timer = setTimeout(flush, 100);
  });

  let rates = null;
  function apply() {
    restoreAll();
    FCFA.configure({ rates, dollar: settings.dollar, mode: settings.mode });
    if (settings.enabled && document.body) walk(document.body);
  }

  async function init() {
    const s = await browser.storage.local.get(["settings", "rates"]);
    settings = { ...DEFAULTS, ...(s.settings || {}) };
    rates = s.rates || null;
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    apply();
  }

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    let dirty = false;
    if (changes.settings) {
      settings = { ...DEFAULTS, ...(changes.settings.newValue || {}) };
      dirty = true;
    }
    if (changes.rates) {
      rates = changes.rates.newValue || null;
      dirty = true;
    }
    if (dirty) apply();
  });

  init();
})();
