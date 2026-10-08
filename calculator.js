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
  function goal(rows, target) {
    if (typeof target !== 'number' || !Number.isFinite(target) || target < 0 || target > 5) throw new Error('Informe uma meta de IRA entre 0 e 5.');
    const valid = validate(rows), current = calculate(valid);
    let numerator = 0, completedWeight = 0, ongoingWeight = 0;
    const ongoing = [];
    valid.forEach((row, index) => {
      const weight = row.credits * Math.min(row.semester, 6);
      if (Object.hasOwn(mentions, row.mention)) { numerator += mentions[row.mention] * weight; completedWeight += weight; }
      else if (row.mention === 'CURSANDO') { ongoingWeight += weight; ongoing.push({ index, weight }); }
    });
    if (!ongoingWeight) return { status: 'no_ongoing', current: current.ira, target, required: null, maximum: current.ira, example: null };
    const maximum = (numerator + 5 * ongoingWeight) / (completedWeight + ongoingWeight);
    const raw = (target * (completedWeight + ongoingWeight) - numerator) / ongoingWeight;
    if (raw > 5 + 1e-12) return { status: 'impossible', current: current.ira, target, required: raw, maximum, example: null };
    const required = Math.max(0, Math.min(5, raw));
    const base = Math.floor(required), grades = ['SR', 'II', 'MI', 'MM', 'MS', 'SS'];
    const predictions = valid.map(row => row.mention === 'CURSANDO' ? grades[base] : null);
    let added = base * ongoingWeight;
    for (const item of ongoing.sort((a, b) => b.weight - a.weight || a.index - b.index)) {
      if (numerator + added >= target * (completedWeight + ongoingWeight) - 1e-10) break;
      predictions[item.index] = grades[base + 1]; added += item.weight;
    }
    return { status: 'achievable', current: current.ira, target, required, maximum,
      example: predictions, exampleIRA: project(valid, predictions).projected.ira };
  }
  function evolution(rows) {
    const valid = validate(rows).filter(row => Object.hasOwn(mentions, row.mention));
    const semesters = [...new Set(valid.map(row => row.semester))].sort((a, b) => a - b);
    return semesters.map(semester => {
      const semesterRows = valid.filter(row => row.semester === semester);
      const accumulated = calculate(valid.filter(row => row.semester <= semester));
      return { semester, ira: accumulated.ira, credits: semesterRows.reduce((sum, row) => sum + row.credits, 0), count: semesterRows.length };
    });
  }
  const api = { mentions, validate, calculate, project, goal, evolution };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IRACalculator = api;
})(globalThis);
