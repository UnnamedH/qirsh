/* Backup export and import. */
import { IOS, STANDALONE } from './pwa.js';
import { isValid, normalize, rescuedData, save, state } from './state.js';
import { render } from './ui/render.js';
import { toast } from './ui/toast.js';
import { setPendingImport } from './ui/ui-state.js';
import { $, downloadBlob, ymd } from './util.js';

const exportText = () =>
  JSON.stringify(Object.assign({}, state, { exportedAt: new Date().toISOString() }), null, 2);

const exportName = () => 'qirsh-backup-' + ymd(new Date()) + '.json';

/* When "Later" was tapped on the backup reminder. Kept on this device only, like the other tips. */
const SNOOZE_KEY = 'qirsh.backupSnooze';
const DAY = 864e5;

/**
 * True when it is time to remind about a backup: there are entries added since the last export, and
 * the last export (or, with none yet, the oldest entry) is over 30 days old. "Later" waits a week.
 */
export function backupDue(now = Date.now()) {
  if (state.sample || !state.tx.length) return false;
  const last = state.lastExport ? Date.parse(state.lastExport) || 0 : 0;
  const times = state.tx.map((t) => +t.createdAt || 0).filter(Boolean);
  if (!times.some((c) => c > last)) return false;
  if (now - (last || Math.min(...times)) < 30 * DAY) return false;
  try {
    return now - (+localStorage.getItem(SNOOZE_KEY) || 0) >= 7 * DAY;
  } catch (e) {
    return true;
  }
}

export function snoozeBackup() {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now()));
  } catch (e) {}
}

function markExported() {
  state.lastExport = new Date().toISOString();
  save();
}

export async function exportShare() {
  try {
    const file = new File([exportText()], exportName(), { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Frata backup' });
      markExported();
      render();
      toast('Backup shared');
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  toast('Sharing a file isn’t available here. Use Save file or Copy JSON.');
}

const download = (text, name, type) => downloadBlob(new Blob([text], { type }), name);

/* Downloads saved data that could not be read, exactly as it was stored. */
export function exportRescued() {
  const raw = rescuedData();
  if (!raw) return;
  try {
    download(raw, 'qirsh-unreadable-' + ymd(new Date()) + '.txt', 'text/plain');
    toast('Saving the unreadable data');
  } catch (e) {
    toast('Saving failed.');
  }
}

export function exportSave() {
  try {
    download(exportText(), exportName(), 'application/json');
    markExported();
    render();
    toast('Saving ' + exportName());
  } catch (e) {
    toast('Saving failed. Use Copy JSON instead.');
  }
}

export function exportCopy() {
  const txt = exportText();
  const show = () => {
    $('#exportOut').innerHTML =
      '<label class="field"><span>Select all and copy</span><textarea id="exportTxt" readonly></textarea></label>';
    const ta = $('#exportTxt');
    ta.value = txt;
    ta.focus();
    ta.select();
  };
  try {
    navigator.clipboard.writeText(txt).then(() => {
      markExported();
      render();
      toast('Backup copied. Paste it somewhere safe.');
    }, show);
  } catch (e) {
    show();
  }
}

export function stageImport(text) {
  let s;
  try {
    s = JSON.parse(text);
  } catch (e) {
    toast('That isn’t valid JSON.');
    return;
  }
  if (!isValid(s)) {
    toast('That file isn’t a Frata backup (no transactions list).');
    return;
  }
  setPendingImport(normalize(s));
  render();
}

/** Saves a generated file. The installed iPhone app has no downloads folder, so it uses the share sheet. */
export async function saveFile(blob, name) {
  if (IOS && STANDALONE && navigator.canShare) {
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name });
      } catch (e) {}
      return;
    }
  }
  try {
    downloadBlob(blob, name);
    toast('Saving ' + name);
  } catch (e) {
    toast('Saving failed.');
  }
}
