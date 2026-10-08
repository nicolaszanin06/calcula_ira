# Calculadora IRA · UnB

Site estático em português para calcular o IRA e a Média Ponderada (MP), baseado na [Resolução CEG nº 0001/2020](https://deg.unb.br/wp-content/uploads/resolucao_ceg_0001_2020.pdf) fornecida como referência. Ferramenta independente, sem vínculo oficial com a UnB.

## Usar

Abra `index.html` no navegador. Não precisa instalar dependências. Cadastre todas as tentativas de disciplinas com os créditos, a menção e o semestre desde o ingresso (1, 2, 3…). Use o módulo integrante para obrigatórias e optativas; módulo livre fica fora da MP.

O histórico é salvo no armazenamento local do navegador. Use Exportar e Importar para manter uma cópia em JSON. O salvamento depende das configurações do navegador e pode variar quando o site é aberto por `file://`. Para um endereço local, execute `npx --yes http-server .` e abra o endereço exibido.

## Importar o histórico do SIGAA

Clique em **Importar histórico PDF** e selecione o PDF original do SIGAA/UnB. O leitor identifica a tabela de componentes cursados/cursando, usa o período inicial para contar semestres, converte a carga horária em créditos (15h = 1 crédito) e reconhece “#” como módulo livre. A conversão segue a [orientação do Portal SIG da UnB](https://portalsig.unb.br/duvidas-frequentes/).

Uma prévia permite corrigir os dados antes de salvar e compara o IRA e a MP calculados com os índices informados no arquivo. Salvar substitui o histórico atual; cancelar mantém seus dados. Disciplinas em andamento são incluídas com essa indicação e ficam fora dos cálculos até receberem uma menção. Componentes com carga zero, como ENADE, e matrículas canceladas são ignorados. Matérias pendentes fora da tabela de cursados/cursando não são importadas. Linhas não reconhecidas são informadas na prévia, sem atribuir notas por suposição.

O PDF é processado localmente no navegador. Somente os campos das disciplinas são salvos, sem nome do estudante, matrícula, CPF ou cópia do documento. A pasta `vendor` contém o leitor PDF.js com sua licença. A importação funciona tanto ao abrir `index.html` diretamente quanto em hospedagem estática, em navegadores modernos.

Limites: PDF de até 10 MB e 50 páginas, com texto selecionável. Não há OCR para arquivos escaneados. O leitor foi validado no formato de histórico SIGAA fornecido; outros layouts, perfil inicial diferente de zero e períodos especiais exigem revisão. O peso do semestre segue a sequência de períodos desde o ingresso; campos podem ser corrigidos na prévia em situações específicas.

## Integralização do curso

O painel mostra o percentual atual (`CH integralizada / CH total × 100`) e a projeção de aprovação em todas as disciplinas em andamento (`(CH integralizada + CH aproveitável em andamento) / CH total × 100`), limitada a 100%.

Ao importar um PDF, os totais são lidos da tabela **Carga Horária Integralizada/Pendente**. A projeção identifica disciplinas em andamento e limita as horas adicionais ao que falta em cada categoria (obrigatórias, optativas e complementares). Tentativas repetidas do mesmo código e disciplinas já aprovadas não acrescentam horas novamente. A classificação usa os marcadores da tabela: `#`, `*` e `&` como optativas/eletivas; `%` e `§` como complementares; sem esses marcadores como obrigatórias.

A projeção é uma estimativa: equivalências e regras específicas de atividades podem exigir ajustar as horas aproveitáveis. Os três campos são editáveis. Os totais representam a fotografia do histórico importado; mudar menções para simular o IRA não modifica a integralização. Para atualizar a situação oficial, importe um histórico novo ou altere os totais. Quem já importou um PDF antes desta atualização precisa importá-lo novamente para preencher os novos campos.

As cargas horárias são salvas no navegador e incluídas na exportação JSON (formato versão 2). Backups antigos (versão 1) continuam aceitos e deixam o painel em branco para preenchimento.

## Fórmulas do IRA e da MP

- IRA = Σ(E × créditos × min(semestre, 6)) / Σ(créditos × min(semestre, 6)).
- MP = Σ(E × créditos) / Σ(créditos), apenas para disciplinas do módulo integrante.
- SS = 5, MS = 4, MM = 3, MI = 2, II = 1, SR = 0.

Esta implementação considera apenas as seis menções numéricas da resolução. CC, TR, TJ e disciplinas em andamento não entram nos somatórios. Não há fator de penalização por trancamento na fórmula de 2020. Cada tentativa com menção conta separadamente. O resultado é exibido com três casas decimais, sem arredondamento intermediário; compare com o histórico oficial para casos específicos e regras adicionais.

## Publicar no GitHub Pages

1. Crie um repositório no GitHub e envie `index.html`, `styles.css`, `calculator.js`, `progress.js`, `app.js`, `pdf-import.js`, `.nojekyll` e as pastas `vendor` e `assets` para a raiz da branch `main`.
2. No repositório, abra **Settings → Pages**.
3. Em **Build and deployment**, escolha **Deploy from a branch**.
4. Selecione **main** e **/ (root)**; clique em **Save**.
5. Aguarde a publicação e abra o endereço apresentado pelo GitHub.

Não exige backend, chaves de API ou etapa de build. Os caminhos dos arquivos são relativos para funcionar também em subpastas do GitHub Pages. A fonte do Google Fonts é opcional; se indisponível, o site usa fontes do sistema.

## Verificar

Com Node.js instalado: `node calculator.test.js`.

Para o leitor do histórico: `node pdf-import.test.js`. As amostras dos testes são sintéticas e não contêm dados pessoais.

Para integralização: `node progress.test.js`. Os testes verificam os percentuais, a projeção até 100%, as horas restantes e a validação de entradas. O teste do importador também cobre limites por categoria e evita contar novamente tentativas repetidas ou disciplinas já aprovadas.

Os testes cobrem a equivalência das menções, ponderação por créditos e semestre, limite de 6, MP sem módulo livre, SR, exclusões, histórico vazio e entradas inválidas.
