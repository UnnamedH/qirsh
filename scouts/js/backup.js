/* Backup export and import. A backup is one JSON file: the entries and everything else, plus the receipt
   photos, so a lost phone loses nothing. */
import { toast } from '../../js/ui/toast.js';
import { $, downloadBlob, ymd } from '../../js/util.js';
import * as receipts from './receipts.js';
import { parseBackup, save, state } from './state.js';
import { render } from './ui/render.js';
import { setPendingImport } from './ui/ui-state.js';

/* The receipts entries refer to; photos nothing refers to any more are left out. */
async function receiptsToExport() {
  if (!receipts.available) return {};
  const used = receipts.usedIds(state),
    have = await receipts.all(),
    out = {};
  for (const id of used) if (have[id]) out[id] = have[id];
  return out;
}

async function exportText() {
  const withReceipts = Object.assign({}, state, {
    exportedAt: new Date().toISOString(),
    receipts: await receiptsToExport(),
  });
  return JSON.stringify(withReceipts, null, 2);
}

export async function exportSave() {
  try {
    downloadBlob(
      new Blob([await exportText()], { type: 'application/json' }),
      'frata-scouts-backup-' + ymd(new Date()) + '.json',
    );
    state.lastExport = new Date().toISOString();
    save();
    render();
    toast('Backup saved');
  } catch (e) {
    toast('Saving failed.');
  }
}

/** Reads the picked file. It is only staged: replacing the data waits for the person to confirm. */
export function stageImport(file) {
  const r = new FileReader();
  r.onload = () => {
    const b = parseBackup(String(r.result));
    if (!b) setPendingImport({ error: true });
    else {
      const photos = receipts.receiptsFromBackup(b.parsed, b.state);
      setPendingImport({
        state: b.state,
        receipts: photos,
        // Entries that name a receipt the file doesn't hold: the entries are kept, the photos are missing.
        missing: [...receipts.usedIds(b.state)].filter((id) => !photos[id]).length,
      });
    }
    render();
  };
  r.onerror = () => {
    setPendingImport({ error: true });
    render();
  };
  r.readAsText(file);
  const input = $('#importFile');
  if (input) input.value = '';
}

/** Puts a staged backup's receipts in place of the ones here. Returns false if they couldn't be kept. */
export async function restoreReceipts(pending) {
  try {
    if (receipts.available) await receipts.replaceAll(pending.receipts || {});
    return true;
  } catch (e) {
    return false;
  }
}
