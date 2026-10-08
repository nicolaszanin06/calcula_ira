(function (root) {
  'use strict';
  const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  const period = text => /^(\d{4})\.([12])$/.exec(text);
  const ordinal = text => { const match = period(text); return match ? Number(match[1]) * 2 + Number(match[2]) - 1 : null; };
  function lines(items) {
    const groups = [];
    for (const item of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
      let group = groups.find(line => Math.abs(line.y - item.y) < 2);
      if (!group) { group = { y: item.y, items: [] }; groups.push(group); }
      group.items.push(item);
    }
    return groups.map(group => group.items.sort((a, b) => a.x - b.x).map(item => item.text).join(' ')).join('\n');
  }
  function parse(pages) {
    if (!Array.isArray(pages) || pages.length > 50) throw new Error('Use um histórico com até 50 páginas.');
    const text = normalize(pages.map(lines).join('\n'));
    if (!/UnB|Universidade de Brasilia/.test(text)) throw new Error('O arquivo não parece ser um histórico da UnB.');
    const initial = /Ano\s*\/\s*Periodo Letivo Inicial:\s*(\d{4}\.[12])/.exec(text)?.[1];
    if (!initial) throw new Error('Não foi possível identificar o período de ingresso. Use um histórico completo do SIGAA.');
    const official = {};
    for (const key of ['IRA', 'MP']) {
      const match = new RegExp(`${key}:\\s*([0-5][.,]\\d+)`).exec(text);
      if (match) official[key.toLowerCase()] = Number(match[1].replace(',', '.'));
    }
    const warnings = [], rows = [];
    let ignored = 0, candidates = 0;
    const initialProfile = /Perfil Inicial:\s*(\d+)/.exec(text)?.[1];
    if (initialProfile && Number(initialProfile) > 0) warnings.push('O histórico tem perfil inicial diferente de zero. Confira o semestre de cada disciplina.');
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const items = pages[pageIndex].filter(item => item.text.trim());
      const section = items.find(item => normalize(item.text).includes('Componentes Curriculares Cursados/Cursando'));
      if (!section) continue;
      const header = label => items.find(item => normalize(item.text) === label && item.y < section.y && item.y > section.y - 45);
      const ch = header('CH'), turma = header('Turma'), nota = header('Nota'), situation = header('Situacao');
      if (!ch || !turma || !nota || !situation) {
        warnings.push(`Página ${pageIndex + 1}: colunas não reconhecidas; confira se há disciplinas que ficaram de fora.`); continue;
      }
      const end = items.filter(item => item.y < ch.y && /^(Legenda|Carga Horaria|Componentes Curriculares Obrigatorios|Para verificar a autenticidade)/.test(normalize(item.text))).reduce((value, item) => Math.max(value, item.y), 0);
      const table = items.filter(item => item.y < ch.y - 5 && item.y > end + 3);
      const chCenter = ch.x + ch.width / 2, turmaCenter = turma.x + turma.width / 2;
      const notaCenter = nota.x + nota.width / 2, situationCenter = situation.x + situation.width / 2;
      const chLeft = chCenter - (turmaCenter - chCenter) / 2, chRight = (chCenter + turmaCenter) / 2;
      const notaLeft = notaCenter - (situationCenter - notaCenter) / 2, notaRight = (notaCenter + situationCenter) / 2;
      const anchors = table.filter(item => /^\d{4}\.\d$/.test(item.text.trim()) && item.x < ch.x / 4).sort((a, b) => b.y - a.y);
      for (let index = 0; index < anchors.length; index++) {
        const anchor = anchors[index]; candidates++;
        const sameLine = table.filter(item => Math.abs(item.y - anchor.y) < 2);
        const code = sameLine.find(item => /^[A-Z]{2,}\d{3,}$|^ENADE$/.test(item.text.trim()) && item.x > anchor.x + anchor.width && item.x < chLeft);
        const hoursItem = sameLine.find(item => item.x >= chLeft && item.x < chRight && /^\d+$/.test(item.text));
        const codeLabel = code?.text ?? `linha ${index + 1} da página ${pageIndex + 1}`;
        if (!code || !hoursItem) { warnings.push(`${codeLabel}: código ou carga horária não reconhecidos; disciplina não importada.`); continue; }
        const hours = Number(hoursItem.text);
        if (!hours || code.text === 'ENADE') { ignored++; continue; }
        if (hours % 15 || hours > 1500) { warnings.push(`${codeLabel}: carga horária ${hours}h não convertida; disciplina não importada.`); continue; }
        const grade = sameLine.find(item => item.x >= notaLeft && item.x < notaRight)?.text.trim();
        const status = sameLine.find(item => item.x >= notaRight)?.text.trim();
        let mention = grade;
        if (!['SS', 'MS', 'MM', 'MI', 'II', 'SR', 'CC', 'TR', 'TJ'].includes(mention)) {
          mention = ({ MATR: 'CURSANDO', TRANC: 'TR', DISP: 'CC', CUMP: 'CC' })[status];
        }
        if (status === 'CANC') { ignored++; continue; }
        if (!mention) { warnings.push(`${codeLabel}: menção ou situação não reconhecida; disciplina não importada.`); continue; }
        const semester = ordinal(anchor.text.trim()) - ordinal(initial) + 1;
        if (!Number.isInteger(semester) || semester < 1 || semester > 100) {
          warnings.push(`${codeLabel}: período ${anchor.text} não convertido; disciplina não importada.`); continue;
        }
        const top = index ? (anchors[index - 1].y + anchor.y) / 2 : ch.y - 5;
        const bottom = index + 1 < anchors.length ? (anchor.y + anchors[index + 1].y) / 2 : end + 3;
        const nameItems = table.filter(item => item.y < top && item.y > bottom && item.x > code.x + code.width + 1 && item.x < chLeft && item.height >= code.height * .95 && !/^(Dr\.|Dra\.|MSc\.|Prof\.|\(\d+h\))/.test(item.text.trim()));
        const name = nameItems.sort((a, b) => b.y - a.y || a.x - b.x).map(item => item.text.trim()).join(' ').slice(0, 160) || code.text;
        if (!nameItems.length) warnings.push(`${codeLabel}: nome não reconhecido; usando o código da disciplina.`);
        const markers = sameLine.filter(item => item.x > anchor.x + anchor.width && item.x < code.x).map(item => item.text.trim());
        if (markers.some(marker => !['#', '*', '&', '@'].includes(marker))) warnings.push(`${codeLabel}: confira o módulo, pois o símbolo da disciplina não foi reconhecido.`);
        rows.push({ name, credits: hours / 15, semester, mention, module: markers.includes('#') ? 'livre' : 'integrante' });
      }
    }
    if (!rows.length) throw new Error('Nenhuma disciplina foi reconhecida. Use o PDF original do histórico do SIGAA, com texto selecionável.');
    return { rows, initial, official, ignored, candidates, warnings };
  }
  let libraryPromise;
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = src;
      script.onload = resolve; script.onerror = () => { script.remove(); reject(new Error('Não foi possível carregar o leitor de PDF. Confira se a pasta vendor está junto do site.')); };
      document.head.append(script);
    });
  }
  async function read(file) {
    if (file.size > 10 * 1024 * 1024) throw new Error('O PDF deve ter no máximo 10 MB.');
    const data = new Uint8Array(await file.arrayBuffer());
    if (!new TextDecoder().decode(data.slice(0, 1024)).includes('%PDF-')) throw new Error('Selecione um arquivo PDF válido.');
    if (!libraryPromise) libraryPromise = (async () => {
      await loadScript('vendor/pdf.worker.js'); await loadScript('vendor/pdf.js');
    })().catch(error => { libraryPromise = null; throw error; });
    await libraryPromise;
    let task;
    try {
      task = root.pdfjsLib.getDocument({ data, isEvalSupported: false, useSystemFonts: true, verbosity: 0 });
      const pdf = await task.promise;
      if (pdf.numPages > 50) throw new Error('Use um histórico com até 50 páginas.');
      const pages = [];
      for (let index = 1; index <= pdf.numPages; index++) {
        const page = await pdf.getPage(index), content = await page.getTextContent();
        pages.push(content.items.filter(item => item.str?.trim()).map(item => ({ text: item.str, x: item.transform[4], y: item.transform[5], width: item.width, height: item.height })));
      }
      return parse(pages);
    } catch (error) {
      if (error.name === 'PasswordException') throw new Error('O PDF está protegido por senha. Use uma cópia sem senha.');
      if (error.name === 'InvalidPDFException') throw new Error('Não foi possível ler o PDF. O arquivo pode estar danificado.');
      throw error;
    } finally { if (task) await task.destroy(); }
  }
  const api = { parse, read };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HistoryPDF = api;
})(globalThis);
