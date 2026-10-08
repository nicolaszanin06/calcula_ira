'use strict';
const KEY = 'unb-ira-history-v1';
const PROGRESS_KEY = 'unb-ira-progress-v1';
const $ = id => document.getElementById(id);
let rows = [];
const forecasts = new WeakMap();
let goalExample = null;
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
  renderForecasts();
  updateGoal();
}
function renderForecasts() {
  $('forecast-list').replaceChildren();
  const ongoing = rows.filter(row => row.mention === 'CURSANDO');
  $('forecast-count').textContent = ongoing.length ? `${ongoing.length} ${ongoing.length === 1 ? 'disciplina em andamento' : 'disciplinas em andamento'}${ongoing.length > 4 ? ' · role a lista para ver todas' : ''}` : '';
  $('forecast-empty').hidden = ongoing.length > 0;
  ongoing.forEach((row, index) => {
    if (!forecasts.has(row)) forecasts.set(row, 'MS');
    const label = document.createElement('label'); label.className = 'forecast-row';
    const text = document.createElement('span');
    const name = document.createElement('strong'); name.textContent = row.name || `Disciplina em andamento ${index + 1}`;
    const meta = document.createElement('small'); meta.textContent = `${row.credits ?? '—'} créditos · semestre ${row.semester ?? '—'}`;
    text.append(name, meta);
    const select = document.createElement('select'); select.setAttribute('aria-label', `Menção esperada: ${row.name || `disciplina ${index + 1}`}`);
    for (const [mention, value] of Object.entries(IRACalculator.mentions)) {
      const option = document.createElement('option'); option.value = mention; option.textContent = `${mention} · ${value}`; select.append(option);
    }
    select.value = forecasts.get(row);
    select.addEventListener('change', () => { forecasts.set(row, select.value); updateProjection(); });
    label.append(text, select); $('forecast-list').append(label);
  });
  updateProjection();
}
function updateProjection() {
  try {
    const predictions = rows.map(row => row.mention === 'CURSANDO' ? forecasts.get(row) : null);
    const result = IRACalculator.project(rows, predictions);
    $('forecast-current').textContent = format(result.current.ira);
    $('forecast-result').textContent = format(result.projected?.ira ?? null);
    if (!result.ongoingCount) $('forecast-change').textContent = 'Adicione disciplinas em andamento para ver a projeção.';
    else if (!result.projected) $('forecast-change').textContent = 'Escolha uma menção esperada para cada disciplina.';
    else if (result.delta === null) $('forecast-change').textContent = `Primeiro IRA estimado com ${result.ongoingCount} disciplinas em andamento.`;
    else {
      const delta = Math.abs(result.delta) < 1e-12 ? 0 : result.delta;
      $('forecast-change').textContent = `${delta >= 0 ? '+' : '−'}${format(Math.abs(delta))} em relação ao IRA atual · ${result.ongoingCount} disciplinas simuladas.`;
    }
    for (const mention of ['MM', 'MS', 'SS']) {
      const id = `scenario-${mention.toLowerCase()}`;
      const scenario = IRACalculator.project(rows, rows.map(row => row.mention === 'CURSANDO' ? mention : null));
      $(`${id}-value`).textContent = format(scenario.projected?.ira ?? null);
      $(id).disabled = !result.ongoingCount;
      $(id).setAttribute('aria-pressed', String(result.ongoingCount > 0 && rows.filter(row => row.mention === 'CURSANDO').every(row => forecasts.get(row) === mention)));
    }
  } catch (_) {
    $('forecast-current').textContent = '—'; $('forecast-result').textContent = '—';
    $('forecast-change').textContent = 'Confira créditos e semestre no histórico para calcular a projeção.';
    for (const mention of ['mm', 'ms', 'ss']) { $(`scenario-${mention}-value`).textContent = '—'; $(`scenario-${mention}`).disabled = true; $(`scenario-${mention}`).setAttribute('aria-pressed', 'false'); }
  }
  renderEvolution();
}
function updateGoal() {
  goalExample = null; $('goal-apply').disabled = true; $('goal-example').textContent = '';
  try {
    const target = $('ira-target').value === '' ? NaN : Number($('ira-target').value);
    const result = IRACalculator.goal(rows, target);
    $('goal-label').textContent = 'Média necessária nas menções esperadas';
    const requiredDisplay = result.required === null ? null : Math.max(0, Math.ceil((result.required - 1e-12) * 1000) / 1000);
    $('goal-required').textContent = result.status === 'achievable' ? format(requiredDisplay) : '—';
    if (result.status === 'no_ongoing') {
      $('goal-message').textContent = result.current !== null && result.current >= target ? 'Você já atingiu essa meta no histórico atual. Adicione disciplinas em andamento para planejar o próximo resultado.' : 'Adicione disciplinas em andamento para calcular como atingir sua meta.';
    } else if (result.status === 'impossible') {
      $('goal-label').textContent = 'Meta fora do alcance neste cenário';
      $('goal-message').textContent = `Mesmo com tudo SS, o IRA chegaria a ${format(result.maximum)}. Experimente uma meta menor ou adicione disciplinas futuras.`;
    } else {
      $('goal-message').textContent = result.required === 0 ? 'Essa meta se mantém mesmo com SR nas disciplinas em andamento.' : `Para chegar a ${format(target)}, a média ponderada das menções em andamento precisa ser pelo menos ${format(requiredDisplay)} de 5.`;
      goalExample = result.example; $('goal-apply').disabled = false;
      const counts = new Map(); result.example.filter(Boolean).forEach(mention => counts.set(mention, (counts.get(mention) || 0) + 1));
      $('goal-example').textContent = `Exemplo: ${[...counts].map(([mention, count]) => `${count} ${mention}`).join(' + ')} → IRA ${format(result.exampleIRA)}. É um cenário possível; outras combinações também podem atingir a meta.`;
    }
  } catch (error) { $('goal-required').textContent = '—'; $('goal-message').textContent = error.message; }
}
$('ira-target').addEventListener('input', updateGoal);
$('goal-apply').addEventListener('click', () => {
  if (!goalExample) return;
  rows.forEach((row, index) => { if (row.mention === 'CURSANDO') forecasts.set(row, goalExample[index]); });
  renderForecasts(); $('projection-title').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
function renderEvolution() {
  const chart = $('evolution-chart'); chart.replaceChildren(); $('evolution-values').replaceChildren();
  try {
    const actual = IRACalculator.evolution(rows);
    const ongoing = rows.filter(row => row.mention === 'CURSANDO');
    const firstForecast = ongoing.length ? Math.min(...ongoing.map(row => row.semester)) : Infinity;
    const simulatedRows = rows.map(row => row.mention === 'CURSANDO' ? { ...row, mention: forecasts.get(row) || 'MS' } : row);
    const future = ongoing.length ? IRACalculator.evolution(simulatedRows).filter(point => point.semester >= firstForecast) : [];
    const points = [...actual, ...future];
    $('evolution-empty').hidden = points.length > 0;
    $('evolution-empty').textContent = 'Adicione disciplinas com menção para ver a evolução do seu IRA.';
    if (!points.length) return;
    const semesters = [...new Set(points.map(point => point.semester))].sort((a, b) => a - b);
    const width = Math.max(440, semesters.length * 48 + 64), height = 240;
    const first = semesters[0], last = semesters.at(-1);
    const x = semester => last === first ? width / 2 : 40 + (semester - first) / (last - first) * (width - 64);
    const y = ira => 190 - ira / 5 * 160;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Evolução do IRA acumulado por semestre. Os valores também estão disponíveis abaixo do gráfico.');
    svg.style.minWidth = semesters.length <= 6 ? '300px' : `${width}px`;
    const node = (tag, attributes, text) => {
      const element = document.createElementNS(svg.namespaceURI, tag);
      for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
      if (text !== undefined) element.textContent = text; svg.append(element); return element;
    };
    for (let value = 0; value <= 5; value++) {
      node('line', { x1: 40, x2: width - 24, y1: y(value), y2: y(value), stroke: '#e1e7dd' });
      node('text', { x: 22, y: y(value) + 4, 'text-anchor': 'middle', class: 'chart-text' }, value);
    }
    for (const semester of semesters) node('text', { x: x(semester), y: 215, 'text-anchor': 'middle', class: 'chart-text' }, `${semester}º`);
    const draw = (series, forecast, markerFrom = 0) => {
      if (series.length > 1) node('polyline', { points: series.map(point => `${x(point.semester)},${y(point.ira)}`).join(' '), fill: 'none', stroke: forecast ? '#80a34d' : '#16483b', 'stroke-width': 3, 'stroke-dasharray': forecast ? '6 5' : 'none' });
      series.forEach((point, index) => {
        if (index < markerFrom) return;
        const circle = node('circle', { cx: x(point.semester), cy: y(point.ira), r: 5, fill: forecast ? '#a8d969' : '#16483b' });
        const title = document.createElementNS(svg.namespaceURI, 'title'); title.textContent = `${point.semester}º semestre · ${forecast ? 'simulado' : 'histórico'}: ${format(point.ira)}`; circle.append(title);
      });
    };
    draw(actual, false);
    if (future.length) {
      const previous = actual.filter(point => point.semester < firstForecast).at(-1);
      draw(previous ? [previous, ...future] : future, true, previous ? 1 : 0);
    }
    chart.append(svg);
    for (const semester of semesters) {
      const historical = actual.find(point => point.semester === semester), forecast = future.find(point => point.semester === semester);
      const line = document.createElement('p'); line.textContent = `${semester}º semestre · histórico: ${format(historical?.ira ?? null)}${forecast ? ` · simulação: ${format(forecast.ira)}` : ''}`;
      $('evolution-values').append(line);
    }
  } catch (_) { $('evolution-empty').hidden = false; $('evolution-empty').textContent = 'Confira créditos e semestre no histórico para ver a evolução.'; }
}
for (const mention of ['MM', 'MS', 'SS']) {
  $(`scenario-${mention.toLowerCase()}`).addEventListener('click', () => {
    for (const row of rows) if (row.mention === 'CURSANDO') forecasts.set(row, mention);
    renderForecasts();
  });
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
