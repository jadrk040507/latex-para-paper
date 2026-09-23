import { inspectEditor } from '../src/inspect-editor';
import type { startController } from '../src/controller';
type ProbeWindow = Window & {
  __paperLatexProbe?: ReturnType<typeof startController>;
  __paperLatexReady?: Promise<void>;
};
const status = document.querySelector<HTMLHeadingElement>('#status')!;
const detail = document.querySelector<HTMLParagraphElement>('#status-detail')!;
const card = document.querySelector<HTMLElement>('#state-card')!;
const result = document.querySelector<HTMLTextAreaElement>('#result')!;
const enabled = document.querySelector<HTMLInputElement>('#enabled')!;
const paperEnabled = document.querySelector<HTMLInputElement>('#paper-enabled')!;
const connect = document.querySelector<HTMLButtonElement>('#connect')!;
const permission = document.querySelector<HTMLButtonElement>('#permission')!;
const origin = { origins: ['https://www.dropbox.com/*'] };
let activeTabId: number | undefined;
let generation = 0;
document.querySelector('#version')!.textContent = browser.runtime.getManifest().version;
function state(kind: string, title: string, description: string) {
  card.dataset.state = kind;
  status.textContent = title;
  detail.textContent = description;
}
async function inspectConnection(tabId: number) {
  const check: () => void = () => {
    const scope = window as ProbeWindow;
    return Promise.resolve(scope.__paperLatexReady).then(() => scope.__paperLatexProbe?.status());
  };
  const reports = await browser.scripting.executeScript({ target: { tabId }, func: check });
  return reports[0]?.result?.enabled === true;
}
async function refresh() {
  const revision = ++generation;
  connect.hidden = true;
  permission.hidden = true;
  const [settings, tabs, hasAccess] = await Promise.all([
    browser.storage.local.get(['enabled', 'paperEnabled']),
    browser.tabs.query({ active: true, currentWindow: true }),
    browser.permissions.contains(origin),
  ]);
  if (revision !== generation) return;
  enabled.checked = settings.enabled !== false;
  paperEnabled.checked = settings.paperEnabled !== false;
  const tab = tabs[0];
  activeTabId = tab?.id;
  let supported = false;
  try { supported = new URL(tab?.url ?? '').origin === 'https://www.dropbox.com'; } catch { /* Browser page or missing URL. */ }
  if (!enabled.checked) state('off', 'Extensión desactivada', 'Actívala para volver a expandir atajos. Se conserva tu preferencia para Paper.');
  else if (!supported) state('unsupported', 'Sitio no compatible', 'Por ahora funciona en las ecuaciones de Dropbox Paper. Google Docs llegará después.');
  else if (!paperEnabled.checked) state('off', 'Desactivado en Paper', 'La extensión está encendida, pero los atajos están desactivados en este sitio.');
  else if (!hasAccess) {
    state('attention', 'Dropbox necesita permiso', 'Autoriza el acceso a Dropbox para activar los atajos en Paper.');
    permission.hidden = false;
  }
  else {
    let connected = false;
    if (activeTabId !== undefined) {
      try { connected = await inspectConnection(activeTabId); } catch { /* A stale or navigating tab needs reconnecting. */ }
    }
    if (revision !== generation) return;
    if (connected) state('on', 'Listo en Paper', 'Atajos automáticos dentro de tus ecuaciones.');
    else {
      state('attention', 'Esta pestaña necesita conectarse', 'Conéctala aquí o recarga Paper. Las próximas páginas se activarán automáticamente.');
      connect.hidden = false;
    }
  }
  enabled.disabled = false;
  paperEnabled.disabled = false;
}
async function save(key: 'enabled' | 'paperEnabled', value: boolean) {
  enabled.disabled = true;
  paperEnabled.disabled = true;
  try {
    await browser.storage.local.set({ [key]: value });
    await refresh();
  } catch {
    state('attention', 'No se pudo guardar', 'Vuelve a abrir el panel e inténtalo otra vez.');
    // Reload saved values rather than leave an unsaved switch presented as effective.
    try {
      const settings = await browser.storage.local.get(['enabled', 'paperEnabled']);
      enabled.checked = settings.enabled !== false;
      paperEnabled.checked = settings.paperEnabled !== false;
    } catch { /* Keep error visible. */ }
  } finally { enabled.disabled = false; paperEnabled.disabled = false; }
}
enabled.addEventListener('change', () => { void save('enabled', enabled.checked); });
paperEnabled.addEventListener('change', () => { void save('paperEnabled', paperEnabled.checked); });
permission.addEventListener('click', async () => {
  permission.disabled = true;
  try {
    // Invoke immediately from this click so Firefox can show its permission prompt.
    const granted = await browser.permissions.request(origin);
    if (!granted) { state('attention', 'Permiso no concedido', 'Puedes permitir el acceso a Dropbox desde aquí cuando quieras.'); return; }
    await refresh();
    if (activeTabId !== undefined) await browser.scripting.executeScript({ target: { tabId: activeTabId }, files: ['content.js'] });
    await refresh();
  } catch { state('attention', 'No se pudo dar acceso', 'Revisa los permisos de la extensión en Firefox e inténtalo otra vez.'); }
  finally { permission.disabled = false; }
});
connect.addEventListener('click', async () => {
  if (activeTabId === undefined) return;
  connect.disabled = true;
  try {
    await browser.scripting.executeScript({ target: { tabId: activeTabId }, files: ['content.js'] });
    await refresh();
  } catch { state('attention', 'No se pudo conectar', 'Recarga Paper y vuelve a abrir el panel.'); }
  finally { connect.disabled = false; }
});
document.querySelector('#select')!.addEventListener('click', () => { result.focus(); result.select(); });
document.querySelector('#inspect')!.addEventListener('click', async () => {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) return;
    const collect: () => void = inspectEditor;
    const reports = await browser.scripting.executeScript({ target: { tabId: tab.id }, func: collect });
    result.value = JSON.stringify({ version: browser.runtime.getManifest().version, report: reports[0]?.result }, null, 2);
  } catch { result.value = JSON.stringify({ status: 'inspection-unavailable' }); }
});
void refresh().catch(() => { state('attention', 'No se pudo comprobar el estado', 'Vuelve a abrir el panel para intentarlo de nuevo.'); });
