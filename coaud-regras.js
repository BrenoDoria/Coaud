// ══════════════════════════════════════════════════════
//  COAUD — coaud-regras.js
//  Regras compartilhadas entre Escaneamento e Localizador:
//   • reconhecer os responsáveis da COAUD pelo NOME
//     (ignora maiúsculas, acentos, espaços e a matrícula)
//   • conferir na planilha a linha ATUAL de um NRP antes
//     de alterar ou apagar (evita mexer na linha errada)
//
//  A lista RESPONSAVEIS_COAUD continua definida em cada página.
// ══════════════════════════════════════════════════════

// "José Henrique Ferreira da Silva (7913)" → "JOSE HENRIQUE FERREIRA DA SILVA"
function normalizarNome(nome) {
    return (nome || '').toString()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\(\s*\d+\s*\)/g, '')
        .replace(/\s+/g, ' ')
        .trim().toUpperCase();
}

// true se o responsável for Alberto, Paulo ou José Henrique (qualquer grafia)
function ehResponsavelCoaud(resp) {
    const lista = (typeof RESPONSAVEIS_COAUD !== 'undefined') ? RESPONSAVEIS_COAUD : [];
    const r = normalizarNome(resp);
    return !!r && lista.some(x => normalizarNome(x) === r);
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
