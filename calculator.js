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
  const api = { mentions, validate, calculate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IRACalculator = api;
})(globalThis);
