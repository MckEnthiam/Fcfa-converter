const DEFAULTS = { enabled: true, mode: 'replace', dollar: 'USD' };
const el = id => document.getElementById(id);

function showStatus(updated) {
  el('status').textContent = updated
    ? 'Taux du ' + new Date(updated).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
    : 'Taux non chargés. Vérifie ta connexion.';
}

async function load() {
  const { settings = {}, updated } = await browser.storage.local.get(['settings', 'updated']);
  const s = { ...DEFAULTS, ...settings };
  el('enabled').checked = s.enabled;
  el('mode').value = s.mode;
  el('dollar').value = s.dollar;
  showStatus(updated);
}

function save() {
  return browser.storage.local.set({
    settings: { enabled: el('enabled').checked, mode: el('mode').value, dollar: el('dollar').value }
  });
}

['enabled', 'mode', 'dollar'].forEach(id => el(id).addEventListener('change', save));
browser.storage.onChanged.addListener(ch => { if (ch.updated) showStatus(ch.updated.newValue); });
browser.runtime.sendMessage({ type: 'ensure' }).catch(() => {});
load();
