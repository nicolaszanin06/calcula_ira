const assert = require('node:assert/strict');
const { calculate, validate } = require('./progress.js');
const actual = calculate({ totalHours: 3525, completedHours: 1080, ongoingHours: 330 });
assert.ok(Math.abs(actual.currentPercent - 30.638297872340424) < 1e-10);
assert.equal(actual.projectedPercent, 40);
assert.equal(actual.projectedHours, 1410);
assert.equal(actual.remainingHours, 2115);
assert.equal(calculate({ totalHours: 100, completedHours: 90, ongoingHours: 30 }).projectedPercent, 100);
assert.equal(calculate({ totalHours: 100, completedHours: 0, ongoingHours: 0 }).currentPercent, 0);
assert.equal(calculate({ totalHours: 100, completedHours: 20, ongoingHours: 0 }).projectedPercent, 20);
for (const value of [null, {}, { totalHours: 0, completedHours: 0, ongoingHours: 0 },
  { totalHours: 100, completedHours: 101, ongoingHours: 0 }, { totalHours: 100, completedHours: 0, ongoingHours: -1 },
  { totalHours: 100, completedHours: 1.5, ongoingHours: 0 }, { totalHours: 100, completedHours: 0, ongoingHours: null }]) assert.throws(() => validate(value));
console.log('Integralização aprovada: situação atual, projeção, limites de 0% e 100%, horas restantes e entradas inválidas.');
