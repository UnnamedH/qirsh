/* Backup export and import. */
import { isValid, normalize, rescuedData, save, state } from './state.js';
import { render } from './ui/render.js';
import { toast } from './ui/toast.js';
import { setPendingImport } from './ui/ui-state.js';
import { $, ymd } from './util.js';

const exportText = () =>
  JSON.stringify(Object.assign({}, state, { exportedAt: new Date().toISOString() }), null, 2);

const exportName = () => 'qirsh-backup-' + ymd(new Date()) + '.json';

function markExported() {
  state.lastExport = new Date().toISOString();
  save();
}

export async function exportShare() {
  try {
    const file = new File([exportText()], exportName(), { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Qirsh backup' });
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

function download(text, name, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

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
    toast('That file isn’t a Qirsh backup (no transactions list).');
    return;
  }
  setPendingImport(normalize(s));
  render();
}
