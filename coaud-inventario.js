// ══════════════════════════════════════════════════════
//  COAUD — coaud-inventario.js
//  Inventários em abas separadas ("INV 2026", "INV 2027"...)
//  + aba de controle "INVENTARIOS" (nome, aba, criação, conclusão)
//  Usado por: Escaneamento, Comparador e Dashboard
// ══════════════════════════════════════════════════════

const INV_PREFIXO      = 'INV ';
const SOBRAS_PREFIXO   = 'SOBRAS ';   // aba de sobras: "SOBRAS INV 2026"
const ABA_CONTROLE_INV = 'INVENTARIOS';
const SHEETS_API       = 'https://sheets.googleapis.com/v4/spreadsheets/';

const CABECALHO_INV = [
    'NRP', 'Material', 'Localização', 'Responsável', 'Situação',
    'Sala anterior', 'Data/Hora', 'Operador', 'Inventário', 'Responsável anterior'
];
const CABECALHO_CONTROLE = ['Nome', 'Aba', 'Criado em', 'Criado por', 'Concluído em', 'Responsáveis'];
const SEP_RESPONSAVEIS   = ' | ';   // separador dos nomes na coluna F da aba INVENTARIOS

// "INV 2026" → "SOBRAS INV 2026"
function abaSobrasDe(abaInv) {
    return SOBRAS_PREFIXO + abaInv;
}

// Nome de aba com espaço precisa de aspas simples na notação A1: 'INV 2026'!A:J
function rangeAba(aba, colunas) {
    return `'${aba.replace(/'/g, "''")}'!${colunas}`;
}
function urlRange(aba, colunas) {
    return encodeURIComponent(rangeAba(aba, colunas));
}

function dataHoraBR() {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

async function sheetsFetch(token, url, opcoes = {}) {
    const headers = { 'Authorization': `Bearer ${token}` };
    if (opcoes.body) headers['Content-Type'] = 'application/json';
    const r = await fetch(url, { ...opcoes, headers });
    if (r.status === 401) throw new Error('SESSAO_EXPIRADA');
    if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error?.message || ('HTTP ' + r.status));
    }
    return r.json();
}

// Lista os inventários (abas que começam com "INV ") na ordem das abas.
// O último da lista é o mais recente.
async function listarInventarios(token, fileId) {
    const meta = await sheetsFetch(token, `${SHEETS_API}${fileId}?fields=sheets.properties(title,sheetId,index)`);
    const abas = (meta.sheets || []).map(s => s.properties);
    const sheetIds = {};
    abas.forEach(a => { sheetIds[a.title] = a.sheetId; });

    let controle = [];
    if (sheetIds[ABA_CONTROLE_INV] !== undefined) {
        const d = await sheetsFetch(token, `${SHEETS_API}${fileId}/values/${urlRange(ABA_CONTROLE_INV, 'A:F')}`);
        controle = (d.values || []).slice(1);
    }

    const lista = abas
        .filter(a => a.title.toUpperCase().startsWith(INV_PREFIXO))
        .sort((a, b) => a.index - b.index)
        .map(a => {
            const i = controle.findIndex(r => (r[1] || '').trim() === a.title);
            const c = i >= 0 ? controle[i] : null;
            const abaSobras = abaSobrasDe(a.title);
            return {
                aba: a.title,
                abaSobras,
                temSobras: sheetIds[abaSobras] !== undefined,
                sheetIdSobras: sheetIds[abaSobras],
                nome: (c && c[0]) || a.title.slice(INV_PREFIXO.length).trim(),
                sheetId: a.sheetId,
                criadoEm: c ? (c[2] || '') : '',
                criadoPor: c ? (c[3] || '') : '',
                concluidoEm: c ? (c[4] || '') : '',
                // responsáveis considerados neste inventário (vazio nos inventários antigos)
                responsaveis: c && c[5] ? c[5].toString().split(SEP_RESPONSAVEIS).map(x => x.trim()).filter(Boolean) : [],
                linhaControle: i >= 0 ? i + 2 : -1   // linha na aba INVENTARIOS
            };
        });

    return { lista, sheetIds };
}

async function criarAba(token, fileId, titulo, cabecalho) {
    const resp = await sheetsFetch(token, `${SHEETS_API}${fileId}:batchUpdate`, {
        method: 'POST',
        body: JSON.stringify({ requests: [{ addSheet: { properties: {
            title: titulo, gridProperties: { frozenRowCount: 1 }
        } } }] })
    });
    const sheetId = resp.replies[0].addSheet.properties.sheetId;
    const ultimaCol = String.fromCharCode(64 + cabecalho.length);
    await sheetsFetch(token,
        `${SHEETS_API}${fileId}/values/${urlRange(titulo, 'A1:' + ultimaCol + '1')}?valueInputOption=RAW`,
        { method: 'PUT', body: JSON.stringify({ values: [cabecalho] }) });
    return sheetId;
}

// Cria a aba "INV <nome>" com o cabeçalho e registra na aba INVENTARIOS
// responsaveis = lista de nomes considerados neste inventário (fica gravada na coluna F)
async function criarInventario(token, fileId, nome, operador, responsaveis) {
    nome = (nome || '').toString().trim();
    if (!nome) throw new Error('Digite um nome para o inventário.');
    if (/[\[\]\*\?\/\\:]/.test(nome)) throw new Error('O nome não pode ter os caracteres [ ] * ? / \\ :');
    if (nome.length > 80) throw new Error('Nome muito longo (máximo 80 caracteres).');

    const aba = INV_PREFIXO + nome;
    const { lista, sheetIds } = await listarInventarios(token, fileId);
    if (lista.some(i => i.aba.toUpperCase() === aba.toUpperCase() || i.nome.toUpperCase() === nome.toUpperCase())) {
        throw new Error(`Já existe um inventário chamado "${nome}".`);
    }

    const sheetId = await criarAba(token, fileId, aba, CABECALHO_INV);
    // Aba de sobras do inventário (itens de outros responsáveis)
    if (sheetIds[abaSobrasDe(aba)] === undefined) {
        await criarAba(token, fileId, abaSobrasDe(aba), CABECALHO_INV);
    }

    if (sheetIds[ABA_CONTROLE_INV] === undefined) {
        await criarAba(token, fileId, ABA_CONTROLE_INV, CABECALHO_CONTROLE);
    } else {
        // abas INVENTARIOS antigas não têm o título da coluna F
        await sheetsFetch(token,
            `${SHEETS_API}${fileId}/values/${urlRange(ABA_CONTROLE_INV, 'F1')}?valueInputOption=RAW`,
            { method: 'PUT', body: JSON.stringify({ values: [[CABECALHO_CONTROLE[5]]] }) });
    }
    const listaResp = (responsaveis || []).join(SEP_RESPONSAVEIS);
    await sheetsFetch(token,
        `${SHEETS_API}${fileId}/values/${urlRange(ABA_CONTROLE_INV, 'A:F')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        { method: 'POST', body: JSON.stringify({ values: [[nome, aba, dataHoraBR(), operador || '', '', listaResp]] }) });

    return { aba, nome, sheetId, abaSobras: abaSobrasDe(aba), responsaveis: (responsaveis || []).slice() };
}

// Cria a aba de sobras de um inventário antigo, se ainda não existir.
// Devolve o sheetId da aba.
async function garantirAbaSobras(token, fileId, inv) {
    if (inv.temSobras && inv.sheetIdSobras !== undefined) return inv.sheetIdSobras;
    const { sheetIds } = await listarInventarios(token, fileId);
    let id = sheetIds[inv.abaSobras];
    if (id === undefined) id = await criarAba(token, fileId, inv.abaSobras, CABECALHO_INV);
    inv.temSobras = true;
    inv.sheetIdSobras = id;
    return id;
}

// Grava a data de conclusão na aba INVENTARIOS (cria a linha se não existir)
async function marcarInventarioConcluido(token, fileId, inv, quando) {
    quando = quando || dataHoraBR();
    if (inv.linhaControle > 0) {
        await sheetsFetch(token,
            `${SHEETS_API}${fileId}/values/${urlRange(ABA_CONTROLE_INV, 'E' + inv.linhaControle)}?valueInputOption=RAW`,
            { method: 'PUT', body: JSON.stringify({ values: [[quando]] }) });
    } else {
        const { sheetIds } = await listarInventarios(token, fileId);
        if (sheetIds[ABA_CONTROLE_INV] === undefined) {
            await criarAba(token, fileId, ABA_CONTROLE_INV, CABECALHO_CONTROLE);
        }
        await sheetsFetch(token,
            `${SHEETS_API}${fileId}/values/${urlRange(ABA_CONTROLE_INV, 'A:E')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
            { method: 'POST', body: JSON.stringify({ values: [[inv.nome, inv.aba, '', '', quando]] }) });
    }
    return quando;
}

// Linhas de um inventário (sem o cabeçalho), colunas A:J
async function lerRegistrosInventario(token, fileId, aba) {
    const d = await sheetsFetch(token, `${SHEETS_API}${fileId}/values/${urlRange(aba, 'A:J')}`);
    return (d.values || []).slice(1);
}

// Número da linha (1 = cabeçalho) de um registro, conferido AGORA na planilha.
// Procura a última linha com o mesmo NRP e sala; prefere a de mesma Data/Hora.
async function localizarLinhaRegistro(token, fileId, aba, reg) {
    const d = await sheetsFetch(token, `${SHEETS_API}${fileId}/values/${urlRange(aba, 'A:G')}`);
    const valores = d.values || [];
    const mesmaSala = (a, b) => (a || '').toString().trim().toUpperCase() === (b || '').toString().trim().toUpperCase();
    let porNrpSala = -1;
    for (let i = valores.length - 1; i >= 1; i--) {
        const row = valores[i] || [];
        if (!nrpIgual(row[0], reg.NRP) || !mesmaSala(row[2], reg.Localização)) continue;
        if ((row[6] || '') === (reg.dataHora || '')) return i + 1;
        if (porNrpSala < 0) porNrpSala = i + 1;
    }
    return porNrpSala;
}

// ══════════════════════════════════════════════════════
//  REGRA DE CONCLUSÃO DO INVENTÁRIO
//  Um inventário está concluído quando TODOS estes itens foram bipados:
//   • itens da SIGMAS cujo responsável está na lista de responsáveis (aba CONFIG)
//   • itens da aba COAUD (mesmo que a SIGMAS esteja divergente)
//  (usa ehResponsavelCoaud do coaud-regras.js)
// ══════════════════════════════════════════════════════
function normNRPInv(nrp) {
    return (nrp === undefined || nrp === null ? '' : nrp.toString())
        .replace(/\./g, '').replace(/^0+/, '').trim();
}

// sigmasRows / coaudRows SEM o cabeçalho. Devolve Map(nrp → linha)
// lista (opcional) = responsáveis a considerar; sem ela, usa a lista atual (aba CONFIG)
function itensExigidosParaConcluir(sigmasRows, coaudRows, lista) {
    const exigidos = new Map();
    (sigmasRows || []).forEach(r => {
        const n = r && normNRPInv(r[0]);
        if (n && ehResponsavelCoaud(r[3], lista)) exigidos.set(n, r);
    });
    (coaudRows || []).forEach(r => {
        const n = r && normNRPInv(r[0]);
        if (n) exigidos.set(n, r);
    });
    return exigidos;
}

// Linhas exigidas que ainda não foram bipadas (nrpsInventario = Set de NRPs normalizados)
function pendentesParaConcluir(exigidos, nrpsInventario) {
    const pend = [];
    exigidos.forEach((row, n) => { if (!nrpsInventario.has(n)) pend.push(row); });
    return pend;
}


// ══════════════════════════════════════════════════════
//  SINCRONIZAR A ABA COAUD COM A LISTA DE RESPONSÁVEIS
//  Usado quando um novo inventário muda os responsáveis:
//   • ENTRAM na COAUD os itens da SIGMAS dos responsáveis da lista
//     que ainda não estão lá
//   • SAEM da COAUD os itens cujo responsável não está na lista
//  A SIGMAS nunca é alterada.
// ══════════════════════════════════════════════════════
function previaSincronizacaoCoaud(sigmasRows, coaudRows, lista) {
    const naCoaud = new Set((coaudRows || []).map(r => r && normNRPInv(r[0])).filter(Boolean));
    const vistos  = new Set();
    const adicionar = (sigmasRows || []).filter(r => {
        const n = r && normNRPInv(r[0]);
        if (!n || naCoaud.has(n) || vistos.has(n) || !ehResponsavelCoaud(r[3], lista)) return false;
        vistos.add(n);
        return true;
    });
    const remover = (coaudRows || []).filter(r => r && normNRPInv(r[0]) && !ehResponsavelCoaud(r[3], lista));
    return { adicionar, remover };
}

// Aplica a sincronização relendo SIGMAS e COAUD AGORA (não usa dados antigos da memória).
// Devolve { adicionados, removidos }.
async function aplicarSincronizacaoCoaud(token, fileId, lista, textoLog) {
    const meta = await sheetsFetch(token, `${SHEETS_API}${fileId}?fields=sheets.properties(title,sheetId)`);
    const coaud = (meta.sheets || []).map(x => x.properties).find(p => p.title === 'COAUD');
    if (!coaud) throw new Error('Aba COAUD não encontrada.');

    const q = ['SIGMAS!A:D', 'COAUD!A:D'].map(r => 'ranges=' + encodeURIComponent(r)).join('&');
    const d = await sheetsFetch(token, `${SHEETS_API}${fileId}/values:batchGet?${q}`);
    const vr = d.valueRanges || [];
    const sigmas = ((vr[0] && vr[0].values) || []).slice(1);
    const coaudLinhas = ((vr[1] && vr[1].values) || []);   // com cabeçalho (índice = linha - 1)

    // Linhas a apagar (de baixo para cima, numa só operação)
    const apagar = [];
    for (let i = coaudLinhas.length - 1; i >= 1; i--) {
        const r = coaudLinhas[i] || [];
        if (normNRPInv(r[0]) && !ehResponsavelCoaud(r[3], lista)) apagar.push(i);
    }
    if (apagar.length) {
        await sheetsFetch(token, `${SHEETS_API}${fileId}:batchUpdate`, {
            method: 'POST',
            body: JSON.stringify({ requests: apagar.map(i => ({ deleteDimension: { range: {
                sheetId: coaud.sheetId, dimension: 'ROWS', startIndex: i, endIndex: i + 1 } } })) })
        });
    }

    const { adicionar } = previaSincronizacaoCoaud(sigmas, coaudLinhas.slice(1), lista);
    if (adicionar.length) {
        const log = textoLog || ('entrou na COAUD pela lista de responsáveis em ' + dataHoraBR());
        await sheetsFetch(token,
            `${SHEETS_API}${fileId}/values/${urlRange('COAUD', 'A:E')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
            { method: 'POST', body: JSON.stringify({ values: adicionar.map(r => [r[0] || '', r[1] || '', r[2] || '', r[3] || '', log]) }) });
    }
    return { adicionados: adicionar.length, removidos: apagar.length };
}