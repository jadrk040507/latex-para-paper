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
function state(title: string, description: string) {
  card.hidden = false;
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
  card.hidden = true;
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
  if (supported && enabled.checked && paperEnabled.checked) {
    if (!hasAccess) {
      state('Dropbox access required', 'Allow site access to use shortcuts here.');
      permission.hidden = false;
    } else {
      let connected = false;
      if (activeTabId !== undefined) {
        try { connected = await inspectConnection(activeTabId); } catch { /* A stale or navigating tab needs reconnecting. */ }
      }
      if (revision !== generation) return;
      if (!connected) {
        state('Reconnect this tab', 'Reload the page or reconnect to apply the extension.');
        connect.hidden = false;
      }
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
    state('Could not save settings', 'Reopen the menu and try again.');
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
    if (!granted) { state('Access not granted', 'Allow Dropbox access when you are ready.'); return; }
    if (activeTabId !== undefined) await browser.scripting.executeScript({ target: { tabId: activeTabId }, files: ['content.js'] });
    await refresh();
  } catch { state('Could not access Dropbox', 'Check the extension permissions in Firefox and try again.'); }
  finally { permission.disabled = false; }
});
connect.addEventListener('click', async () => {
  if (activeTabId === undefined) return;
  connect.disabled = true;
  try {
    await browser.scripting.executeScript({ target: { tabId: activeTabId }, files: ['content.js'] });
    await refresh();
  } catch { state('Could not reconnect', 'Reload the Dropbox tab and try again.'); }
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
void refresh().catch(() => { state('Could not load settings', 'Close and reopen the extension menu.'); });
