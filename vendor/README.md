# PDF.js local

Biblioteca [Mozilla PDF.js](https://github.com/mozilla/pdf.js), versão 5.6.205, distribuída sob Apache-2.0. A licença original está em `LICENSE.pdfjs` e os avisos de copyright estão preservados nos scripts.

`pdf.js` e `pdf.worker.js` derivam dos arquivos `build/pdf.min.mjs` e `build/pdf.worker.min.mjs` do pacote `pdfjs-dist`. Para permitir a abertura direta por `file://`, o bloco final de exports ES foi removido, `import.meta.url` substituído pelo endereço do script e cada arquivo envolvido em uma função. Os globais `pdfjsLib` e `pdfjsWorker` são os disponibilizados pela própria biblioteca.

O código do worker é carregado no contexto da página antes do leitor. Assim, PDF.js usa seu modo de processamento local sem precisar carregar módulos ou criar um worker pelo protocolo `file://`. Os scripts só são carregados quando o usuário importa um PDF. O arquivo é aberto a partir de bytes na memória, com avaliação de código desativada; nenhuma requisição envia o histórico a um servidor.

Ao publicar o site, envie esta pasta inteira junto dos demais arquivos. Não é necessário CDN nem instalação de dependências para usar a importação.
