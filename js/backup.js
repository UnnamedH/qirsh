/* Backup export and import. */
import { isValid, normalize, save, state } from './state.js';
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

export function exportSave() {
  try {
    const url = URL.createObjectURL(new Blob([exportText()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = exportName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
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
