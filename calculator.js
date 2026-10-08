(function (root) {
  'use strict';
  const mentions = Object.freeze({ SS: 5, MS: 4, MM: 3, MI: 2, II: 1, SR: 0 });
  const excluded = ['CC', 'TR', 'TJ', 'CURSANDO'];
  function validate(rows) {
    if (!Array.isArray(rows) || rows.length > 1000) throw new Error('O histórico deve conter até 1.000 disciplinas.');
    return rows.map((row, index) => {
      if (!row || typeof row !== 'object' || typeof row.name !== 'string' || row.name.length > 160 ||
          !Number.isInteger(row.credits) || row.credits < 1 || row.credits > 100 ||
          !Number.isInteger(row.semester) || row.semester < 1 || row.semester > 100 ||
          !(Object.hasOwn(mentions, row.mention) || excluded.includes(row.mention)) ||
          !['integrante', 'livre'].includes(row.module)) {
        throw new Error(`Confira os dados da disciplina ${index + 1}: créditos e semestre devem ser inteiros de 1 a 100.`);
      }
      return { name: row.name, credits: row.credits, semester: row.semester, mention: row.mention, module: row.module };
    });
  }
  function calculate(rows) {
    const valid = validate(rows).filter(row => Object.hasOwn(mentions, row.mention));
    let numerator = 0, denominator = 0, mpNumerator = 0, mpDenominator = 0, credits = 0;
    for (const row of valid) {
      const weight = row.credits * Math.min(row.semester, 6);
      numerator += mentions[row.mention] * weight;
      denominator += weight;
      credits += row.credits;
      if (row.module === 'integrante') {
        mpNumerator += mentions[row.mention] * row.credits;
        mpDenominator += row.credits;
      }
    }
    return { ira: denominator ? numerator / denominator : null, mp: mpDenominator ? mpNumerator / mpDenominator : null, count: valid.length, credits };
  }
  function project(rows, predictions = []) {
    const valid = validate(rows);
    if (!Array.isArray(predictions) || predictions.length > valid.length) throw new Error('As menções esperadas devem corresponder às disciplinas do histórico.');
    const current = calculate(valid);
    let ongoingCount = 0, selectedCount = 0;
    const simulated = valid.map((row, index) => {
      if (row.mention !== 'CURSANDO') return row;
      ongoingCount++;
      const expected = predictions[index];
      if (expected == null || expected === '') return row;
      if (!Object.hasOwn(mentions, expected)) throw new Error('Escolha uma menção de SS a SR para simular.');
      selectedCount++;
      return { ...row, mention: expected };
    });
    const projected = ongoingCount && selectedCount === ongoingCount ? calculate(simulated) : null;
    return { current, projected, ongoingCount, selectedCount,
      delta: projected && current.ira !== null ? projected.ira - current.ira : null };
  }
  const api = { mentions, validate, calculate, project };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IRACalculator = api;
})(globalThis);
