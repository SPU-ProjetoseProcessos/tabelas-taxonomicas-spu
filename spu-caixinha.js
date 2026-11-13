/*
  spu-caixinha.js — o canal de sugestão, erro e dúvida das ferramentas do
  Escritório de Processos da SPU (CGGES).

  COPIE este arquivo para dentro da ferramenta. Não o carregue de outro
  endereço: copiado, a ferramenta não faz chamada externa nenhuma ao abrir; a
  única chamada acontece quando a pessoa clica em Enviar.

  Uso:
    <script src="spu-caixinha.js"></script>
    <script>
      SPUCaixinha.iniciar({
        ferramenta: "simulador",                  // código que o banco aceita
        nome: "Governança da Destinação",         // como a ferramenta se chama na tela
        botao: "#reportar",                       // opcional: um botão seu. Sem ele, nasce um flutuante
        contexto: () => [["Regime", "Cessão de uso"], ["Regra aplicada", "R-14"]]
      });
    </script>

  Tudo cai em home.pedidos (projeto spuprocessos), pela função
  public.spu_registrar_pedido, e aparece na área da equipe, na caixa "Pedidos
  das ferramentas". É porta de uma via: quem envia não lê nada.
  Contrato completo em LEIA-ME.md, na mesma pasta. Versão 1 — 12/11/2026.
*/
(function () {
  "use strict";

  var URL_PADRAO = "https://yamixtmtgeockzxmmnsb.supabase.co/rest/v1/rpc/spu_registrar_pedido";
  var CHAVE_PADRAO = "sb_publishable_8WzmTmKmNaAcxq1MnBqEcg_hgI3ldDm";   // chave publicável: feita para ficar no cliente
  var LIMITE = 4000;           // o mesmo da função
  var TETO_CONTEXTO = 2000;    // o caso nunca ocupa mais que metade do relato
  var EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  var GUARDA = "spu-caixinha-contato";

  // Cópia de home.tipos_pedido em 12/11/2026. O banco é quem manda: se um tipo
  // sair de lá, a função recusa com "Escolha o que você quer registrar."
  var TIPOS = {
    spuprocessos: [["erro", "Encontrei um erro"], ["duvida", "Tenho uma dúvida"], ["melhoria", "Tenho uma sugestão de melhoria"],
                   ["solicitar_mapeamento", "Quero solicitar o mapeamento de um processo"]],
    cade:         [["erro", "Encontrei um erro"], ["duvida", "Tenho uma dúvida"], ["melhoria", "Tenho uma sugestão de melhoria"],
                   ["solicitar_registro", "Quero solicitar o registro de um sistema no catálogo"]],
    taxonomias:   [["erro", "Encontrei um erro"], ["duvida", "Tenho uma dúvida"], ["melhoria", "Tenho uma sugestão de melhoria"]],
    simulador:    [["erro", "Encontrei um erro na resposta"], ["duvida", "Tenho uma dúvida"], ["melhoria", "Tenho uma sugestão de melhoria"]],
    organograma:  [["erro", "Apontar um dado errado de pessoa ou unidade"], ["duvida", "Tenho uma dúvida"], ["melhoria", "Tenho uma sugestão de melhoria"]],
    home:         [["erro", "Encontrei um erro"], ["duvida", "Tenho uma dúvida"], ["melhoria", "Tenho uma sugestão de melhoria"]],
    outra:        [["duvida", "Tenho uma dúvida"], ["melhoria", "Tenho uma sugestão"]]
  };

  var CSS = [
    ".spuc-flutua{position:fixed;right:max(16px,env(safe-area-inset-right,0px));bottom:max(16px,env(safe-area-inset-bottom,0px));z-index:900}",
    ".spuc-bt{font:inherit;font-size:15px;font-weight:700;padding:9px 16px;border-radius:9px;cursor:pointer;border:2px solid var(--spuc-cor);background:var(--spuc-cor);color:var(--spuc-sobre-cor)}",
    ".spuc-bt:hover{filter:brightness(1.12)}",
    ".spuc-bt.spuc-leve{background:var(--spuc-fundo);color:var(--spuc-texto);border-color:var(--spuc-borda)}",
    ".spuc-bt[disabled]{opacity:.6;cursor:progress}",
    "dialog.spuc{--spuc-cor:#1b2b85;--spuc-sobre-cor:#fff;--spuc-fundo:#fff;--spuc-fundo-2:#f0f2f5;--spuc-texto:#23262b;--spuc-apagado:#4f5660;--spuc-borda:#b6bfcc;--spuc-erro:#b3261e;--spuc-ok:#15803d;",
    "  width:min(600px,calc(100% - 24px));max-height:calc(100% - 24px);padding:0;border:1.5px solid var(--spuc-borda);border-radius:14px;background:var(--spuc-fundo);color:var(--spuc-texto);font:inherit;font-size:15px;line-height:1.45;box-shadow:0 12px 40px -12px rgba(12,30,80,.5)}",
    "@media (prefers-color-scheme:dark){dialog.spuc:not(.spuc-claro){--spuc-cor:#9db8ff;--spuc-sobre-cor:#0d1430;--spuc-fundo:#171c2e;--spuc-fundo-2:#1f2639;--spuc-texto:#eef0f7;--spuc-apagado:#aab2c8;--spuc-borda:#47506c;--spuc-erro:#ff8a80;--spuc-ok:#4ccb78}}",
    "dialog.spuc::backdrop{background:rgba(15,23,42,.6)}",
    ".spuc *{box-sizing:border-box}",
    ".spuc-topo{display:flex;align-items:center;gap:10px;padding:12px 18px;border-bottom:1px solid var(--spuc-borda)}",
    ".spuc-topo b{font-size:17px;font-weight:800;flex:1}",
    ".spuc-x{border:0;background:none;color:var(--spuc-apagado);font-size:26px;line-height:1;cursor:pointer;padding:2px 8px;border-radius:6px}",
    ".spuc-corpo{padding:16px 18px;display:flex;flex-direction:column;gap:14px}",
    ".spuc-nota{margin:0;padding:10px 12px;border-radius:9px;background:var(--spuc-fundo-2);border-left:6px solid var(--spuc-cor);font-size:14.5px}",
    ".spuc-campo{display:flex;flex-direction:column;gap:6px;font-weight:700;font-size:14px;border:0;padding:0;margin:0;min-width:0}",
    ".spuc-campo legend{padding:0;margin-bottom:6px}",
    ".spuc-campo textarea,.spuc-campo input[type=email]{font:inherit;font-size:15px;font-weight:400;padding:9px 11px;border:1.5px solid var(--spuc-borda);border-radius:8px;background:var(--spuc-fundo);color:var(--spuc-texto);width:100%}",
    ".spuc-campo textarea{min-height:120px;resize:vertical}",
    ".spuc-opcao{display:flex;gap:9px;align-items:flex-start;font-weight:500;font-size:15px;padding:7px 10px;border:1.5px solid var(--spuc-borda);border-radius:8px;cursor:pointer}",
    ".spuc-opcao:has(input:checked){border-color:var(--spuc-cor);box-shadow:inset 0 0 0 1px var(--spuc-cor);font-weight:700}",
    ".spuc-opcao input{margin-top:3px;accent-color:var(--spuc-cor)}",
    ".spuc-dica{margin:0;font-size:13.5px;font-weight:400;color:var(--spuc-apagado)}",
    ".spuc-conta{align-self:flex-end}",
    ".spuc-caso{border:1.5px solid var(--spuc-borda);border-radius:8px;padding:8px 11px;font-size:14px}",
    ".spuc-caso summary{cursor:pointer;font-weight:700}",
    ".spuc-caso pre{margin:8px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;font-size:13.5px;color:var(--spuc-apagado)}",
    ".spuc-msg{margin:0;padding:10px 12px;border-radius:9px;font-weight:700;border:1.5px solid}",
    ".spuc-msg.spuc-erro{color:var(--spuc-erro);border-color:var(--spuc-erro)}",
    ".spuc-msg.spuc-ok{color:var(--spuc-ok);border-color:var(--spuc-ok)}",
    ".spuc-acoes{display:flex;gap:10px;flex-wrap:wrap;align-items:center}",
    ".spuc-pe{margin:0;padding:10px 18px 14px;border-top:1px solid var(--spuc-borda);font-size:12.5px;color:var(--spuc-apagado)}",
    ".spuc [hidden]{display:none!important}"
  ].join("\n");

  function el(tag, attrs, filhos) {
    var n = document.createElement(tag), k;
    for (k in attrs || {}) {
      if (k === "texto") n.textContent = attrs[k];
      else if (k === "classe") n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    (filhos || []).forEach(function (f) { if (f) n.appendChild(f); });
    return n;
  }

  // O caso que a ferramenta registra junto: string, objeto ou lista de [rótulo, valor].
  function linhasDoContexto(ctx) {
    if (ctx == null || ctx === "") return [];
    if (typeof ctx === "string") return [ctx];
    var pares = Array.isArray(ctx) ? ctx : Object.keys(ctx).map(function (k) { return [k, ctx[k]]; });
    return pares.filter(function (p) { return p && p[1] != null && p[1] !== ""; })
                .map(function (p) { return Array.isArray(p) ? p[0] + ": " + p[1] : String(p); });
  }
  // O que vai abaixo do relato, separado por uma linha. É o que torna o relato acionável.
  function blocoDoCaso(cfg) {
    var linhas = [];
    try { linhas = linhasDoContexto(typeof cfg.contexto === "function" ? cfg.contexto() : cfg.contexto); }
    catch (e) { linhas = ["(a ferramenta não conseguiu registrar o caso: " + e.message + ")"]; }
    if (cfg.pagina !== false) linhas.push("Página: " + location.href);
    if (!linhas.length) return "";
    var corpo = linhas.join("\n");
    var cab = "\n\n----------\nO caso, registrado por " + (cfg.nome || cfg.ferramenta) + ":\n";
    if (corpo.length > TETO_CONTEXTO - cab.length) corpo = corpo.slice(0, TETO_CONTEXTO - cab.length - 12) + "\n… (cortado)";
    return cab + corpo;
  }
  function montarTexto(relato, bloco) { return String(relato || "").trim() + (bloco || ""); }

  function enviar(cfg, corpo) {
    if (cfg.ensaio) {      // ensaio: nada sai da página. Serve para ligar o botão sem sujar a fila.
      if (window.console) console.log("[spu-caixinha] ensaio — o que seria enviado:", corpo);
      return Promise.resolve({ ok: true, ensaio: true });
    }
    var chave = cfg.chave || CHAVE_PADRAO;
    return fetch(cfg.url || URL_PADRAO, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": chave, "Authorization": "Bearer " + chave },
      body: JSON.stringify(corpo)
    }).then(function (r) {
      if (r.ok) return { ok: true };
      // A função escreve as mensagens para quem preenche: mostra-se como vier.
      return r.json().then(function (j) { return { ok: false, mensagem: j && j.message }; },
                           function () { return { ok: false }; });
    }, function () {
      return { ok: false, mensagem: "Não foi possível falar com o servidor. O seu texto continua aqui: tente enviar de novo." };
    });
  }

  var estiloPosto = false, dlg = null, cfgAtual = null;

  function construir(cfg) {
    if (!estiloPosto) { document.head.appendChild(el("style", { texto: CSS })); estiloPosto = true; }
    if (dlg) dlg.remove();
    var tipos = cfg.tipos || TIPOS[cfg.ferramenta] || TIPOS.outra;
    var nome = cfg.nome || cfg.ferramenta;

    var opcoes = tipos.map(function (t) {
      var r = el("input", { type: "radio", name: "spuc-tipo", value: t[0] });
      if (cfg.tipoInicial === t[0]) r.checked = true;     // sem tipoInicial, nada vem marcado
      return el("label", { classe: "spuc-opcao" }, [r, el("span", { texto: t[1] })]);
    });
    var texto = el("textarea", { id: "spuc-texto", placeholder: "Quanto mais detalhe, melhor: o que você fez, o que esperava e o que apareceu." });
    var conta = el("p", { classe: "spuc-dica spuc-conta" });
    var contato = el("input", { type: "email", id: "spuc-contato", placeholder: "nome.sobrenome@gestao.gov.br", autocomplete: "email" });
    var casoPre = el("pre");
    var caso = el("details", { classe: "spuc-caso" }, [el("summary", { texto: "O que vai junto com o seu relato" }), casoPre]);
    var msg = el("p", { classe: "spuc-msg", role: "alert", hidden: "" });
    var btEnviar = el("button", { type: "button", classe: "spuc-bt", texto: "Enviar" });
    var btFechar = el("button", { type: "button", classe: "spuc-bt spuc-leve", texto: "Fechar", hidden: "" });
    var formulario = el("div", { classe: "spuc-corpo" }, [
      el("p", { classe: "spuc-nota", texto: "A equipe do Escritório de Processos lê tudo e guarda, mas não responde pedido por pedido. Se precisar de mais detalhe, chama você pelo Teams." }),
      el("fieldset", { classe: "spuc-campo" }, [el("legend", { texto: "O que você quer registrar" })].concat(opcoes)),
      el("label", { classe: "spuc-campo", for: "spuc-texto" }, [el("span", { texto: "Conte o que aconteceu" }), texto, conta]),
      caso,
      el("label", { classe: "spuc-campo", for: "spuc-contato" }, [el("span", { texto: "Seu e-mail institucional" }), contato,
        el("p", { classe: "spuc-dica", texto: "Obrigatório. É por ele que a equipe acha você no Teams — não para responder por e-mail." })]),
      msg,
      el("div", { classe: "spuc-acoes" }, [btEnviar, btFechar])
    ]);
    var fechar = el("button", { type: "button", classe: "spuc-x", "aria-label": "Fechar", texto: "×" });
    dlg = el("dialog", { classe: "spuc" + (cfg.tema === "claro" ? " spuc-claro" : ""), "aria-label": "Registrar um pedido sobre " + nome }, [
      el("div", { classe: "spuc-topo" }, [el("b", { texto: "Fale com a equipe — " + nome }), fechar]),
      formulario,
      el("p", { classe: "spuc-pe", texto: "CGGES — Escritório de Processos da SPU" })
    ]);
    if (cfg.cor) dlg.style.setProperty("--spuc-cor", cfg.cor);
    document.body.appendChild(dlg);

    var bloco = "";
    function mostrar(tipo, m) { msg.textContent = m; msg.className = "spuc-msg spuc-" + tipo; msg.hidden = false; }
    function contar() { conta.textContent = texto.value.length + " / " + (LIMITE - bloco.length); }
    function preparar(tipo) {
      bloco = blocoDoCaso(cfg);
      casoPre.textContent = bloco.replace(/^\s*-+\s*/, "");
      caso.hidden = !bloco;
      texto.maxLength = LIMITE - bloco.length;
      msg.hidden = true; btEnviar.hidden = false; btEnviar.disabled = false; btFechar.hidden = true;
      texto.disabled = false; contato.disabled = false;
      if (tipo) opcoes.forEach(function (o) { var r = o.firstChild; r.checked = r.value === tipo; });
      if (!contato.value) { try { contato.value = localStorage.getItem(GUARDA) || ""; } catch (e) {} }
      contar();
    }
    texto.addEventListener("input", contar);
    fechar.addEventListener("click", function () { dlg.close(); });
    btFechar.addEventListener("click", function () { dlg.close(); });
    btEnviar.addEventListener("click", function () {
      var marcado = opcoes.map(function (o) { return o.firstChild; }).filter(function (r) { return r.checked; })[0];
      var relato = texto.value.trim(), mail = contato.value.trim().toLowerCase();
      // As mesmas mensagens que a função devolve, para poupar a viagem. Quem manda é ela.
      if (!marcado) return mostrar("erro", "Escolha o que você quer registrar.");
      if (!relato) return mostrar("erro", "Escreva o que você quer relatar antes de enviar.");
      if (!mail) return mostrar("erro", "Informe seu e-mail completo: é por ele que a equipe encontra você no Teams se precisar entender melhor o que aconteceu.");
      if (!EMAIL.test(mail)) return mostrar("erro", "O e-mail informado não parece completo. Escreva o endereço inteiro, como nome.sobrenome@gestao.gov.br.");
      var corpo = { p_ferramenta: cfg.ferramenta, p_tipo: marcado.value, p_texto: montarTexto(relato, bloco),
                    p_contato: mail, p_origem: cfg.origem || "ferramenta" };
      btEnviar.disabled = true; msg.hidden = true;
      enviar(cfg, corpo).then(function (r) {
        if (!r.ok) {
          btEnviar.disabled = false;
          return mostrar("erro", r.mensagem || "Não foi possível registrar agora. O seu texto continua aqui: tente de novo em instantes.");
        }
        try { localStorage.setItem(GUARDA, mail); } catch (e) {}
        texto.value = ""; texto.disabled = true; contato.disabled = true;
        opcoes.forEach(function (o) { o.firstChild.checked = o.firstChild.value === cfg.tipoInicial; });   // o próximo relato escolhe de novo
        btEnviar.hidden = true; btFechar.hidden = false;
        mostrar("ok", r.ensaio ? "Ensaio: nada foi enviado. O que seria enviado está no console do navegador."
                               : "Registrado. Obrigado — a equipe do Escritório de Processos acompanha esta fila.");
        if (typeof cfg.aoEnviar === "function") cfg.aoEnviar(corpo);
      });
    });
    dlg._preparar = preparar;
    return dlg;
  }

  function abrir(tipo) {
    if (!cfgAtual) throw new Error("SPUCaixinha: chame iniciar() antes de abrir().");
    if (!dlg) construir(cfgAtual);
    dlg._preparar(tipo);
    dlg.showModal();
  }

  function iniciar(cfg) {
    if (!cfg || !cfg.ferramenta) throw new Error("SPUCaixinha: informe a ferramenta (ex.: \"simulador\").");
    cfgAtual = cfg; if (dlg) { dlg.remove(); dlg = null; }
    var bt = typeof cfg.botao === "string" ? document.querySelector(cfg.botao) : cfg.botao;
    if (!bt && cfg.botao !== false) {       // sem botão seu, nasce um flutuante
      if (!estiloPosto) { document.head.appendChild(el("style", { texto: CSS })); estiloPosto = true; }
      bt = el("button", { type: "button", classe: "spuc-bt", texto: cfg.rotuloBotao || "Fale com a equipe" });
      var casca = el("div", { classe: "spuc-flutua spuc" }, [bt]);
      casca.style.setProperty("--spuc-cor", cfg.cor || "#1b2b85"); casca.style.setProperty("--spuc-sobre-cor", "#fff");
      document.body.appendChild(casca);
    }
    if (bt) bt.addEventListener("click", function () { abrir(bt.getAttribute("data-spuc-tipo") || undefined); });
    return { abrir: abrir };
  }

  // montarTexto é interno: recebe o relato e o bloco já pronto, não os pares. Não é API.
  window.SPUCaixinha = { iniciar: iniciar, abrir: abrir, versao: "1" };
})();
