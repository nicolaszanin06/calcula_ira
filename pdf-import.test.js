const assert = require('node:assert/strict');
const { parse } = require('./pdf-import.js');
const { calculate } = require('./calculator.js');
const item = (text, x, y, width = 20, height = 7) => ({ text, x, y, width, height });
function page(records, first = false) {
  const result = [item('UnB - Universidade de Brasília', 100, 780),
    item('Componentes Curriculares Cursados/Cursando', 197, 650),
    item('CH', 416, 630, 9), item('Turma', 445, 630, 18), item('Nota', 506, 630, 13), item('Situação', 533, 630, 25),
    item('Legenda', 33, 300)];
  if (first) result.push(item('Ano / Período Letivo Inicial:', 33, 710), item('2025.1', 230, 710));
  records.forEach((record, index) => {
    const y = 605 - index * 24;
    result.push(item(record.period || '2025.1', 41, y), item(record.code || 'ABC0001', 91, y, 30),
      item(record.name || 'DISCIPLINA DE EXEMPLO', 129, y + 3.5, 180), item('Dr. DOCENTE (60h)', 129, y - 3.5, 100, 6),
      item(String(record.hours ?? 60), 417, y, 8), item(record.mention || '-', 508, y, 10), item(record.status || 'APR', 538, y, 14));
    if (record.marker) result.push(item(record.marker, 77, y, 4));
  });
  return result;
}
const parsed = parse([page([
  { mention: 'MI', code: 'ABC0001' }, { mention: 'SS', code: 'ABC0001', period: '2025.2' },
  { mention: 'SS', marker: '#', name: 'ELETIVA' }, { status: 'MATR', period: '2026.2' },
  { code: 'ENADE', hours: 0 }, { status: 'TRANC' }
], true), page([{ mention: 'MS', period: '2026.1' }]), [item('Componentes Curriculares Obrigatórios Pendentes:', 33, 700), item('ABC9999', 91, 680)]]);
assert.equal(parsed.rows.length, 6);
assert.equal(parsed.ignored, 1);
assert.equal(parsed.candidates, 7);
assert.deepEqual(parsed.warnings, []);
assert.equal(parsed.rows[0].credits, 4);
assert.equal(parsed.rows[1].semester, 2);
assert.equal(parsed.rows[2].module, 'livre');
assert.equal(parsed.rows[3].mention, 'CURSANDO');
assert.equal(parsed.rows[3].semester, 4);
assert.equal(parsed.rows[4].mention, 'TR');
assert.equal(parsed.rows[5].semester, 3);
assert.equal(parsed.rows[0].name, 'DISCIPLINA DE EXEMPLO');
assert.equal(calculate(parsed.rows).count, 4);
const warnings = parse([page([{ mention: 'SS' }, { hours: 17, mention: 'SS' }, { mention: 'UNKNOWN', status: 'REP' }, { period: '2025.0', mention: 'MS' }], true)]);
assert.equal(warnings.rows.length, 1);
assert.equal(warnings.warnings.length, 3);
assert.throws(() => parse([page([{ mention: 'SS' }])]), /período de ingresso/);
assert.throws(() => parse([[item('PDF sem texto reconhecível', 0, 0)]]), /histórico da UnB/);
assert.throws(() => parse(Array(51).fill([])), /50 páginas/);
const shuffled = parse([page([{ mention: 'SS' }], true).reverse()]);
assert.equal(shuffled.rows.length, 1);
function curriculum(required, completed) {
  const result = [item('Carga Horária Integralizada/Pendente', 33, 280)];
  for (const [label, values, y] of [['Exigido', required, 250], ['Integralizado', completed, 230]]) {
    result.push(item(label, 33, y));
    [...values, values.reduce((sum, value) => sum + value, 0)].forEach((value, index) => result.push(item(`${value} h`, 140 + index * 100, y)));
  }
  result.push(item('Carga Horária Extensionista', 33, 200));
  return result;
}
const cappedPage = page([
  { mention: 'SS', code: 'ABC0001' }, { status: 'MATR', code: 'ABC0001' },
  { status: 'MATR', code: 'ABC0002' }, { status: 'MATR', code: 'ABC0002' },
  { status: 'MATR', code: 'ABC0003', marker: '#' },
  { status: 'MATR', code: 'ABC0004', marker: '%' }
], true);
cappedPage.push(...curriculum([120, 30, 0], [60, 30, 0]));
assert.deepEqual(parse([cappedPage]).progress, { totalHours: 150, completedHours: 90, ongoingHours: 60 });
assert.equal(parsed.progress, null);
console.log('Importador aprovado: colunas, múltiplas páginas, menções, tentativas repetidas, eletivas, andamento, trancamentos, ENADE, pendências e erros de leitura.');
