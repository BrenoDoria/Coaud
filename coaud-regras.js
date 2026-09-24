// ══════════════════════════════════════════════════════
//  COAUD — coaud-regras.js
//  Regras compartilhadas entre Escaneamento e Localizador:
//   • reconhecer os responsáveis da COAUD pelo NOME
//     (ignora maiúsculas, acentos, espaços e a matrícula)
//   • conferir na planilha a linha ATUAL de um NRP antes
//     de alterar ou apagar (evita mexer na linha errada)
//
//  RESPONSÁVEIS: a lista oficial fica na aba CONFIG da planilha
//  (coluna A, um nome por linha). A lista RESPONSAVEIS_COAUD de
//  cada página continua como RESERVA, usada só se a aba CONFIG
//  ainda não existir ou não puder ser lida.
// ══════════════════════════════════════════════════════

// "José Henrique Ferreira da Silva (7913)" → "JOSE HENRIQUE FERREIRA DA SILVA"
function normalizarNome(nome) {
    return (nome || '').toString()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\(\s*\d+\s*\)/g, '')
        .replace(/\s+/g, ' ')
        .trim().toUpperCase();
}

// ══ LISTA DE RESPONSÁVEIS (aba CONFIG) ════════════════
const ABA_CONFIG           = 'CONFIG';
const CABECALHO_CONFIG     = 'Responsáveis considerados no inventário (um por linha)';
const CACHE_RESPONSAVEIS   = 'coaud_responsaveis';
let   RESPONSAVEIS_ATIVOS  = null;   // lida da aba CONFIG (null = ainda não lida)

// Lista em uso: aba CONFIG → cópia guardada no navegador → reserva da página
function listaResponsaveis() {
    if (RESPONSAVEIS_ATIVOS && RESPONSAVEIS_ATIVOS.length) return RESPONSAVEIS_ATIVOS;
    try {
        const c = JSON.parse(localStorage.getItem(CACHE_RESPONSAVEIS));
        if (Array.isArray(c) && c.length) return c;
    } catch (e) { /* ignora */ }
    return (typeof RESPONSAVEIS_COAUD !== 'undefined') ? RESPONSAVEIS_COAUD : [];
}

// "ALBERTO, PAULO e JOSE HENRIQUE" (para textos na tela)
function responsaveisResumo() {
    const nomes = listaResponsaveis().map(n => normalizarNome(n).split(' ')[0]).filter(Boolean);
    if (!nomes.length) return '(nenhum responsável definido)';
    return nomes.length === 1 ? nomes[0] : nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1];
}

// true se o responsável estiver na lista (qualquer grafia, com ou sem matrícula)
function ehResponsavelCoaud(resp, listaOpcional) {
    const lista = listaOpcional || listaResponsaveis();
    const r = normalizarNome(resp);
    return !!r && lista.some(x => normalizarNome(x) === r);
}

// Lê a aba CONFIG. Se ela não existir, mantém a reserva da página.
async function carregarResponsaveis(token, fileId) {
    const r = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/${encodeURIComponent(ABA_CONFIG + '!A:A')}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
    );
    if (r.status === 401) throw new Error('SESSAO_EXPIRADA');
    if (r.status === 400) { RESPONSAVEIS_ATIVOS = null; return listaResponsaveis(); }   // aba não existe
    if (!r.ok) throw new Error('Erro ao ler a aba CONFIG (' + r.status + ')');
    const lista = ((await r.json()).values || []).slice(1)
        .map(l => (l[0] || '').toString().trim()).filter(Boolean);
    RESPONSAVEIS_ATIVOS = lista.length ? lista : null;
    if (lista.length) {
        try { localStorage.setItem(CACHE_RESPONSAVEIS, JSON.stringify(lista)); } catch (e) { /* ignora */ }
    }
    return listaResponsaveis();
}

// Grava a lista na aba CONFIG (cria a aba se precisar)
async function salvarResponsaveis(token, fileId, lista) {
    const api = `https://sheets.googleapis.com/v4/spreadsheets/${fileId}`;
    const chamar = async (url, opcoes = {}) => {
        const headers = { 'Authorization': `Bearer ${token}` };
        if (opcoes.body) headers['Content-Type'] = 'application/json';
        const r = await fetch(url, { ...opcoes, headers });
        if (r.status === 401) throw new Error('SESSAO_EXPIRADA');
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error?.message || ('HTTP ' + r.status)); }
        return r.json();
    };
    const meta = await chamar(`${api}?fields=sheets.properties(title)`);
    if (!(meta.sheets || []).some(x => x.properties.title === ABA_CONFIG)) {
        await chamar(`${api}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: {
            title: ABA_CONFIG, gridProperties: { frozenRowCount: 1 } } } }] }) });
    }
    await chamar(`${api}/values/${encodeURIComponent(ABA_CONFIG + '!A2:A')}:clear`, { method: 'POST', body: '{}' });
    const valores = [[CABECALHO_CONFIG]].concat(lista.map(n => [n]));
    await chamar(`${api}/values/${encodeURIComponent(ABA_CONFIG + '!A1:A' + valores.length)}?valueInputOption=RAW`,
        { method: 'PUT', body: JSON.stringify({ values: valores }) });
    RESPONSAVEIS_ATIVOS = lista.slice();
    try { localStorage.setItem(CACHE_RESPONSAVEIS, JSON.stringify(lista)); } catch (e) { /* ignora */ }
}

// Compara NRPs ignorando pontos e zeros à esquerda
function nrpIgual(a, b) {
    const n = x => (x === undefined || x === null ? '' : x.toString())
        .replace(/\./g, '').replace(/^0+/, '').trim();
    const na = n(a);
    return na !== '' && na === n(b);
}

// Lê a coluna A da aba AGORA e devolve o número da linha (1 = cabeçalho)
// onde está o NRP. Devolve -1 se não existir.
async function localizarLinhaAtual(token, fileId, aba, nrp) {
    const r = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/${encodeURIComponent(aba + '!A:A')}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
    );
    if (r.status === 401) throw new Error('SESSAO_EXPIRADA');
    if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(`Erro ao conferir ${aba}: ${e.error?.message || r.status}`);
    }
    const valores = (await r.json()).values || [];
    const encontradas = [];
    for (let i = 1; i < valores.length; i++) {
        if (valores[i] && nrpIgual(valores[i][0], nrp)) encontradas.push(i + 1);
    }
    if (encontradas.length > 1) {
        console.warn(`NRP ${nrp} aparece ${encontradas.length}x na aba ${aba} (linhas ${encontradas.join(', ')}). Usando a primeira.`);
    }
    return encontradas.length ? encontradas[0] : -1;
}

// Mantém a cópia em memória igual à planilha, localizando pelo NRP
// novaLinha = null → remove
function atualizarMemoria(dados, nrp, novaLinha) {
    const i = dados.findIndex((row, idx) => idx > 0 && row && nrpIgual(row[0], nrp));
    if (novaLinha) {
        if (i > 0) dados[i] = novaLinha;
        else dados.push(novaLinha);
    } else if (i > 0) {
        dados.splice(i, 1);
    }
}