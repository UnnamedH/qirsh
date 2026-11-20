/* Backup export and import. */
import { $, downloadBlob, ymd } from '../../js/util.js';
import { parseState, save, state } from './state.js';
import { render } from './ui/render.js';
import { toast } from '../../js/ui/toast.js';
import { setPendingImport } from './ui/ui-state.js';

const exportText = () =>
  JSON.stringify(Object.assign({}, state, { exportedAt: new Date().toISOString() }), null, 2);

export function exportSave() {
  try {
    downloadBlob(
      new Blob([exportText()], { type: 'application/json' }),
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
    const next = parseState(String(r.result));
    if (!next) {
      setPendingImport({ error: true });
    } else setPendingImport({ state: next });
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
