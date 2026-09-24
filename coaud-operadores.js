// ══════════════════════════════════════════════════════
//  COAUD — coaud-operadores.js
//  Lista de OPERADORES do Almoxarifado (nome + ponto)
//  Fonte: aba "OPERADORES" da planilha do almoxarifado
//         (colunas: Nome | Ponto | Ativo)
//  • Nova Retirada / Fichas Pendentes → lista de nomes ATIVOS
//  • Impressões                       → ponto de cada nome
//  Se a aba não puder ser lida, usa a lista reserva abaixo.
// ══════════════════════════════════════════════════════

const ABA_OPERADORES   = 'OPERADORES';
const CAB_OPERADORES   = ['Nome', 'Ponto', 'Ativo'];
const CACHE_OPERADORES = 'coaud_operadores';

// Lista reserva = lista que estava no código até agora.
// [nome, ponto, ativo]  (ativo=false: não aparece na lista de retirada,
//                        mas o ponto continua saindo nas impressões antigas)
const OPERADORES_RESERVA = [
    ["Adson Miranda dos Anjos", "914.262", true],
    ["Afonso Viana de Mesquita Filho", "5.947", true],
    ["Alberto Cesar Souza Almeida", "5.302", true],
    ["Alexander Rafael Carvalho Paim", "882.420", true],
    ["Alison Silva de Oliveira", "914.799", true],
    ["Allan Cosseti Ardisson", "919.895", true],
    ["Ana Clara Cardoso de Oliveira", "92444", true],
    ["Altamir Araujo da Silva", "881.758", true],
    ["Antonio Batista Ângelo", "999.134", true],
    ["Antonio Rodrigues Siqueira Filho", "917.486", true],
    ["Arley Carvalho Alves", "915.546", true],
    ["Breno Doria Felicio", "922.083", true],
    ["Bruno Fernandes Braga", "881.842", true],
    ["Bruno Rodrigues do Prado", "919.894", true],
    ["Bruno Vieira Rodrigues", "922.084", true],
    ["Carlos Cesar José da Silva", "920.074", true],
    ["Carlos Eduardo Guedes da Silva", "882.174", true],
    ["Carlos Roberto de Paiva Miranda dos Santos", "922.498", true],
    ["Cinthia Neves Carvalho Barbosa", "5.476", true],
    ["Claudio Marcelo do Nascimento", "882.421", true],
    ["Daniel Deluze Braga", "", true],
    ["Davi Aragão de Paula Gonçalves", "921.627", true],
    ["Douglas Batista da Silva", "920.077", true],
    ["Emmanuel do Amaral Idelfonso", "920.076", true],
    ["Emanuel Silveira Costa", "922.931", true],
    ["Eric Samuel do Ouro", "920.359", true],
    ["Erika Fedosseeff Auler", "921.672", true],
    ["Eromilson Monteiro dutra Chaves", "882.134", true],
    ["Evellyn Mendes de Souza Nunes", "915.974", true],
    ["Felipe Omena Vasconcellos de Assis", "919.593", true],
    ["Fernando de Sousa Vasconcelos", "914.382", true],
    ["Flavio Lima Camara", "882.218", true],
    ["Francisco de Assis da Silva Sales", "888.744", true],
    ["Francisco de Sousa Filho", "5.953", true],
    ["Francisco Juniel Sousa E Silva", "915.547", true],
    ["Geraldo Ribeiro de Souza Filho", "888.010", true],
    ["Gildo Marques da Silva", "920.092", true],
    ["Gilson Gomes da Silva", "882.541", true],
    ["Gleisson Carlos Pereira da Silva", "914.815", true],
    ["Guilherme Malheiro da Rocha Pinto", "4.224", true],
    ["Helisson Rafael de O. Leite", "881.759", true],
    ["Helyeber Feitosa Ferreira", "919.899", true],
    ["Hilton Severiano Ferreira", "922.678", true],
    ["Huelisson Amancio de Moraes Silva", "881.596", true],
    ["Igor Mendes dos Santos", "921.292", true],
    ["Isaias Pereira Soares", "919.903", true],
    ["Joel Luiz de Sá Silva", "920.353", true],
    ["Joel Pereira Santos", "882.652", true],
    ["Jônatas Soares de Andrade", "881.598", true],
    ["Jose Henrique Ferreira da Silva", "7.913", true],
    ["Jose Leandro Marques", "", true],
    ["José Nilton Abraão de Sousa", "920.352", true],
    ["Josue Cardoso Abreu", "", true],
    ["Joval Bastos Freitas Júnior", "882.702", true],
    ["Juliano Gustavo Pedro de Oliveira", "882.053", true],
    ["Kely Berlinck Freire", "919.896", true],
    ["Kleber de Araújo Moura", "888.397", true],
    ["Leandro Calixto da Silva", "917.992", true],
    ["Leandro Silva Lima Alves", "921.291", true],
    ["Leonardo Augusto de Freitas", "882.688", true],
    ["Letícia Santana Araújo", "920.816", true],
    ["Lívia Maria de Souza", "916.391", true],
    ["Lucas Lima Lira", "919.897", true],
    ["Lucas Ribeiro dos Santos", "919.904", true],
    ["Luciano de Freitas Silva", "881.452", true],
    ["Luiz Henrique Reis de Lima", "888.226", true],
    ["Marcelo Gomes da Silva", "918.923", true],
    ["Marco Antonio Baldresca Lambert de Brito", "5.261", true],
    ["Marco Antônio Felício Júnior", "915.553", true],
    ["Marcos Murilo Antunes", "", true],
    ["Marcos Borges de Souza", "920.075", true],
    ["Marcus Aurélius Fernandes de Moura", "888.219", true],
    ["Massilon Alves de Sousa Filho", "919.905", true],
    ["Mateus da Silva Lima", "922.278", true],
    ["Matheus Gabriel Damasceno Dias", "920.354", true],
    ["Matheus Henrique Felix Barbosa", "922.082", true],
    ["Múcio Homero Rocha Pires de Oliveira", "5.297", true],
    ["Orlando Villavicencio Venegas", "882.673", true],
    ["Otoniel Alves de Souza", "", true],
    ["Paulo Fernando Volpe", "5.933", true],
    ["Paulo Roberto Pereira", "888.227", true],
    ["Paulo Soares da Costa", "888.228", true],
    ["Pedro Henrique Candido Boaventura", "920.124", true],
    ["Péricles Cruz da Silva", "881.892", true],
    ["Rafael Queiroz Lemos de Oliveira", "881.782", true],
    ["Reynaldo Jesse Rodrigues da Silva", "888.131", true],
    ["Robson da Silva Ferreira", "924.692", true],
    ["Ronaldo Jovino da Silva", "919.185", true],
    ["Richard Rodrigues dos Santos", "921.026", true],
    ["Roberio Antunes Simionato", "5.266", true],
    ["Rondney Rodrigues Alves Sousa", "881.174", true],
    ["Rosivan Augustinho Pereira", "882.518", true],
    ["Suzana Silva de Oliveira", "917.572", true],
    ["Thiago Veríssimo Cabral Freitas", "922.497", true],
    ["Waleria Bastos Cardoso", "915.570", true],
    ["Wellington Jorge Souza Mendes", "881.179", true],
    ["Wendel Vieira da Costa", "919.907", true],
    ["Wesley Maurício Ribeiro França", "888.217", true],
    ["William Neves da Silva", "", true],
    ["Wirlem Silva Alves", "919.906", true],
    ["Alexandre Alves de Siqueira", "919.956", false],
    ["Carlos César Ferreira de Sousa", "5.250", false],
    ["Enzo Risso Conturbia", "920.438", false],
    ["Fausto Barbosa de Oliveira", "888.223", false],
    ["Gilson Gustavo de Paiva Oliveira", "5.254", false],
    ["Joilson Santos de Jesus", "920.123", false],
    ["Luis Eduardo Campos Moreira", "919.898", false],
    ["Marcelo Bruno Rezende Costa", "882.728", false],
    ["Priscilla Amorim dos Santos Rodrigues", "7.914", false],
    ["Rodrigo Fonseca Shiratori", "5.272", false],
    ["Vinícius Veríssimo Cabral Freitas", "919.796", false],
    ["Vivikananda Abdallah Antun Filho", "5.301", false],
    ["Wanderson Balzan de Sousa", "918.679", false],
    ["Wellington Rodrigo Ribeiro Santana", "882.052", false],
    ["Wesley Laécio da Silva Costa", "882.054", false],
    ["Willian Neves da Silva", "888.230", false],
    ["Lucas Farias de Menezes", "920.362", false]
];

function normNomeOp(nome) {
    return (nome || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ').trim().toUpperCase();
}

// 922083 → "922.083"   5947 → "5.947"
function formatarPonto(valor) {
    const d = (valor || '').toString().replace(/\D/g, '');
    if (!d) return '';
    return d.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function lerCacheOperadores() {
    try {
        const c = JSON.parse(localStorage.getItem(CACHE_OPERADORES));
        return c && Array.isArray(c.lista) && c.lista.length ? c : null;
    } catch { return null; }
}

function salvarCacheOperadores(lista) {
    try { localStorage.setItem(CACHE_OPERADORES, JSON.stringify({ lista, em: Date.now() })); } catch {}
}

function listaCompletaOperadores() {
    const c = lerCacheOperadores();
    if (c) return c.lista;
    return OPERADORES_RESERVA.map(([nome, ponto, ativo]) => ({ nome, ponto, ativo }));
}

// Nomes ativos, em ordem alfabética (para as listas de seleção)
function listaOperadoresAtivos() {
    return listaCompletaOperadores()
        .filter(o => o.ativo && o.nome)
        .map(o => o.nome)
        .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

// Ponto de um operador (ignora acentos e maiúsculas). '' se não achar.
function pontoDoOperador(nome) {
    const alvo = normNomeOp(nome);
    if (!alvo) return '';
    const achar = lista => lista.find(o => normNomeOp(o.nome) === alvo && o.ponto);
    const o = achar(listaCompletaOperadores()) ||
              achar(OPERADORES_RESERVA.map(([nome, ponto, ativo]) => ({ nome, ponto, ativo })));
    return o ? o.ponto : '';
}

function valorAtivo(v) {
    if (v === true) return true;
    const s = (v === undefined || v === null ? '' : v.toString()).trim().toUpperCase();
    return s === '' || s === 'TRUE' || s === 'VERDADEIRO' || s === 'SIM' || s === '1';
}

async function operadoresFetch(token, url, opcoes = {}) {
    const headers = { 'Authorization': `Bearer ${token}` };
    if (opcoes.body) headers['Content-Type'] = 'application/json';
    const r = await fetch(url, { ...opcoes, headers });
    if (r.status === 401) throw new Error('SESSAO_EXPIRADA');
    if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        const err = new Error(e.error?.message || ('HTTP ' + r.status));
        err.status = r.status;
        throw err;
    }
    return r.json();
}

// Lê a aba OPERADORES. Devolve null se a aba ainda não existir.
// Cada item: { nome, ponto, ativo, linha }  (linha = nº da linha na planilha)
async function lerOperadoresPlanilha(token, fileId) {
    try {
        const d = await operadoresFetch(token,
            `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/${ABA_OPERADORES}!A:C`);
        return (d.values || []).slice(1)
            .map((r, i) => ({
                nome: (r[0] || '').toString().trim(),
                ponto: (r[1] || '').toString().trim(),
                ativo: valorAtivo(r[2]),
                linha: i + 2
            }))
            .filter(o => o.nome);
    } catch (e) {
        if (e.status === 400) return null;   // aba não existe
        throw e;
    }
}

// Liga a lista da página à planilha: atualiza o array no lugar
// (as buscas da página passam a usar a lista nova sem recarregar)
function vincularListaOperadores(arrayDaPagina, fileId) {
    const token  = localStorage.getItem('access_token');
    const expira = parseInt(localStorage.getItem('token_expira_em') || '0', 10);
    if (!token || (expira && expira < Date.now())) return;
    lerOperadoresPlanilha(token, fileId)
        .then(lista => {
            if (!lista || !lista.length) return;
            salvarCacheOperadores(lista.map(({ nome, ponto, ativo }) => ({ nome, ponto, ativo })));
            const ativos = listaOperadoresAtivos();
            arrayDaPagina.splice(0, arrayDaPagina.length, ...ativos);
        })
        .catch(e => console.warn('Lista de operadores: usando a reserva.', e.message));
}

// Cria a aba OPERADORES já preenchida com a lista reserva
async function criarAbaOperadores(token, fileId) {
    await operadoresFetch(token, `https://sheets.googleapis.com/v4/spreadsheets/${fileId}:batchUpdate`, {
        method: 'POST',
        body: JSON.stringify({ requests: [{ addSheet: { properties: {
            title: ABA_OPERADORES, gridProperties: { frozenRowCount: 1 }
        } } }] })
    });
    const linhas = [CAB_OPERADORES].concat(OPERADORES_RESERVA.map(([n, p, a]) => [n, p, a]));
    await operadoresFetch(token,
        `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/${ABA_OPERADORES}!A1:C${linhas.length}?valueInputOption=RAW`,
        { method: 'PUT', body: JSON.stringify({ values: linhas }) });
}

async function adicionarOperadorPlanilha(token, fileId, nome, ponto) {
    await operadoresFetch(token,
        `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/${ABA_OPERADORES}!A:C:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        { method: 'POST', body: JSON.stringify({ values: [[nome, ponto, true]] }) });
}

async function atualizarOperadorPlanilha(token, fileId, linha, nome, ponto, ativo) {
    await operadoresFetch(token,
        `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/${ABA_OPERADORES}!A${linha}:C${linha}?valueInputOption=RAW`,
        { method: 'PUT', body: JSON.stringify({ values: [[nome, ponto, !!ativo]] }) });
}
