'use strict';
const KEY = 'unb-ira-history-v1';
const PROGRESS_KEY = 'unb-ira-progress-v1';
const $ = id => document.getElementById(id);
let rows = [];
let storageAvailable = true;
try {
  const saved = localStorage.getItem(KEY);
  if (saved) rows = IRACalculator.validate(JSON.parse(saved));
} catch (_) {
  storageAvailable = false;
  $('message').textContent = 'Não foi possível recuperar o histórico salvo. Você pode usar a calculadora e exportar os dados.';
}
const format = value => value === null ? '—' : value.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
function announce(text) { $('message').textContent = text; }
const progressFields = { totalHours: 'progress-total', completedHours: 'progress-completed', ongoingHours: 'progress-ongoing' };
const percent = value => `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const hours = value => `${value.toLocaleString('pt-BR')} h`;
function progressInput() {
  return Object.fromEntries(Object.entries(progressFields).map(([key, id]) => [key, $(id).value === '' ? null : Number($(id).value)]));
}
function progressForExport() {
  const value = progressInput();
  return Object.values(value).every(number => number === null) ? null : CourseProgress.validate(value);
}
function updateProgress() {
  const value = progressInput();
  try {
    const result = CourseProgress.calculate(value);
    $('progress-current').textContent = percent(result.currentPercent);
    $('progress-projected').textContent = percent(result.projectedPercent);
    $('progress-current-hours').textContent = `${hours(result.completedHours)} de ${hours(result.totalHours)}`;
    $('progress-projected-hours').textContent = `${hours(result.projectedHours)} de ${hours(result.totalHours)}`;
    $('progress-current-fill').style.width = `${result.currentPercent}%`;
    $('progress-added-fill').style.width = `${result.projectedPercent - result.currentPercent}%`;
    $('progress-detail').textContent = `+${hours(result.addedHours)} se aprovado em tudo · faltariam ${hours(result.remainingHours)} para completar a carga do currículo.`;
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(CourseProgress.validate(value))); }
    catch (_) { $('progress-detail').textContent += ' Salvamento indisponível: exporte uma cópia.'; }
  } catch (error) {
    $('progress-current').textContent = '—'; $('progress-projected').textContent = '—';
    $('progress-current-hours').textContent = 'Preencha os totais'; $('progress-projected-hours').textContent = 'Projeção do semestre';
    $('progress-current-fill').style.width = '0%'; $('progress-added-fill').style.width = '0%';
    $('progress-detail').textContent = Object.values(value).every(number => number === null) ? 'Importe um histórico PDF ou preencha os três campos para calcular.' : error.message;
    if (Object.values(value).every(number => number === null)) { try { localStorage.removeItem(PROGRESS_KEY); } catch (_) { /* Storage may be unavailable. */ } }
  }
}
function setProgress(value) {
  for (const [key, id] of Object.entries(progressFields)) $(id).value = value?.[key] ?? '';
  if (!value) { try { localStorage.removeItem(PROGRESS_KEY); } catch (_) { /* Storage may be unavailable. */ } }
  updateProgress();
}
for (const id of Object.values(progressFields)) $(id).addEventListener('input', updateProgress);
try {
  const savedProgress = localStorage.getItem(PROGRESS_KEY);
  setProgress(savedProgress ? CourseProgress.validate(JSON.parse(savedProgress)) : null);
} catch (_) { setProgress(null); }
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(rows)); storageAvailable = true; }
  catch (_) { storageAvailable = false; }
  $('storage-status').textContent = storageAvailable ? 'Salvo apenas neste navegador' : 'Salvamento indisponível · exporte uma cópia';
}
function updateResults() {
  try {
    const result = IRACalculator.calculate(rows);
    $('ira').textContent = format(result.ira);
    $('mp').textContent = format(result.mp);
    $('count').textContent = result.count;
    $('credits').textContent = result.credits;
    $('meter-fill').style.width = `${(result.ira ?? 0) * 20}%`;
    $('result-description').textContent = result.ira === null ? 'Adicione disciplinas com menção para calcular.' : 'Calculado com as disciplinas informadas, conforme a resolução de 2020.';
    persist();
  } catch (_) {
    $('ira').textContent = '—'; $('mp').textContent = '—';
    $('count').textContent = '—'; $('credits').textContent = '—';
    $('meter-fill').style.width = '0%';
    $('result-description').textContent = 'Preencha créditos e semestre com inteiros de 1 a 100 para calcular.';
    $('storage-status').textContent = 'Preencha os campos para salvar as alterações';
  }
}
function inputCell(row, index, property, type, options, onUpdate = updateResults, prefix = '') {
  const cell = document.createElement('td');
  const control = document.createElement(type === 'select' ? 'select' : 'input');
  if (type === 'select') {
    for (const [value, label] of options) {
      const option = document.createElement('option'); option.value = value; option.textContent = label; control.append(option);
    }
  } else {
    control.type = type;
    if (type === 'number') { control.min = 1; control.max = 100; control.step = 1; control.required = true; }
    else { control.maxLength = 160; control.placeholder = 'Nome da disciplina'; }
  }
  const labels = { name: 'Nome', credits: 'Créditos', semester: 'Semestre', mention: 'Menção', module: 'Módulo' };
  cell.dataset.label = labels[property];
  control.setAttribute('aria-label', `${prefix}${labels[property]} da disciplina ${index + 1}`);
  control.value = row[property];
  control.addEventListener(type === 'select' ? 'change' : 'input', () => {
    row[property] = type === 'number' ? (control.value === '' ? null : Number(control.value)) : control.value;
    announce(''); onUpdate();
  });
  cell.append(control); return cell;
}
function render() {
  $('rows').replaceChildren();
  rows.forEach((row, index) => {
    const tr = document.createElement('tr');
    tr.append(inputCell(row, index, 'name', 'text'), inputCell(row, index, 'credits', 'number'), inputCell(row, index, 'semester', 'number'),
      inputCell(row, index, 'mention', 'select', [['CURSANDO', 'Em andamento'], ...Object.entries(IRACalculator.mentions).map(([key, value]) => [key, `${key} · ${value}`]), ['CC', 'CC'], ['TR', 'TR'], ['TJ', 'TJ']]),
      inputCell(row, index, 'module', 'select', [['integrante', 'Obrig. / opt.'], ['livre', 'Livre']]));
    const cell = document.createElement('td'); const remove = document.createElement('button');
    remove.className = 'remove'; remove.textContent = '×'; remove.setAttribute('aria-label', `Remover disciplina ${index + 1}`);
    remove.addEventListener('click', () => { rows.splice(index, 1); render(); $('add').focus(); });
    cell.append(remove); tr.append(cell); $('rows').append(tr);
  });
  $('empty').hidden = rows.length > 0;
  updateResults();
}
$('add').addEventListener('click', () => {
  if (rows.length >= 1000) return announce('Limite de 1.000 disciplinas atingido.');
  rows.push({ name: '', credits: 4, semester: 1, mention: 'CURSANDO', module: 'integrante' });
  render(); $('rows').lastElementChild.querySelector('input').focus();
});
$('example').addEventListener('click', () => {
  if (rows.length && !confirm('Substituir seu histórico pelo exemplo? Exporte seus dados antes, se quiser guardá-los.')) return;
  rows = [
    { name: 'Cálculo 1', credits: 6, semester: 1, mention: 'MS', module: 'integrante' },
    { name: 'Introdução à programação', credits: 4, semester: 1, mention: 'SS', module: 'integrante' },
    { name: 'Álgebra linear', credits: 4, semester: 2, mention: 'MM', module: 'integrante' },
    { name: 'Fotografia', credits: 2, semester: 2, mention: 'SS', module: 'livre' }
  ];
  setProgress(null); render(); announce('Exemplo carregado. Altere as menções para experimentar.');
});
$('clear').addEventListener('click', () => {
  if ((rows.length || Object.values(progressInput()).some(value => value !== null)) && confirm('Apagar as disciplinas e os totais de integralização salvos neste navegador?')) { rows = []; setProgress(null); render(); announce('Histórico limpo.'); }
});
$('export').addEventListener('click', () => {
  try {
    const valid = IRACalculator.validate(rows);
    const progress = progressForExport();
    const blob = new Blob([JSON.stringify({ version: 2, rows: valid, progress }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'historico-ira-unb.json'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); announce('Histórico exportado.');
  } catch (error) { announce(error.message); }
});
$('import').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > 1024 * 1024) throw new Error('O arquivo deve ter no máximo 1 MB.');
    const data = JSON.parse(await file.text());
    if (![1, 2].includes(data.version)) throw new Error('Formato não reconhecido. Use um arquivo exportado por esta calculadora.');
    const imported = IRACalculator.validate(data.rows);
    const importedProgress = data.progress == null ? null : CourseProgress.validate(data.progress);
    if (rows.length && !confirm('Substituir seu histórico pelos dados importados?')) return;
    rows = imported; setProgress(importedProgress); render(); announce('Histórico importado com sucesso.');
  } catch (error) { announce(`Não foi possível importar: ${error.message}`); }
  finally { event.target.value = ''; }
});
render();

let pdfPreview = null;
function updatePreview() {
  const confirmButton = $('pdf-confirm');
  try {
    const result = IRACalculator.calculate(pdfPreview.rows);
    const official = pdfPreview.official;
    const same = ['ira', 'mp'].every(key => official[key] === undefined || result[key] !== null && Math.abs(result[key] - official[key]) < .00011);
    $('pdf-comparison').textContent = `Prévia: IRA ${format(result.ira)} · MP ${format(result.mp)}. ` +
      (official.ira !== undefined || official.mp !== undefined ? `No PDF: IRA ${format(official.ira ?? null)} · MP ${format(official.mp ?? null)}. ${same ? 'Os índices conferem.' : 'Há diferença: confira disciplinas, menções, semestres e módulos antes de salvar.'}` : 'O PDF não informou índices para comparar.');
    $('pdf-comparison').classList.toggle('mismatch', !same);
    $('pdf-error').textContent = ''; confirmButton.disabled = false;
  } catch (error) {
    $('pdf-error').textContent = error.message;
    $('pdf-comparison').textContent = 'Corrija os campos para calcular a prévia.'; confirmButton.disabled = true;
  }
}
function showPDFPreview(data) {
  pdfPreview = data;
  if (data.progress) {
    const projection = CourseProgress.calculate(data.progress);
    $('pdf-progress-summary').textContent = `Integralização: ${percent(projection.currentPercent)} (${hours(projection.completedHours)} de ${hours(projection.totalHours)}). Passando em tudo: ${percent(projection.projectedPercent)} (+${hours(projection.addedHours)} aproveitáveis). Confira os totais após salvar se houver regras específicas de aproveitamento.`;
  } else {
    $('pdf-progress-summary').textContent = 'Totais de integralização não reconhecidos neste PDF. Você pode preenchê-los manualmente após salvar.';
  }
  $('pdf-summary').textContent = `${data.rows.length} disciplinas encontradas · ingresso ${data.initial} · ${data.rows.filter(row => row.mention === 'CURSANDO').length} em andamento. ${data.ignored} ${data.ignored === 1 ? 'registro sem efeito no cálculo ignorado' : 'registros sem efeito no cálculo ignorados'} (como ENADE e cancelamentos).`;
  $('pdf-warnings').replaceChildren();
  for (const warning of data.warnings) { const li = document.createElement('li'); li.textContent = warning; $('pdf-warnings').append(li); }
  $('pdf-warnings').hidden = !data.warnings.length;
  $('pdf-rows').replaceChildren();
  data.rows.forEach((row, index) => {
    const tr = document.createElement('tr');
    const cell = (property, type, options) => inputCell(row, index, property, type, options, updatePreview, 'Prévia: ');
    tr.append(cell('name', 'text'), cell('credits', 'number'), cell('semester', 'number'),
      cell('mention', 'select', [['CURSANDO', 'Em andamento'], ...Object.entries(IRACalculator.mentions).map(([key, value]) => [key, `${key} · ${value}`]), ['CC', 'CC'], ['TR', 'TR'], ['TJ', 'TJ']]),
      cell('module', 'select', [['integrante', 'Obrig. / opt.'], ['livre', 'Livre']]));
    $('pdf-rows').append(tr);
  });
  updatePreview(); $('pdf-review').showModal();
}
$('import-pdf').addEventListener('click', () => $('pdf-file').click());
$('pdf-file').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  const button = $('import-pdf'); button.disabled = true; button.textContent = 'Lendo PDF…';
  announce('Lendo o histórico no seu navegador…');
  try { showPDFPreview(await HistoryPDF.read(file)); announce('Confira a prévia antes de salvar.'); }
  catch (error) { announce(`Não foi possível importar o PDF: ${error.message}`); }
  finally { button.disabled = false; button.textContent = 'Importar histórico PDF'; event.target.value = ''; }
});
const closePDF = () => { $('pdf-review').close(); };
$('pdf-close').addEventListener('click', closePDF);
$('pdf-cancel').addEventListener('click', closePDF);
$('pdf-review').addEventListener('close', () => { pdfPreview = null; $('pdf-rows').replaceChildren(); announce(''); });
$('pdf-confirm').addEventListener('click', () => {
  try {
    const imported = IRACalculator.validate(pdfPreview.rows);
    rows = imported; setProgress(pdfPreview.progress); render(); closePDF(); announce('Histórico importado e salvo neste navegador. Disciplinas em andamento só entram no IRA quando você escolhe uma menção. Confira também a integralização do curso.');
  } catch (error) { $('pdf-error').textContent = error.message; }
});
