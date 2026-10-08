(function (root) {
  'use strict';
  function validate(value) {
    if (!value || typeof value !== 'object') throw new Error('Preencha as cargas horárias para calcular a integralização.');
    const result = {};
    for (const key of ['totalHours', 'completedHours', 'ongoingHours']) {
      const number = value[key];
      if (!Number.isInteger(number) || number < 0 || number > 100000 || (key === 'totalHours' && number === 0)) {
        throw new Error('Use horas inteiras entre 0 e 100.000 e um total do currículo maior que zero.');
      }
      result[key] = number;
    }
    if (result.completedHours > result.totalHours) throw new Error('A carga integralizada não pode ser maior que o total do currículo.');
    return result;
  }
  function calculate(value) {
    const data = validate(value);
    const addedHours = Math.min(data.ongoingHours, data.totalHours - data.completedHours);
    const projectedHours = data.completedHours + addedHours;
    return { ...data, addedHours, projectedHours, currentPercent: data.completedHours / data.totalHours * 100,
      projectedPercent: projectedHours / data.totalHours * 100, remainingHours: data.totalHours - projectedHours };
  }
  const api = { validate, calculate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CourseProgress = api;
})(globalThis);
