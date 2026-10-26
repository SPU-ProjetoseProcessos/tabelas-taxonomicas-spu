/* Tabelas Taxonômicas da SPU — protótipo de consulta.
   Sem dependências: lê os dados canônicos de ../dados.
   Três telas: home (cards), resultados da busca e tabela (árvore ou mapa + ficha). */
'use strict';

const BASE = 'dados';

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
const baixarJSON = (caminho) => fetch(`${BASE}/${caminho}`).then((r) => {
  if (!r.ok) throw new Error(`não foi possível ler ${caminho} (${r.status})`);
  return r.json();
});
const semAcento = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const rota = (sigla) => sigla.toLowerCase().replace(/[^a-z0-9]/g, '');
const dataBR = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '')
  ? iso.split('-').reverse().join('/') : iso || '');

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

function desenharTrilha() {
  const nav = $('#trilha');
  nav.textContent = '';
  const inicio = el('button', { type: 'button', textContent: 'Tabelas' });
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

function desenharHome() {
  const caixa = $('#cards');
  caixa.textContent = '';
  for (const t of estado.indice.tabelas) {
    const card = el('button', { className: 'card', type: 'button' });
    card.style.setProperty('--cor-card', t.cor || '#17585e');
    card.append(
      el('span', { className: 'sigla', textContent: `${t.sigla} · ${t.eixo}` }),
      el('h2', { textContent: t.titulo }),
      el('p', { className: 'dominio', textContent: t.dominio || '' }),
      el('div', { className: 'numeros' },
        el('div', {}, el('b', { textContent: String(t.totais.registros) }), el('span', { textContent: 'registros' })),
        el('div', {}, el('b', { textContent: String(t.profundidade) }), el('span', { textContent: 'níveis' }))),
      el('p', { className: 'norma', textContent: t.norma_vigente }),
    );
    card.addEventListener('click', () => irPara(t.id));
    caixa.append(card);
  }
  const atalho = $('#atalhoTabela');
  atalho.textContent = '';
  atalho.append(el('option', { value: '', textContent: 'escolher uma tabela…' }));
  const porEixo = {};
  for (const t of estado.indice.tabelas) (porEixo[t.eixo || 'Outras'] ||= []).push(t);
  for (const [eixo, lista] of Object.entries(porEixo)) {
    atalho.append(el('optgroup', { label: eixo },
      lista.map((t) => el('option', { value: t.id, textContent: `${t.sigla} — ${t.titulo}` }))));
  }
  atalho.value = '';
  atalho.onchange = () => { if (atalho.value) irPara(atalho.value); };

  const g = estado.indice.glossario;
  $('#resumoAcervo').textContent =
    `${estado.indice.tabelas.length} tabelas publicadas · ${g.termos} termos no glossário do MemóriaSPU, `
    + `${g.vinculos} deles ligados a um código.`;
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
    r.situacao !== 'vigente' ? el('span', { className: 'marca', textContent: 'uso restrito' }) : null,
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
      ' ',
      v.situacao === 'validado'
        ? el('span', { className: 'chip ok', textContent: 'validado' })
        : el('span', { className: 'chip aviso', textContent: v.situacao }),
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

function comoCitar(r) {
  const m = tabela().meta;
  return `${m.sigla} — ${m.titulo}, código ${r.codigo} (${r.descricao}). ${m.norma_vigente.ato}. `
       + `Documento SEI ${m.norma_vigente.sei_documento}, processo ${m.norma_vigente.processo_sei}.`;
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
    campo('Norma de origem', el('div', {},
      el('p', { textContent: t.meta.norma_vigente.ato }),
      el('p', { className: 'vazio', style: 'font-size:13px', textContent:
        `Publicada em ${dataBR(t.meta.norma_vigente.publicacao)} · documento SEI ${t.meta.norma_vigente.sei_documento}`
        + ` · processo ${t.meta.norma_vigente.processo_sei}` }))),
    el('div', { className: 'acoes' },
      botaoCopiar('Copiar link', location.href),
      botaoCopiar('Copiar código', `${r.codigo} — ${r.descricao}`),
      botaoCopiar('Copiar citação', comoCitar(r))),
  ));
  caixa.append(corpo);
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
function exportar(formato) {
  const t = tabela();
  const vis = codigosVisiveis();
  const regs = t.registros.filter((r) => vis.has(r.codigo));
  const nome = `${rota(t.meta.sigla)}-${regs.length}-registros`;
  let conteudo, tipo;
  if (formato === 'JSON') {
    conteudo = JSON.stringify({ tabela: t.meta, registros: regs }, null, 1);
    tipo = 'application/json';
  } else {
    const cols = ['codigo', 'nivel', 'pai', 'descricao', 'definicao', 'observacao',
                  'fundamento_legal', 'instrumento', 'exemplos', 'situacao', 'nota_de_aplicacao'];
    const cel = (v) => {
      const s = Array.isArray(v) ? v.join(' | ') : String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    conteudo = [cols.join(','), ...regs.map((r) => cols.map((c) => cel(r[c])).join(','))].join('\n');
    tipo = 'text/csv;charset=utf-8';
  }
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = el('a', { href: url, download: `${nome}.${formato.toLowerCase()}` });
  document.body.append(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
$('#baixarCSV').addEventListener('click', () => exportar('CSV'));
$('#baixarJSON').addEventListener('click', () => exportar('JSON'));

// -------------------------------------------------------------------- mapa
const SVGNS = 'http://www.w3.org/2000/svg';
const LARG = 222, ALT = 40, HGAP = 60, VGAP = 11;
const svgEl = (tag, attrs = {}) => {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

function nosDoMapa() {
  const t = tabela();
  const visiveis = codigosVisiveis();
  const nos = [];
  let cursor = 0;
  const medir = (cod, prof) => {
    const kids = (t.filhos[cod] || []).filter((c) => visiveis.has(c));
    const aberto = cod === '' || estado.abertosMapa.has(cod);
    const no = { codigo: cod, prof, temFilhos: kids.length > 0, aberto, y: 0,
      descricao: cod === '' ? t.meta.titulo : t.porCodigo[cod].descricao,
      detalhe: cod === '' ? t.meta.sigla : cod, filhos: (t.filhos[cod] || []).length };
    nos.push(no);
    if (aberto && kids.length) {
      const ys = kids.map((c) => medir(c, prof + 1));
      no.y = (Math.min(...ys) + Math.max(...ys)) / 2;
    } else { no.y = cursor; cursor += ALT + VGAP; }
    return no.y;
  };
  medir('', 0);
  return nos;
}

function aplicarVista() {
  const v = estado.vista;
  $('#mapa').setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
}

function limitesMapa(nos) {
  const maxProf = Math.max(...nos.map((n) => n.prof));
  return { w: (maxProf + 1) * LARG + maxProf * HGAP, h: Math.max(...nos.map((n) => n.y)) + ALT };
}

/* Põe o nó a cerca de dois terços da largura, para os galhos que levam até ele
   continuarem à vista do lado esquerdo. */
function enquadrarNo(no) {
  const v = estado.vista;
  estado.vista = { ...v,
    x: no.prof * (LARG + HGAP) + LARG / 2 - v.w * 0.66,
    y: no.y + ALT / 2 - v.h / 2 };
  aplicarVista();
}

/* Enquadra tudo quando o mapa inteiro continua legível; senão abre em escala de
   leitura, centrado no registro selecionado. */
function centralizarMapa(nos) {
  const svg = $('#mapa');
  const lista = nos || nosDoMapa();
  const lim = limitesMapa(lista);
  const m = 28;
  const largura = svg.clientWidth || 800, altura = svg.clientHeight || 560;
  const escala = Math.min(largura / (lim.w + m * 2), altura / (lim.h + m * 2));
  if (escala >= 0.7) {
    estado.vista = { x: -m, y: -m, w: lim.w + m * 2, h: lim.h + m * 2 };
    aplicarVista();
    return;
  }
  estado.vista = { x: -m, y: -m, w: largura, h: altura };
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
    const x = n.prof * (LARG + HGAP);
    const cor = n.codigo === '' ? { forte: t.meta.cor, fraca: '#fff', media: t.meta.cor } : corDoRamo(n.codigo);
    if (n.prof > 0) {
      const pai = porCodigo[t.porCodigo[n.codigo].pai || ''];
      const x1 = pai.prof * (LARG + HGAP) + LARG, y1 = pai.y + ALT / 2;
      const x2 = x, y2 = n.y + ALT / 2, mx = (x1 + x2) / 2;
      ligacoes.append(svgEl('path', { class: 'lig', stroke: cor.media,
        'stroke-width': n.prof === 1 ? 2.4 : 1.5,
        d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}` }));
    }
    // raiz e ramos de 1º nível vêm chapados na cor do ramo; o resto, em branco
    const chapado = n.prof <= 1;
    const g = svgEl('g', { class: `no-mapa${chapado ? ' chapado' : ''}${n.codigo === estado.selecionado ? ' sel' : ''}`,
      transform: `translate(${x},${n.y})`, tabindex: '0', role: 'button' });
    g.append(svgEl('rect', { width: LARG, height: ALT,
      fill: chapado ? cor.forte : (n.codigo === estado.selecionado ? cor.fraca : '#fff'),
      stroke: chapado ? cor.forte : cor.media,
      'stroke-width': n.codigo === estado.selecionado ? 2.5 : 1.5 }));
    const txtCod = svgEl('text', { x: 12, y: 16, class: 'cod-mapa' });
    if (!chapado) txtCod.style.fill = cor.forte;
    txtCod.textContent = n.detalhe + (n.temFilhos ? (n.aberto ? '   –' : `   + ${n.filhos}`) : '');
    const txt = svgEl('text', { x: 12, y: 31 });
    txt.textContent = n.descricao.length > 31 ? `${n.descricao.slice(0, 30)}…` : n.descricao;
    const titulo = svgEl('title');
    titulo.textContent = `${n.detalhe} — ${n.descricao}`;
    g.append(txtCod, txt, titulo);
    const agir = () => {
      if (n.temFilhos || n.codigo === '') {
        if (estado.abertosMapa.has(n.codigo)) estado.abertosMapa.delete(n.codigo);
        else estado.abertosMapa.add(n.codigo);
      }
      if (n.codigo) selecionar(n.codigo, { abrir: false, mapa: true });
      else desenharMapa();
      const novo = nosDoMapa().find((x2) => x2.codigo === n.codigo);
      if (novo) enquadrarNo(novo);
    };
    g.addEventListener('click', agir);
    g.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); agir(); }
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

$('#centralizar').addEventListener('click', () => centralizarMapa());
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
$('#voltarInicio').addEventListener('click', () => irParaHome());
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
                       codigo: r.codigo, titulo: r.descricao, rotulo, valor });
          break;
        }
      }
    }
  }
  for (const termo of estado.glossario.termos) {
    const valor = `${termo.termo} ${termo.definicao}`;
    if (semAcento(valor).includes(alvo)) {
      lista.push({ escopo: 'glossario', tipo: 'termo', titulo: termo.termo,
                   rotulo: 'glossário', valor: termo.definicao, url: termo.url_memoriaspu });
    }
  }
  return lista;
}

function desenharEscopos(lista, alvo) {
  const caixa = $('#escopos');
  caixa.textContent = '';
  const opcoes = [{ id: 'todas', nome: 'Todas' },
    ...estado.indice.tabelas.map((t) => ({ id: t.id, nome: t.sigla })),
    { id: 'glossario', nome: 'Glossário' }];
  for (const o of opcoes) {
    const n = o.id === 'todas' ? lista.length : lista.filter((a) => a.escopo === o.id).length;
    const b = el('button', { className: 'escopo', type: 'button' },
      o.nome, el('span', { className: 'qtd', textContent: n }));
    b.setAttribute('aria-pressed', String(estado.escopo === o.id));
    b.addEventListener('click', () => { estado.escopo = o.id; desenharBusca(lista, alvo); });
    caixa.append(b);
  }
}

function desenharBusca(lista, alvo) {
  desenharEscopos(lista, alvo);
  const filtrada = estado.escopo === 'todas' ? lista : lista.filter((a) => a.escopo === estado.escopo);
  $('#tituloResultados').textContent = filtrada.length
    ? `${filtrada.length} resultado${filtrada.length > 1 ? 's' : ''} para “${estado.consulta}”`
    : `Nada encontrado para “${estado.consulta}”`;
  const ul = $('#resultados');
  ul.textContent = '';
  for (const a of filtrada.slice(0, 200)) {
    const conteudo = [
      el('div', { className: 'etiqueta', textContent:
        a.tipo === 'registro' ? `${a.sigla} · ${a.codigo}` : 'Glossário · abre no MemóriaSPU' }),
      el('div', { className: 'titulo-res', textContent: a.titulo }),
      el('div', { className: 'onde' }, `em ${a.rotulo}: `, trecho(a.valor, alvo)),
    ];
    let item;
    if (a.tipo === 'registro') {
      item = el('button', { type: 'button' }, conteudo);
      item.addEventListener('click', () => irPara(a.escopo, a.codigo));
    } else {
      item = el('a', { href: a.url, target: '_blank', rel: 'noopener' }, conteudo);
    }
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
  $('#siglaTabela').textContent = `${t.meta.sigla} · ${t.meta.eixo}`;
  $('#tituloTabela').textContent = t.meta.titulo;
  $('#dominioTabela').textContent = t.meta.dominio;
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

function montarRodape() {
  const i = estado.indice;
  $('#rodape').textContent =
    `Protótipo sobre os dados canônicos (esquema ${i.versao_esquema}). Fonte oficial: resoluções do `
    + `Comitê de Gestão do Conhecimento da SPU, registradas no MemóriaSPU. `
    + `${i.tabelas.length} tabelas · ${i.glossario.termos} termos de glossário · ${i.glossario.vinculos} vínculos.`;
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
        'A página precisa ser servida por HTTP. Em desenvolvimento: python3 ferramentas/servir.py 8765' }));
  }
}

iniciar();
