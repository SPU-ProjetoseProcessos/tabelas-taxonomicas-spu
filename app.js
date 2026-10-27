/* Tabelas Taxonômicas da SPU — protótipo de consulta.
   Sem dependências: lê os dados canônicos de ../dados.
   Três telas: home (cards), resultados da busca e tabela (árvore ou mapa + ficha). */
'use strict';

const BASE = 'dados';
/* A versão vem do próprio endereço deste script (app.js?v=…): um lugar só para
   trocar quando se publica, e os dados deixam de vir do cache antigo. */
const VERSAO = (() => {
  try { return new URL(document.currentScript.src).searchParams.get('v') || ''; }
  catch { return ''; }
})();
const comVersao = (caminho) => (VERSAO ? `${caminho}?v=${VERSAO}` : caminho);

const estado = {
  indice: null,
  tabelas: {},            // id -> { meta, registros, porCodigo, filhos, atributos, vocab, cores }
  glossario: null,
  vinculosPorCodigo: {},
  termosPorId: {},
  rotas: {},              // 'tt01' -> id
  atual: null,
  selecionado: null,
  aba: 'arvore',
  escopo: 'todas',
  consulta: '',
  abertos: new Set(),
  abertosMapa: new Set(),
  filtros: {},
  vista: null,
};

const $ = (s) => document.querySelector(s);
const juntar = (...f) => f.flat().filter((x) => x !== null && x !== undefined);
const el = (tag, props = {}, ...filhos) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...juntar(...filhos).map((f) => (typeof f === 'string' ? document.createTextNode(f) : f)));
  return n;
};
const baixarJSON = (caminho) => fetch(comVersao(`${BASE}/${caminho}`)).then((r) => {
  if (!r.ok) throw new Error(`não foi possível ler ${caminho} (${r.status})`);
  return r.json();
});
const semAcento = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const rota = (sigla) => sigla.toLowerCase().replace(/[^a-z0-9]/g, '');
const dataBR = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '')
  ? iso.split('-').reverse().join('/') : iso || '');
/* Tabela ainda não aprovada: vale tanto para a linha do índice quanto para o
   tabela.json, que carregam a mesma chave. */
const ehMinuta = (x) => !!x && x.situacao === 'minuta';
const selo = (texto) => el('span', { className: 'marca-minuta', textContent: texto });

// ------------------------------------------------------------------ cores
function hexParaHsl(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return Math.round(h * 60 + 360) % 360;
}

/* Cada ramo de primeiro nível ganha um tom próprio, girado a partir da cor da
   tabela. É o que dá ao mapa a leitura por galho, como num mapa mental. */
function cores(t) {
  const base = hexParaHsl(t.meta.cor || '#17585e');
  const raizes = (t.filhos[''] || []);
  const mapa = {};
  raizes.forEach((cod, i) => {
    const h = Math.round(base + (i * 360) / Math.max(raizes.length, 1)) % 360;
    mapa[cod] = { forte: `hsl(${h} 44% 34%)`, fraca: `hsl(${h} 48% 94%)`, media: `hsl(${h} 34% 58%)` };
  });
  return mapa;
}
function corDoRamo(cod) {
  const t = tabela();
  const raiz = cod ? cod.split('.').slice(0, 2).join('.') : null;
  return (raiz && t.cores[raiz]) || { forte: t.meta.cor, fraca: 'var(--cor-clara)', media: 'var(--linha-forte)' };
}

// ----------------------------------------------------------- carregamento
async function carregarIndice() {
  estado.indice = await baixarJSON('tabelas.json');
  estado.glossario = await baixarJSON('glossario/glossario.json').catch(() => ({ termos: [], vinculos: [] }));
  for (const t of estado.glossario.termos) estado.termosPorId[t.id] = t;
  for (const v of estado.glossario.vinculos) {
    (estado.vinculosPorCodigo[v.codigo] = estado.vinculosPorCodigo[v.codigo] || []).push(v);
  }
  for (const t of estado.indice.tabelas) estado.rotas[rota(t.sigla)] = t.id;
}

async function carregarTabela(id) {
  if (estado.tabelas[id]) return estado.tabelas[id];
  const info = estado.indice.tabelas.find((t) => t.id === id);
  const [meta, registros] = await Promise.all([
    baixarJSON(`${info.caminho}/tabela.json`),
    baixarJSON(`${info.caminho}/registros.json`),
  ]);
  const t = { meta, registros, porCodigo: {}, filhos: {}, atributos: null, vocab: null };
  for (const r of registros) {
    t.porCodigo[r.codigo] = r;
    (t.filhos[r.pai] = t.filhos[r.pai] || []).push(r.codigo);
  }
  if (info.tem_atributos) {
    const [at, voc] = await Promise.all([
      baixarJSON(`${info.caminho}/atributos.json`),
      baixarJSON(`${info.caminho}/vocabulario-atributos.json`),
    ]);
    t.atributos = {};
    for (const a of at) t.atributos[a.codigo] = a;
    t.vocab = voc;
  }
  t.cores = cores(t);
  estado.tabelas[id] = t;
  return t;
}

const tabela = () => estado.tabelas[estado.atual];
const folhas = (t = tabela()) => t.registros.filter((r) => !(t.filhos[r.codigo] || []).length);
const temFilhos = (cod) => (tabela().filhos[cod] || []).length > 0;

// ------------------------------------------------------------------ telas
function mostrarTela(qual) {
  $('#home').hidden = qual !== 'home';
  $('#secaoResultados').hidden = qual !== 'resultados';
  $('#secaoTabela').hidden = qual !== 'tabela';
  document.body.classList.toggle('aba-mapa', qual === 'tabela' && estado.aba === 'mapa');
}

function iconeInicio() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', 'M3 11.2 12 4l9 7.2V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z');
  p.setAttribute('fill', 'none');
  p.setAttribute('stroke', 'currentColor');
  p.setAttribute('stroke-width', '1.9');
  p.setAttribute('stroke-linejoin', 'round');
  svg.append(p);
  return svg;
}

function desenharTrilha() {
  const nav = $('#trilha');
  nav.textContent = '';
  const inicio = el('button', { type: 'button' }, iconeInicio(), 'Início');
  inicio.addEventListener('click', () => irParaHome());
  nav.append(inicio);
  if (estado.atual && !$('#secaoTabela').hidden) {
    const t = tabela();
    nav.append(el('span', { className: 'sep', textContent: '›' }),
               el('span', { className: 'atual', textContent: `${t.meta.sigla} — ${t.meta.titulo}` }));
  } else if (!$('#secaoResultados').hidden) {
    nav.append(el('span', { className: 'sep', textContent: '›' }),
               el('span', { className: 'atual', textContent: 'Resultados da pesquisa' }));
  }
}

/* O título da página muda conforme a tela; a busca fica logo abaixo dele. */
function cabecaPagina({ sigla = '', titulo, dominio = '' }) {
  const elSigla = $('#siglaTabela'), elDominio = $('#dominioTabela');
  elSigla.textContent = sigla;
  elSigla.hidden = !sigla;
  $('#tituloPagina').textContent = titulo;
  elDominio.textContent = dominio;
  elDominio.hidden = !dominio;
}

/* A tarja fica na tela da tabela, acima de tudo, e some quando a tabela é
   aprovada — o texto do aviso vem do dado, não daqui. */
function desenharTarja() {
  const caixa = $('#tarjaMinuta');
  const m = estado.atual ? tabela().meta : null;
  caixa.textContent = '';
  caixa.hidden = !ehMinuta(m);
  if (caixa.hidden) return;
  caixa.append(
    el('b', { textContent: 'Versão preliminar' }),
    el('p', { textContent: m.aviso }));
}

function desenharHome() {
  const caixa = $('#cards');
  caixa.textContent = '';
  for (const t of estado.indice.tabelas) {
    const card = el('button', { className: ehMinuta(t) ? 'card minuta' : 'card', type: 'button' });
    card.style.setProperty('--cor-card', t.cor || '#17585e');
    card.append(...juntar(
      ehMinuta(t) ? el('span', { className: 'selo-minuta', textContent: 'Minuta' }) : null,
      el('span', { className: 'sigla', textContent: t.sigla }),
      el('h2', { textContent: t.titulo }),
      el('p', { className: 'dominio', textContent: t.dominio || '' }),
      el('div', { className: 'numeros' },
        el('div', {}, el('b', { textContent: String(t.totais.registros) }), el('span', { textContent: 'registros' })),
        el('div', {}, el('b', { textContent: String(t.profundidade) }), el('span', { textContent: 'níveis' }))),
      el('p', { className: 'norma', textContent: t.norma_vigente }),
    ));
    card.addEventListener('click', () => irPara(t.id));
    caixa.append(card);
  }
  const atalho = $('#atalhoTabela');
  atalho.textContent = '';
  atalho.append(el('option', { value: '', textContent: 'escolher uma tabela…' }));
  for (const t of estado.indice.tabelas) {
    atalho.append(el('option', { value: t.id,
      textContent: `${t.sigla} — ${t.titulo}${ehMinuta(t) ? ' (minuta)' : ''}` }));
  }
  atalho.value = '';
  atalho.onchange = () => { if (atalho.value) irPara(atalho.value); };

  const g = estado.indice.glossario;
  const minutas = estado.indice.tabelas.filter(ehMinuta).length;
  const vigentes = estado.indice.tabelas.length - minutas;
  $('#resumoAcervo').textContent =
    `${vigentes} tabela${vigentes > 1 ? 's' : ''} aprovada${vigentes > 1 ? 's' : ''}`
    + (minutas ? ` e ${minutas} minuta${minutas > 1 ? 's' : ''} em elaboração` : '')
    + ` · ${g.termos} termos no glossário do MemóriaSPU, ${g.vinculos} deles ligados a um código.`;
}

// ---------------------------------------------------------------- filtros
function folhasVisiveis() {
  const t = tabela();
  const ativos = Object.entries(estado.filtros).filter(([, v]) => v.size);
  const todas = folhas(t).map((r) => r.codigo);
  if (!ativos.length || !t.atributos) return new Set(todas);
  return new Set(todas.filter((cod) => {
    const a = t.atributos[cod];
    return a && ativos.every(([campo, escolhidos]) => (a[campo] || []).some((v) => escolhidos.has(v)));
  }));
}

function codigosVisiveis() {
  const t = tabela();
  const vis = folhasVisiveis();
  const conj = new Set(vis);
  for (const cod of vis) {
    let p = t.porCodigo[cod] && t.porCodigo[cod].pai;
    while (p) { conj.add(p); p = t.porCodigo[p].pai; }
  }
  return conj;
}

const temFiltro = () => Object.values(estado.filtros).some((v) => v.size);

function contarFaceta(campo, valor) {
  const t = tabela();
  const outros = Object.entries(estado.filtros).filter(([c, v]) => c !== campo && v.size);
  return folhas(t).filter((r) => {
    const a = t.atributos[r.codigo] || {};
    return (a[campo] || []).includes(valor)
      && outros.every(([c, esc]) => (a[c] || []).some((x) => esc.has(x)));
  }).length;
}

function desenharFiltros() {
  const t = tabela();
  const botao = $('#botaoFiltros');
  const caixa = $('#filtros');
  if (!t.vocab) { botao.hidden = true; caixa.hidden = true; return; }
  botao.hidden = false;
  caixa.textContent = '';
  for (const [campo, regra] of Object.entries(t.vocab)) {
    const valores = el('div', { className: 'valores' });
    for (const v of regra.valores) {
      const entrada = el('input', { type: 'checkbox',
        checked: !!(estado.filtros[campo] && estado.filtros[campo].has(v)) });
      entrada.addEventListener('change', () => {
        estado.filtros[campo] = estado.filtros[campo] || new Set();
        if (entrada.checked) estado.filtros[campo].add(v); else estado.filtros[campo].delete(v);
        estado.vista = null;
        desenharArvore(); desenharFiltros(); atualizarContagem();
        if (estado.aba === 'mapa') desenharMapa();
      });
      valores.append(el('label', {}, entrada, v, el('span', { className: 'qtd', textContent: contarFaceta(campo, v) })));
    }
    caixa.append(el('div', { className: 'faceta' }, el('b', { textContent: regra.rotulo }), valores));
  }
  const limpar = el('button', { className: 'botao', type: 'button', textContent: 'Limpar filtros' });
  limpar.addEventListener('click', () => {
    estado.filtros = {}; estado.vista = null;
    desenharArvore(); desenharFiltros(); atualizarContagem();
    if (estado.aba === 'mapa') desenharMapa();
  });
  const rotulo = t.meta.rotulo_folha || 'itens';
  caixa.append(el('div', { className: 'rodape-filtros' },
    el('span', { className: 'contagem', textContent:
      `${folhasVisiveis().size} de ${folhas(t).length} ${rotulo} atendem aos filtros` }),
    temFiltro() ? limpar : null));
}

function atualizarContagem() {
  const t = tabela();
  const n = codigosVisiveis().size;
  $('#contagem').textContent = temFiltro()
    ? `${n} de ${t.meta.totais.registros} registros`
    : `${t.meta.totais.registros} registros · ${t.meta.profundidade} níveis`;
  $('#botaoFiltros').textContent = temFiltro() ? 'Filtros ativos' : 'Filtros';
}

// ----------------------------------------------------------------- árvore
function linhaNo(cod, visiveis) {
  const t = tabela();
  const r = t.porCodigo[cod];
  const kids = (t.filhos[cod] || []).filter((c) => visiveis.has(c));
  const aberto = estado.abertos.has(cod);
  const botao = el('button', { className: 'no', type: 'button', id: `no-${cod}`,
    role: 'treeitem', tabIndex: cod === estado.selecionado ? 0 : -1 });
  botao.setAttribute('aria-selected', String(cod === estado.selecionado));
  if (kids.length) botao.setAttribute('aria-expanded', String(aberto));
  botao.dataset.codigo = cod;
  botao.append(...juntar(
    el('span', { className: 'seta', 'aria-hidden': 'true', textContent: kids.length ? (aberto ? '▼' : '▶') : '·' }),
    el('span', { className: 'cod', textContent: cod }),
    el('span', { className: 'rotulo-no', textContent: r.descricao }),
    r.situacao !== 'vigente' ? el('span', { className: 'selo-restrito', textContent: 'uso restrito' }) : null,
  ));
  botao.addEventListener('click', (ev) => {
    if (kids.length && ev.offsetX < 22) { alternar(cod); return; }
    if (kids.length) estado.abertos.add(cod);
    selecionar(cod, { abrir: true });
  });
  const li = el('li', {}, botao);
  if (r.nivel === 1) li.style.setProperty('--cor-ramo', corDoRamo(cod).media);
  if (kids.length && aberto) li.append(el('ul', { role: 'group' }, kids.map((c) => linhaNo(c, visiveis))));
  return li;
}

function alternar(cod) {
  if (estado.abertos.has(cod)) estado.abertos.delete(cod); else estado.abertos.add(cod);
  desenharArvore();
}

function abrirAncestrais(cod) {
  const t = tabela();
  let p = t.porCodigo[cod] && t.porCodigo[cod].pai;
  while (p) { estado.abertos.add(p); estado.abertosMapa.add(p); p = t.porCodigo[p].pai; }
  estado.abertosMapa.add('');
}

function desenharArvore() {
  const t = tabela();
  const visiveis = codigosVisiveis();
  if (temFiltro()) for (const cod of visiveis) if (temFilhos(cod)) estado.abertos.add(cod);
  const raizes = (t.filhos[''] || []).filter((c) => visiveis.has(c));
  const ul = $('#arvore');
  ul.textContent = '';
  ul.append(...(raizes.length
    ? raizes.map((c) => linhaNo(c, visiveis))
    : [el('li', {}, el('p', { className: 'vazio', textContent: 'Nenhum registro atende aos filtros.' }))]));
}

$('#arvore').addEventListener('keydown', (ev) => {
  const itens = [...document.querySelectorAll('#arvore .no')];
  const i = itens.indexOf(document.activeElement);
  if (i < 0) return;
  const cod = itens[i].dataset.codigo;
  const aberto = estado.abertos.has(cod);
  const foca = (j) => itens[j] && itens[j].focus();
  const refocar = () => setTimeout(() => { const n = document.getElementById(`no-${cod}`); if (n) n.focus(); }, 0);
  switch (ev.key) {
    case 'ArrowDown': ev.preventDefault(); foca(i + 1); break;
    case 'ArrowUp': ev.preventDefault(); foca(i - 1); break;
    case 'ArrowRight': ev.preventDefault();
      if (temFilhos(cod) && !aberto) { alternar(cod); refocar(); } else foca(i + 1); break;
    case 'ArrowLeft': {
      ev.preventDefault();
      if (temFilhos(cod) && aberto) { alternar(cod); refocar(); break; }
      const pai = tabela().porCodigo[cod].pai;
      if (pai) { const alvo = document.getElementById(`no-${pai}`); if (alvo) alvo.focus(); }
      break;
    }
    case 'Home': ev.preventDefault(); foca(0); break;
    case 'End': ev.preventDefault(); foca(itens.length - 1); break;
    case 'Enter': case ' ': ev.preventDefault(); selecionar(cod, { abrir: true }); break;
  }
});

// ------------------------------------------------------------------ ficha
function campo(rotulo, conteudo) {
  return conteudo ? el('div', { className: 'campo' }, el('b', { textContent: rotulo }), conteudo) : null;
}
const listaUl = (itens) => el('ul', {}, itens.map((x) => el('li', { textContent: x })));

function trilhaFicha(cod) {
  const t = tabela();
  const partes = [];
  for (let c = cod; c; c = t.porCodigo[c].pai) partes.unshift(c);
  const p = el('p', { className: 'trilha-ficha' });
  partes.slice(0, -1).forEach((x, i) => {
    if (i) p.append(' › ');
    const b = el('button', { type: 'button', textContent: t.porCodigo[x].descricao });
    b.addEventListener('click', () => selecionar(x, { abrir: true }));
    p.append(b);
  });
  return partes.length > 1 ? p : null;
}

function blocoAtributos(cod) {
  const t = tabela();
  if (!t.atributos || !t.atributos[cod]) return null;
  const a = t.atributos[cod];
  return campo('Atributos (Anexo II da norma)', el('div', { className: 'grade-atrib' },
    Object.entries(t.vocab).map(([k, regra]) => el('div', { className: 'atrib' },
      el('span', { textContent: regra.rotulo }),
      el('strong', { textContent: (a[k] || []).join(' / ') || '— não informado na norma' })))));
}

function blocoGlossario(cod) {
  const vincs = estado.vinculosPorCodigo[cod] || [];
  if (!vincs.length) return null;
  return campo('No glossário da SPU', el('div', {}, vincs.map((v) => {
    const termo = estado.termosPorId[v.termo_id] || {};
    return el('p', { style: 'margin:0 0 8px' },
      el('a', { className: 'link-termo', href: termo.url_memoriaspu || '#',
                target: '_blank', rel: 'noopener', textContent: v.termo }),
      // vínculo conferido não precisa de selo; só a divergência merece aviso
      v.situacao === 'validado' ? null
        : [' ', el('span', { className: 'chip aviso', textContent: 'verificar vínculo' })],
      v.observacao ? el('span', { className: 'vazio', style: 'display:block;font-size:13px',
                                  textContent: v.observacao }) : null);
  })));
}

function blocoFilhos(cod) {
  const t = tabela();
  const kids = t.filhos[cod] || [];
  if (!kids.length) return null;
  return campo(`Subdivisões (${kids.length})`, el('ul', {}, kids.map((c) => {
    const b = el('button', { type: 'button',
      style: 'background:none;border:0;padding:0;color:var(--cor);cursor:pointer;text-align:left',
      textContent: `${c} — ${t.porCodigo[c].descricao}` });
    b.addEventListener('click', () => selecionar(c, { abrir: true }));
    return el('li', {}, b);
  })));
}

/* O que a ficha mostra é o que vai para a área de transferência — menos o
   glossário, que é link para outro acervo. */
function textoDaFicha(cod) {
  const t = tabela();
  const r = t.porCodigo[cod];
  const m = t.meta;
  const linhas = [`${m.sigla} — ${m.titulo}`];
  /* O aviso vai junto do texto copiado: fora da página, é só ele que avisa
     que o item colado não é norma. */
  if (ehMinuta(m)) linhas.push('[VERSÃO PRELIMINAR — tabela ainda não aprovada pelo ComGC]');
  linhas.push('', `${r.codigo} — ${r.descricao}`, r.definicao);
  if (r.observacao) linhas.push('', `Observação: ${r.observacao}`);
  if (r.nota_de_aplicacao) linhas.push('', `Nota de aplicação: ${r.nota_de_aplicacao}`);
  if (r.fundamento_legal.length) linhas.push('', `Fundamentação legal (União): ${r.fundamento_legal.join('; ')}`);
  if (r.instrumento.length) linhas.push(`Instrumento: ${r.instrumento.join('; ')}`);
  if (r.exemplos.length) linhas.push(`Exemplos: ${r.exemplos.join('; ')}`);
  const a = t.atributos && t.atributos[cod];
  if (a) {
    const valores = Object.entries(t.vocab)
      .filter(([k]) => (a[k] || []).length)
      .map(([k, regra]) => `${regra.rotulo}: ${a[k].join(' / ')}`);
    if (valores.length) linhas.push('', `Atributos: ${valores.join(' · ')}`);
  }
  const kids = t.filhos[cod] || [];
  if (kids.length) {
    linhas.push('', `Subdivisões (${kids.length}):`);
    for (const c of kids) {
      linhas.push(`  ${c} — ${t.porCodigo[c].descricao}`, `    ${t.porCodigo[c].definicao}`);
    }
  }
  const n = m.norma_vigente;
  if (n) {
    linhas.push('', `Fonte: ${n.ato} (documento SEI ${n.sei_documento}, processo ${n.processo_sei}).`);
  } else {
    const o = m.origem || {};
    linhas.push('', `Fonte: ${o.documento}, versão de ${dataBR(o.versao)}.`,
                'Minuta sem resolução do ComGC — não use como referência normativa.');
  }
  return linhas.join('\n');
}

function botaoCopiar(rotulo, texto) {
  const b = el('button', { className: 'botao', type: 'button', textContent: rotulo });
  b.addEventListener('click', () => navigator.clipboard.writeText(texto).then(
    () => { b.textContent = 'copiado'; setTimeout(() => { b.textContent = rotulo; }, 1400); },
    () => { b.textContent = 'não foi possível copiar'; }));
  return b;
}

function mostrarFicha(cod) {
  const t = tabela();
  const r = t.porCodigo[cod];
  const caixa = $('#ficha');
  caixa.textContent = '';
  const corpo = el('div', { className: 'corpo' });
  const nivel = t.meta.rotulos_nivel[r.nivel - 1] || `Nível ${r.nivel}`;
  corpo.append(...juntar(
    el('div', { className: 'chips' },
      el('span', { className: 'chip cor', textContent: nivel }),
      ehMinuta(t.meta) ? el('span', { className: 'chip minuta', textContent: 'minuta' }) : null,
      !temFilhos(cod) ? el('span', { className: 'chip', textContent: 'folha' }) : null,
      r.situacao !== 'vigente' ? el('span', { className: 'chip aviso', textContent: r.situacao.replace(/_/g, ' ') }) : null),
    el('span', { className: 'codigo-grande', textContent: r.codigo }),
    el('h2', { textContent: r.descricao }),
    trilhaFicha(cod),
    campo('Definição', el('p', { textContent: r.definicao })),
    r.observacao ? campo('Observação', el('p', { textContent: r.observacao })) : null,
    r.nota_de_aplicacao ? campo('Nota de aplicação',
      el('div', { className: 'nota', textContent: r.nota_de_aplicacao })) : null,
    r.fundamento_legal.length ? campo('Fundamentação legal (União)', listaUl(r.fundamento_legal)) : null,
    r.instrumento.length ? campo('Instrumento', listaUl(r.instrumento)) : null,
    r.exemplos.length ? campo('Exemplos', listaUl(r.exemplos)) : null,
    blocoAtributos(cod),
    blocoFilhos(cod),
    blocoGlossario(cod),
    blocoOrigem(),
    el('div', { className: 'acoes' }, botaoCopiar('Copiar', textoDaFicha(cod))),
  ));
  caixa.append(corpo);
}

/* Numa tabela aprovada, a origem é a resolução, com o PDF; numa minuta, é o
   documento de trabalho — e aí não há ato para citar. */
function blocoOrigem() {
  const m = tabela().meta;
  const n = m.norma_vigente;
  if (!n) {
    const o = m.origem || {};
    return campo('Origem', el('div', {},
      el('p', { textContent: o.documento || 'Documento de trabalho' }),
      el('p', { className: 'vazio', style: 'font-size:13px', textContent:
        `Versão de ${dataBR(o.versao)} · sem resolução do ComGC` }),
      o.nota ? el('p', { className: 'vazio', style: 'font-size:13px', textContent: o.nota }) : null));
  }
  return campo('Norma de origem', el('div', {},
    el('p', { textContent: n.ato }),
    el('p', { className: 'vazio', style: 'font-size:13px', textContent:
      `Publicada em ${dataBR(n.publicacao)} · documento SEI ${n.sei_documento}`
      + ` · processo ${n.processo_sei}` }),
    n.pdf
      ? el('p', { style: 'margin:8px 0 0' },
          el('a', { className: 'link-termo', href: `${BASE}/${n.pdf}`,
                    target: '_blank', rel: 'noopener', textContent: 'Abrir a resolução em PDF' }))
      : null));
}

function fichaVazia() {
  const t = tabela();
  $('#ficha').textContent = '';
  $('#ficha').append(el('div', { className: 'corpo' },
    el('p', { className: 'vazio', textContent:
      `Escolha um item na árvore ou no mapa para ver a ficha: definição, observação, fundamentação legal, `
      + `instrumento${t.vocab ? ', atributos' : ', exemplos'}, termos do glossário e norma de origem.` })));
}

// -------------------------------------------------------------- exportação
function exportar() {
  const t = tabela();
  const vis = codigosVisiveis();
  const regs = t.registros.filter((r) => vis.has(r.codigo));
  const cols = ['codigo', 'nivel', 'pai', 'descricao', 'definicao', 'observacao',
                'fundamento_legal', 'instrumento', 'exemplos', 'situacao', 'nota_de_aplicacao'];
  const cel = (v) => {
    const texto = Array.isArray(v) ? v.join(' | ') : String(v ?? '');
    return /[",\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  const conteudo = [cols.join(','), ...regs.map((r) => cols.map((c) => cel(r[c])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }));
  /* O CSV sai do site sem a tarja: o nome do arquivo é o que sobra para avisar
     que aquilo é minuta. */
  const nome = `${rota(t.meta.sigla)}${ehMinuta(t.meta) ? '-minuta' : ''}-${regs.length}-registros.csv`;
  const a = el('a', { href: url, download: nome });
  document.body.append(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
$('#baixarCSV').addEventListener('click', () => exportar());

// -------------------------------------------------------------------- mapa
/* Mapa em dois lados: o nó central é a tabela, metade dos ramos de primeiro nível
   vai para a direita e metade para a esquerda. O nome do item aparece inteiro,
   quebrado em linhas, e um "+" no canto abre ou fecha o galho. */
const SVGNS = 'http://www.w3.org/2000/svg';
const LARG = 230, HGAP = 54, VGAP = 12, PAD = 12, LINHA_ALT = 16, TOPO = 30;
const svgEl = (tag, attrs = {}) => {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

const medidor = document.createElement('canvas').getContext('2d');
function quebrar(texto, largura) {
  medidor.font = '12.5px Inter, sans-serif';
  const linhas = [];
  let atual = '';
  for (const palavra of texto.split(' ')) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (medidor.measureText(tentativa).width <= largura || !atual) atual = tentativa;
    else { linhas.push(atual); atual = palavra; }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

const alturaNo = (linhas) => TOPO + linhas.length * LINHA_ALT + PAD - 4;
const xDoNo = (prof, lado) => (prof === 0
  ? -LARG / 2
  : (lado > 0 ? LARG / 2 + HGAP + (prof - 1) * (LARG + HGAP)
              : -(LARG / 2 + HGAP + (prof - 1) * (LARG + HGAP) + LARG)));

function nosDoMapa() {
  const t = tabela();
  const visiveis = codigosVisiveis();
  const raizes = (t.filhos[''] || []).filter((c) => visiveis.has(c));
  const metade = Math.ceil(raizes.length / 2);
  const lados = {};
  raizes.forEach((c, i) => { lados[c] = i < metade ? 1 : -1; });

  const nos = [];
  const cursor = { 1: 0, '-1': 0 };
  const medir = (cod, prof, lado) => {
    const kids = (t.filhos[cod] || []).filter((c) => visiveis.has(c));
    const aberto = cod === '' || estado.abertosMapa.has(cod);
    const texto = cod === '' ? t.meta.titulo : t.porCodigo[cod].descricao;
    const linhas = quebrar(texto, LARG - PAD * 2 - (kids.length ? 16 : 0));
    const no = { codigo: cod, prof, lado, linhas, altura: alturaNo(linhas),
      detalhe: cod === '' ? t.meta.sigla : cod, temFilhos: kids.length > 0, aberto, y: 0 };
    nos.push(no);
    if (aberto && kids.length) {
      const ys = kids.map((c) => medir(c, prof + 1, prof === 0 ? lados[c] : lado));
      no.y = (Math.min(...ys) + Math.max(...ys.map((v, i) => v + 0)) ) / 2;
      const filhos = nos.filter((n) => kids.includes(n.codigo));
      const topo = Math.min(...filhos.map((n) => n.y));
      const base = Math.max(...filhos.map((n) => n.y + n.altura));
      no.y = (topo + base) / 2 - no.altura / 2;
    } else {
      const c = cursor[lado] || 0;
      no.y = c;
      cursor[lado] = c + no.altura + VGAP;
    }
    return no.y;
  };
  // o nó central fica entre os dois lados
  const raiz = { codigo: '', prof: 0, lado: 1, detalhe: tabela().meta.sigla,
                 linhas: quebrar(tabela().meta.titulo, LARG - PAD * 2 - 16),
                 temFilhos: raizes.length > 0, aberto: estado.abertosMapa.has(''), y: 0 };
  raiz.altura = alturaNo(raiz.linhas);
  nos.push(raiz);
  if (raiz.aberto) {
    for (const c of raizes) medir(c, 1, lados[c]);
    const primeiros = nos.filter((n) => n.prof === 1);
    const topo = Math.min(...primeiros.map((n) => n.y));
    const base = Math.max(...primeiros.map((n) => n.y + n.altura));
    raiz.y = (topo + base) / 2 - raiz.altura / 2;
  }
  return nos;
}

function aplicarVista() {
  const v = estado.vista;
  $('#mapa').setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
}

function limitesMapa(nos) {
  const xs = nos.map((n) => xDoNo(n.prof, n.lado));
  return { x0: Math.min(...xs), x1: Math.max(...xs) + LARG,
           y0: Math.min(...nos.map((n) => n.y)), y1: Math.max(...nos.map((n) => n.y + n.altura)) };
}

function enquadrarNo(no) {
  const v = estado.vista;
  estado.vista = { ...v, x: xDoNo(no.prof, no.lado) + LARG / 2 - v.w / 2,
                   y: no.y + no.altura / 2 - v.h / 2 };
  aplicarVista();
}

function centralizarMapa(nos, { forcar = false } = {}) {
  const svg = $('#mapa');
  const lista = nos || nosDoMapa();
  const lim = limitesMapa(lista);
  const m = 30;
  const largura = svg.clientWidth || 900, altura = svg.clientHeight || 600;
  const escala = Math.min(largura / (lim.x1 - lim.x0 + m * 2), altura / (lim.y1 - lim.y0 + m * 2));
  // ao abrir o mapa só enquadra tudo se continuar legível; no botão, enquadra sempre
  if (forcar || escala >= 0.68) {
    estado.vista = { x: lim.x0 - m, y: lim.y0 - m,
                     w: lim.x1 - lim.x0 + m * 2, h: lim.y1 - lim.y0 + m * 2 };
    aplicarVista();
    return;
  }
  estado.vista = { x: 0, y: 0, w: largura, h: altura };
  enquadrarNo(lista.find((n) => n.codigo === estado.selecionado) || lista[0]);
}

function desenharMapa() {
  const svg = $('#mapa');
  svg.textContent = '';
  const t = tabela();
  const nos = nosDoMapa();
  const porCodigo = Object.fromEntries(nos.map((n) => [n.codigo, n]));
  const ligacoes = svgEl('g'), grupos = svgEl('g');

  for (const n of nos) {
    const x = xDoNo(n.prof, n.lado);
    const cor = n.codigo === ''
      ? { forte: t.meta.cor, fraca: '#fff', media: t.meta.cor }
      : corDoRamo(n.codigo);
    const chapado = n.prof <= 1;
    const selecionado = n.codigo === estado.selecionado;

    if (n.prof > 0) {
      const pai = porCodigo[t.porCodigo[n.codigo].pai || ''];
      const xPai = xDoNo(pai.prof, pai.lado);
      const x1 = n.lado > 0 ? xPai + LARG : xPai;
      const x2 = n.lado > 0 ? x : x + LARG;
      const y1 = pai.y + pai.altura / 2, y2 = n.y + n.altura / 2, mx = (x1 + x2) / 2;
      ligacoes.append(svgEl('path', { class: 'lig', stroke: cor.media,
        'stroke-width': n.prof === 1 ? 2.4 : 1.5,
        d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}` }));
    }

    const g = svgEl('g', { class: `no-mapa${chapado ? ' chapado' : ''}${selecionado ? ' sel' : ''}`,
      transform: `translate(${x},${n.y})`, tabindex: '0', role: 'button' });
    g.append(svgEl('rect', { width: LARG, height: n.altura,
      fill: chapado ? cor.forte : (selecionado ? cor.fraca : '#fff'),
      stroke: chapado ? cor.forte : cor.media,
      'stroke-width': selecionado ? 2.5 : 1.5 }));

    const fim = n.lado > 0 ? null : 'end';
    const xTexto = n.lado > 0 ? PAD : LARG - PAD;
    const txtCod = svgEl('text', { x: xTexto, y: 18, class: 'cod-mapa' });
    if (fim) txtCod.setAttribute('text-anchor', fim);
    if (!chapado) txtCod.style.fill = cor.forte;
    txtCod.textContent = n.detalhe;
    g.append(txtCod);
    n.linhas.forEach((linha, i) => {
      const txt = svgEl('text', { x: xTexto, y: TOPO + 6 + i * LINHA_ALT });
      if (fim) txt.setAttribute('text-anchor', fim);
      txt.textContent = linha;
      g.append(txt);
    });

    if (n.temFilhos) {
      const bx = n.lado > 0 ? LARG : 0;
      const badge = svgEl('g', { class: 'abridor', tabindex: '0', role: 'button',
        transform: `translate(${bx},${n.altura / 2})` });
      badge.append(svgEl('circle', { r: 9, fill: '#fff', stroke: cor.media, 'stroke-width': 1.5 }));
      const sinal = svgEl('text', { x: 0, y: 3.5, 'text-anchor': 'middle', class: 'sinal' });
      sinal.style.fill = cor.forte;
      sinal.textContent = n.aberto ? '–' : '+';
      badge.append(sinal);
      const rotulo = svgEl('title');
      rotulo.textContent = n.aberto ? 'Fechar o galho' : 'Abrir o galho';
      badge.append(rotulo);
      const alternarGalho = (ev) => {
        ev.stopPropagation();
        if (estado.abertosMapa.has(n.codigo)) estado.abertosMapa.delete(n.codigo);
        else estado.abertosMapa.add(n.codigo);
        desenharMapa();
        const novo = nosDoMapa().find((x2) => x2.codigo === n.codigo);
        if (novo) enquadrarNo(novo);
      };
      badge.addEventListener('click', alternarGalho);
      badge.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); alternarGalho(ev); }
      });
      g.append(badge);
    }

    const escolher = () => { if (n.codigo) selecionar(n.codigo, { abrir: false, mapa: true }); };
    g.addEventListener('click', escolher);
    g.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); escolher(); }
    });
    grupos.append(g);
  }
  svg.append(ligacoes, grupos);
  if (!estado.vista) centralizarMapa(nos); else aplicarVista();
}

(function interacaoMapa() {
  const svg = $('#mapa');
  let arrasto = null;
  svg.addEventListener('pointerdown', (ev) => {
    if (ev.target.closest('.no-mapa')) return;
    arrasto = { x: ev.clientX, y: ev.clientY, vista: { ...estado.vista } };
    svg.classList.add('arrastando');
    svg.setPointerCapture(ev.pointerId);
  });
  svg.addEventListener('pointermove', (ev) => {
    if (!arrasto) return;
    const k = estado.vista.w / svg.clientWidth;
    estado.vista.x = arrasto.vista.x - (ev.clientX - arrasto.x) * k;
    estado.vista.y = arrasto.vista.y - (ev.clientY - arrasto.y) * k;
    aplicarVista();
  });
  const soltar = () => { arrasto = null; svg.classList.remove('arrastando'); };
  svg.addEventListener('pointerup', soltar);
  svg.addEventListener('pointercancel', soltar);
  svg.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const f = ev.deltaY > 0 ? 1.12 : 1 / 1.12;
    const r = svg.getBoundingClientRect();
    const px = (ev.clientX - r.left) / r.width, py = (ev.clientY - r.top) / r.height;
    const v = estado.vista;
    estado.vista = { x: v.x + v.w * px * (1 - f), y: v.y + v.h * py * (1 - f), w: v.w * f, h: v.h * f };
    aplicarVista();
  }, { passive: false });
})();

$('#centralizar').addEventListener('click', () => centralizarMapa(null, { forcar: true }));
$('#expandirTudo').addEventListener('click', () => {
  estado.abertosMapa = new Set(['', ...tabela().registros.map((r) => r.codigo)]);
  estado.vista = null; desenharMapa();
});
$('#recolherTudo').addEventListener('click', () => {
  estado.abertosMapa = new Set(['']); estado.vista = null; desenharMapa();
});

// --------------------------------------------------------------------- abas
function trocarAba(qual) {
  estado.aba = qual;
  $('#abaArvore').setAttribute('aria-selected', String(qual === 'arvore'));
  $('#abaMapa').setAttribute('aria-selected', String(qual === 'mapa'));
  $('#caixaArvore').hidden = qual !== 'arvore';
  $('#caixaMapa').hidden = qual !== 'mapa';
  document.body.classList.toggle('aba-mapa', qual === 'mapa');
  if (qual === 'mapa') { estado.vista = null; desenharMapa(); }
}
$('#abaArvore').addEventListener('click', () => trocarAba('arvore'));
$('#abaMapa').addEventListener('click', () => trocarAba('mapa'));
$('#botaoFiltros').addEventListener('click', () => {
  const aberto = $('#botaoFiltros').getAttribute('aria-expanded') === 'true';
  $('#botaoFiltros').setAttribute('aria-expanded', String(!aberto));
  $('#filtros').hidden = aberto;
});

// ------------------------------------------------------------------ busca
const CAMPOS_BUSCA = [
  ['codigo', 'código'], ['descricao', 'descrição'], ['definicao', 'definição'],
  ['observacao', 'observação'], ['fundamento_legal', 'fundamentação legal'],
  ['instrumento', 'instrumento'], ['exemplos', 'exemplos'],
];

function trecho(texto, alvo) {
  const i = semAcento(texto).indexOf(alvo);
  if (i < 0) return el('span', { textContent: texto.slice(0, 120) });
  const ini = Math.max(0, i - 45);
  return el('span', {}, (ini ? '…' : '') + texto.slice(ini, i),
    el('mark', { textContent: texto.slice(i, i + alvo.length) }),
    `${texto.slice(i + alvo.length, i + alvo.length + 85)}…`);
}

async function achados(alvo) {
  await Promise.all(estado.indice.tabelas.map((t) => carregarTabela(t.id)));
  const lista = [];
  for (const info of estado.indice.tabelas) {
    const t = estado.tabelas[info.id];
    for (const r of t.registros) {
      for (const [c, rotulo] of CAMPOS_BUSCA) {
        const valor = Array.isArray(r[c]) ? r[c].join(' ; ') : r[c];
        if (valor && semAcento(valor).includes(alvo)) {
          lista.push({ escopo: info.id, tipo: 'registro', sigla: t.meta.sigla, cor: t.meta.cor,
                       situacao: info.situacao, codigo: r.codigo, titulo: r.descricao,
                       rotulo, valor });
          break;
        }
      }
    }
  }
  return lista;   // o glossário não entra na busca: ele aparece como link na ficha
}

function desenharEscopos(lista, alvo) {
  const caixa = $('#escopos');
  caixa.textContent = '';
  const opcoes = [{ id: 'todas', nome: 'Todas as tabelas' },
    ...estado.indice.tabelas.map((t) => ({ id: t.id, nome: t.sigla, minuta: ehMinuta(t) }))];
  for (const o of opcoes) {
    const n = o.id === 'todas' ? lista.length : lista.filter((a) => a.escopo === o.id).length;
    const b = el('button', { className: 'escopo', type: 'button' }, ...juntar(
      o.nome, o.minuta ? selo(' (minuta)') : null,
      el('span', { className: 'qtd', textContent: n })));
    b.setAttribute('aria-pressed', String(estado.escopo === o.id));
    b.addEventListener('click', () => { estado.escopo = o.id; desenharBusca(lista, alvo); });
    caixa.append(b);
  }
}

function desenharBusca(lista, alvo) {
  desenharEscopos(lista, alvo);
  const filtrada = estado.escopo === 'todas' ? lista : lista.filter((a) => a.escopo === estado.escopo);
  cabecaPagina({ titulo: filtrada.length
    ? `${filtrada.length} resultado${filtrada.length > 1 ? 's' : ''} para “${estado.consulta}”`
    : `Nada encontrado para “${estado.consulta}”` });
  const ul = $('#resultados');
  ul.textContent = '';
  for (const a of filtrada.slice(0, 200)) {
    const item = el('button', { type: 'button' },
      el('div', { className: 'etiqueta' }, ...juntar(
        `${a.sigla} · ${a.codigo}`, ehMinuta(a) ? selo(' · minuta') : null)),
      el('div', { className: 'titulo-res', textContent: a.titulo }),
      el('div', { className: 'onde' }, `em ${a.rotulo}: `, trecho(a.valor, alvo)));
    item.addEventListener('click', () => irPara(a.escopo, a.codigo));
    ul.append(el('li', {}, item));
  }
  mostrarTela('resultados');
  desenharTrilha();
}

let timerBusca;
$('#busca').addEventListener('input', (ev) => {
  clearTimeout(timerBusca);
  const v = ev.target.value;
  timerBusca = setTimeout(async () => {
    estado.consulta = v.trim();
    const alvo = semAcento(estado.consulta);
    if (alvo.length < 2) {
      $('#escopos').textContent = '';
      if (estado.atual) mostrarTela('tabela'); else mostrarTela('home');
      desenharTrilha();
      return;
    }
    desenharBusca(await achados(alvo), alvo);
  }, 160);
});

// -------------------------------------------------------- seleção e rotas
function selecionar(cod, { abrir = false, mapa = false } = {}) {
  estado.selecionado = cod;
  if (abrir) abrirAncestrais(cod);
  desenharArvore();
  if (mapa || estado.aba === 'mapa') desenharMapa();
  mostrarFicha(cod);
  const alvo = document.getElementById(`no-${cod}`);
  if (alvo && !mapa && estado.aba === 'arvore') alvo.focus({ preventScroll: true });
  history.replaceState(null, '', `#${rota(tabela().meta.sigla)}/${cod}`);
}

async function irPara(tabelaId, cod) {
  if (estado.atual !== tabelaId) await abrirTabela(tabelaId);
  $('#busca').value = ''; estado.consulta = ''; $('#escopos').textContent = '';
  mostrarTela('tabela');
  if (cod && tabela().porCodigo[cod]) selecionar(cod, { abrir: true });
  else { history.replaceState(null, '', `#${rota(tabela().meta.sigla)}`); desenharTrilha(); }
  desenharTrilha();
}

function irParaHome() {
  estado.atual = null;
  cabecaPagina({ titulo: 'Tabelas Taxonômicas' });
  $('#busca').value = ''; estado.consulta = ''; $('#escopos').textContent = '';
  document.documentElement.style.removeProperty('--cor');
  history.replaceState(null, '', '#/');
  mostrarTela('home');
  desenharTrilha();
}

async function abrirTabela(id) {
  await carregarTabela(id);
  estado.atual = id;
  estado.filtros = {}; estado.abertos = new Set(); estado.abertosMapa = new Set(['']);
  estado.vista = null; estado.selecionado = null;
  const t = tabela();
  document.documentElement.style.setProperty('--cor', t.meta.cor);
  cabecaPagina({ sigla: t.meta.sigla, titulo: t.meta.titulo,
                 dominio: t.meta.dominio });
  desenharTarja();
  trocarAba('arvore');
  $('#botaoFiltros').setAttribute('aria-expanded', 'false');
  $('#filtros').hidden = true;
  desenharFiltros();
  desenharArvore();
  atualizarContagem();
  fichaVazia();
  mostrarTela('tabela');
  desenharTrilha();
}

$('#irInicio').addEventListener('click', () => irParaHome());

function montarRodape() {
  const i = estado.indice;
  const minutas = i.tabelas.filter(ehMinuta).length;
  $('#rodape').textContent =
    `Protótipo sobre os dados canônicos (esquema ${i.versao_esquema}). Fonte oficial: resoluções do `
    + `Comitê de Gestão do Conhecimento da SPU, registradas no MemóriaSPU. `
    + `${i.tabelas.length} tabelas${minutas ? `, das quais ${minutas} em minuta não aprovada` : ''}`
    + ` · ${i.glossario.termos} termos de glossário · ${i.glossario.vinculos} vínculos.`;
}

function lerRota() {
  const [r, cod] = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/');
  const id = estado.rotas[r];
  if (!id) { irParaHome(); return; }
  irPara(id, cod);
}
window.addEventListener('hashchange', lerRota);

async function iniciar() {
  try {
    await carregarIndice();
    desenharHome();
    montarRodape();
    lerRota();
  } catch (erro) {
    $('#cards').append(el('p', {}, `Não foi possível carregar os dados: ${erro.message}`),
      el('p', { className: 'vazio', textContent:
        'A página precisa ser servida por HTTP. Em desenvolvimento: python3 proposta/ferramentas/servir.py 8765' }));
  }
}

iniciar();
