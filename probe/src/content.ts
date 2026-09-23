import { createPaperPort } from './paper-port';
import { startController } from './controller';
import { startMathEntry } from './math-entry';

const scope = window as typeof window & {
  __paperLatexProbe?: ReturnType<typeof startController>;
  __paperLatexCleanup?: () => void;
  __paperLatexReady?: Promise<void>;
  __paperMathEntry?: ReturnType<typeof startMathEntry>;
};
if (location.origin === 'https://www.dropbox.com') {
  scope.__paperLatexCleanup?.();
  scope.__paperLatexProbe?.dispose();
  scope.__paperMathEntry?.dispose();
  let disposed = false;
  let ready = false;
  let settings: Record<string, unknown> = {};
  const changedBeforeRead: Record<string, unknown> = {};
  const apply = () => {
    if (disposed || !ready) return;
    const enabled = settings.enabled !== false && settings.paperEnabled !== false;
    if (!enabled) { scope.__paperLatexProbe?.dispose(); scope.__paperMathEntry?.dispose(); }
    else {
      if (!scope.__paperLatexProbe?.status().enabled) scope.__paperLatexProbe = startController(document, createPaperPort(document));
      if (!scope.__paperMathEntry?.status().enabled) scope.__paperMathEntry = startMathEntry(document);
    }
  };
  const onChanged = (changes: Record<string, browser.storage.StorageChange>, area: string) => {
    if (area !== 'local') return;
    for (const key of ['enabled', 'paperEnabled']) {
      if (!Object.hasOwn(changes, key)) continue;
      settings[key] = changes[key].newValue;
      if (!ready) changedBeforeRead[key] = changes[key].newValue;
    }
    apply();
  };
  browser.storage.onChanged.addListener(onChanged);
  scope.__paperLatexCleanup = () => {
    disposed = true;
    scope.__paperMathEntry?.dispose();
    browser.storage.onChanged.removeListener(onChanged);
    scope.__paperLatexProbe?.dispose();
  };
  scope.__paperLatexReady = browser.storage.local.get(['enabled', 'paperEnabled']).then(saved => {
    settings = { ...saved, ...changedBeforeRead };
    ready = true;
    apply();
  }).catch(() => { /* Leave disabled if preferences cannot be read. */ });
}
