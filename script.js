// ══════════════════════════════════════════════════════
//  COAUD — script.js (v4)
// ══════════════════════════════════════════════════════
//
//  REGRAS DE OURO deste arquivo (aprendidas na prática):
//
//  • LEITURA (login, ping) → HEDGING: tentativas paralelas
//    escalonadas, a primeira que responder vence. Rápido e
//    imune ao 404 intermitente do Apps Script.
//
//  • ESCRITA (trocarSenha) → SINGLE-FLIGHT: UMA requisição
//    por vez. Hedging em escrita cria briga pelo Lock no
//    servidor e você mesmo vira o gargalo (foi o bug da v3).
//
//  • ESCRITA QUE "FALHOU" pode ter funcionado (resposta
//    perdida). A recuperação não é retentar às cegas: é
//    VERIFICAR — tenta logar com a senha nova; se entra,
//    a troca foi aplicada e seguimos como sucesso.
// ══════════════════════════════════════════════════════

const AUTH_URL = 'https://script.google.com/macros/s/AKfycbwAIg5XQiQQPDcfWYUgI-sRX51qlVpcSD6X7uE3z6-PjTDrdpE2MB7mTIfsPFFKsBed/exec';

const CLIENT_ID = '286050228811-cv6vsd075480anb1i6auuc421enuaf8q.apps.googleusercontent.com';

const PERMISSOES = {
    supervisor:   ['scanSystem', 'compareSystem', 'locateSystem', 'almoxarifadoSystem'],
    almoxarifado: ['almoxarifadoSystem'],
};

// Leitura (hedged): tentativas em 0ms, 2.5s e 8s
const HEDGE_LEITURA = { delays: [0, 2500, 8000], timeoutTentativa: 20000, timeoutTotal: 30000 };
// Escrita (single-flight): 1 tentativa, timeout generoso
const UNICO_ESCRITA = { delays: [0],             timeoutTentativa: 30000, timeoutTotal: 32000 };

let tokenClient;
let accessToken      = null;
let usuarioPendente  = null;
let authPromise      = null;
let loginEmAndamento = false;

// ══ localStorage seguro ════════════════════════════════
function lerJSON(chave) {
    try {
        return JSON.parse(localStorage.getItem(chave));
    } catch {
        localStorage.removeItem(chave);
        return null;
    }
}

// ══ Uma tentativa individual ═══════════════════════════
async function tentarAuth(acao, dados, controller, rotulo, timeoutMs) {
    const t0 = Date.now();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const resp = await fetch(AUTH_URL, {
            method: 'POST',
            mode: 'cors',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ acao, ...dados }),
            signal: controller.signal
        });
        console.log(`◀ ${rotulo} respondeu em ${Date.now() - t0}ms (HTTP ${resp.status})`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return await resp.json();
    } finally {
        clearTimeout(timer);
    }
}

// ══ Orquestrador: dispara tentativas conforme `delays`.
//    delays=[0] → single-flight; vários → hedging.
//    Primeira resposta OK vence e aborta as demais. ══════
function chamarAuth(acao, dados, opcoes = HEDGE_LEITURA) {
    const { delays, timeoutTentativa, timeoutTotal } = opcoes;

    return new Promise((resolve, reject) => {
        const controllers = [];
        const timers = [];
        let encerrado = false;
        let agendadas = delays.length; // ainda não disparadas
        let pendentes = 0;             // disparadas sem resposta
        let ultimoErro = null;
        let seq = 0;

        const encerrar = (fn, valor) => {
            if (encerrado) return;
            encerrado = true;
            timers.forEach(clearTimeout);
            controllers.forEach(c => c.abort()); // cancela perdedoras
            fn(valor);
        };

        const talvezRejeitar = () => {
            if (!encerrado && pendentes === 0 && agendadas === 0) {
                encerrar(reject, ultimoErro || new Error('Sem resposta do servidor.'));
            }
        };

        const disparar = () => {
            if (encerrado) return;
            agendadas--;
            pendentes++;
            seq++;
            const controller = new AbortController();
            controllers.push(controller);
            const rotulo = `chamarAuth(${acao})#${seq}`;
            console.log(`▶ ${rotulo} disparada`);

            tentarAuth(acao, dados, controller, rotulo, timeoutTentativa)
                .then(json => encerrar(resolve, json))
                .catch(err => {
                    pendentes--;
                    if (err.name === 'AbortError') {
                        if (!encerrado) {
                            ultimoErro = ultimoErro || new Error('Tempo de resposta esgotado.');
                            console.warn(`⏱️ ${rotulo} estourou o tempo (${timeoutTentativa}ms)`);
                        }
                    } else {
                        ultimoErro = err;
                        console.warn(`⚠️ ${rotulo} falhou:`, err.message);
                    }
                    talvezRejeitar();
                });
        };

        delays.forEach(d => timers.push(setTimeout(disparar, d)));

        timers.push(setTimeout(() => {
            encerrar(reject, ultimoErro || new Error('Servidor demorou demais para responder.'));
        }, timeoutTotal));
    });
}

// ══ Recuperação de escrita: a troca "falhou" no cliente,
//    mas pode ter sido aplicada. Verifica logando com a
//    senha nova (leitura rápida, hedged). ════════════════
async function verificarTrocaAplicada(ponto, novaSenha) {
    console.log('🔎 trocarSenha sem resposta — verificando se foi aplicada...');
    try {
        const check = await chamarAuth('login', { ponto, senha: novaSenha }, HEDGE_LEITURA);
        if (check.ok && !check.primeiroAcesso) {
            console.log('✓ Verificação confirmou: senha nova já está valendo.');
            return { ok: true, mensagem: 'Confirmado por verificação.' };
        }
        return { ok: false, erro: 'Não foi possível salvar a senha. Tente novamente.' };
    } catch (e) {
        return { ok: false, erro: 'Sem resposta do servidor: ' + e.message };
    }
}

// ══ Feedback progressivo ═══════════════════════════════
function iniciarStatusProgressivo(msgEl, textoInicial) {
    if (!msgEl) return () => {};
    msgEl.textContent = textoInicial;
    const fases = [
        [4000,  textoInicial + ' Isso pode levar alguns segundos...'],
        [10000, 'O servidor está acordando, quase lá...'],
        [20000, 'Conexão lenta hoje — segurando firme, aguarde...']
    ];
    const timers = fases.map(([t, txt]) =>
        setTimeout(() => { msgEl.textContent = txt; }, t)
    );
    return () => timers.forEach(clearTimeout);
}

// ══ Warm-up: GET + POST ping ═══════════════════════════
function aquecerServidor(motivo) {
    console.log(`♨️ Warm-up (${motivo})`);
    fetch(AUTH_URL, { method: 'GET', mode: 'cors', redirect: 'follow' })
        .then(r => console.log('✓ Warm-up GET:', r.status))
        .catch(e => console.warn('⚠️ Warm-up GET falhou:', e.message));

    fetch(AUTH_URL, {
        method: 'POST',
        mode: 'cors',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ acao: 'ping' })
    })
        .then(r => console.log('✓ Warm-up POST(ping):', r.status))
        .catch(e => console.warn('⚠️ Warm-up POST falhou (o hedging cobre):', e.message));
}

// ══ Sistemas visíveis conforme permissão ═══════════════
function configurarSistemas(permissao) {
    console.log(`✓ configurarSistemas("${permissao}")`);
    const todos = ['scanSystem', 'compareSystem', 'locateSystem', 'almoxarifadoSystem'];
    const liberados = PERMISSOES[permissao] || [];

    if (liberados.length === 0) {
        console.error(`❌ Permissão "${permissao}" não encontrada em PERMISSOES!`);
    }

    todos.forEach(id => {
        const el = document.getElementById(id);
        if (!el) {
            console.warn(`⚠️ Botão #${id} não existe no HTML`);
            return;
        }
        el.style.display = liberados.includes(id) ? 'flex' : 'none';
    });
}

// ══ Entrar no sistema ══════════════════════════════════
function entrarNoSistema(nome, permissao) {
    console.log(`✓ entrarNoSistema: nome="${nome}" permissao="${permissao}"`);

    localStorage.setItem('usuarioLogado', JSON.stringify({ nome, permissao }));
    localStorage.setItem('access_token', accessToken);

    const loginEl   = document.getElementById('login-container');
    const systemsEl = document.getElementById('systems-container');
    const nomeEl    = document.getElementById('nome-usuario');

    if (loginEl)   loginEl.style.display   = 'none';
    if (systemsEl) systemsEl.style.display = 'block';
    if (nomeEl)    nomeEl.textContent      = nome;

    configurarSistemas(permissao);
}

// ══ Modal de primeira senha ════════════════════════════
function pedirNovaSenha() {
    return new Promise(resolve => {
        document.getElementById('modal-nova-senha')?.remove();
        const modal = document.createElement('div');
        modal.id = 'modal-nova-senha';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:1000;display:flex;align-items:center;justify-content:center';
        modal.innerHTML = `
            <div style="background:#1a2a1a;border:1px solid rgba(0,176,79,0.25);border-radius:12px;padding:28px 32px;width:320px;box-shadow:0 8px 32px rgba(0,0,0,0.5)">
                <h3 style="margin:0 0 8px;font-size:14px;color:#00b04f">Primeiro acesso</h3>
                <p style="font-size:12px;color:rgba(255,255,255,0.5);margin:0 0 16px">Crie sua senha pessoal (mínimo 6 caracteres).</p>
                <input type="password" id="nova-senha-1" placeholder="Nova senha" style="width:100%;padding:9px 12px;border:1px solid rgba(0,176,79,0.2);border-radius:4px;font-size:13px;background:rgba(0,0,0,0.3);color:#e8f5ec;font-family:inherit;margin-bottom:10px">
                <input type="password" id="nova-senha-2" placeholder="Confirme a senha" style="width:100%;padding:9px 12px;border:1px solid rgba(0,176,79,0.2);border-radius:4px;font-size:13px;background:rgba(0,0,0,0.3);color:#e8f5ec;font-family:inherit;margin-bottom:12px">
                <p id="msg-nova-senha" style="font-size:12px;color:#f87171;min-height:16px;margin:0 0 12px"></p>
                <div style="display:flex;gap:8px;justify-content:flex-end">
                    <button id="btn-cancelar-senha" style="background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.6);border:1px solid rgba(255,255,255,0.12);padding:8px 16px;border-radius:4px;cursor:pointer;font-size:12px;font-family:inherit">Cancelar</button>
                    <button id="btn-confirmar-senha" style="background:#00b04f;color:#fff;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit">Confirmar</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        document.getElementById('btn-cancelar-senha').onclick = () => { modal.remove(); resolve(null); };
        document.getElementById('btn-confirmar-senha').onclick = () => {
            const s1 = document.getElementById('nova-senha-1').value;
            const s2 = document.getElementById('nova-senha-2').value;
            const err = document.getElementById('msg-nova-senha');
            if (s1.length < 6) { err.textContent = 'Mínimo 6 caracteres.'; return; }
            if (s1 !== s2)     { err.textContent = 'As senhas não coincidem.'; return; }
            modal.remove(); resolve(s1);
        };
        document.getElementById('nova-senha-2').addEventListener('keydown', e => {
            if (e.key === 'Enter') document.getElementById('btn-confirmar-senha').click();
        });
    });
}

// ══ Fluxo pós-OAuth ════════════════════════════════════
async function aposOAuth() {
    const msg = document.getElementById('loginMessage');
    if (!usuarioPendente) {
        console.warn('⚠️ aposOAuth chamado sem usuarioPendente');
        loginEmAndamento = false;
        return;
    }

    const { ponto, senha } = usuarioPendente;
    let pararStatus = () => {};

    try {
        pararStatus = iniciarStatusProgressivo(msg, 'Verificando credenciais...');

        const resultado = authPromise
            ? await authPromise
            : await chamarAuth('login', { ponto, senha }, HEDGE_LEITURA);

        pararStatus();
        console.log('◀ Resposta login:', JSON.stringify(resultado));

        if (!resultado.ok) {
            if (msg) msg.textContent = resultado.erro || 'Falha ao autenticar.';
            return;
        }

        if (resultado.primeiroAcesso) {
            console.log('▶ Primeiro acesso: pedindo nova senha');
            const novaSenha = await pedirNovaSenha();
            if (!novaSenha) return;

            pararStatus = iniciarStatusProgressivo(msg, 'Salvando sua nova senha...');

            // ★ ESCRITA: single-flight. Se não vier resposta,
            // NÃO retenta às cegas — verifica se foi aplicada.
            let troca;
            try {
                troca = await chamarAuth('trocarSenha', { ponto, novaSenha }, UNICO_ESCRITA);
            } catch (e) {
                if (msg) msg.textContent = 'Confirmando alteração...';
                troca = await verificarTrocaAplicada(ponto, novaSenha);
            }
            pararStatus();

            if (!troca.ok) {
                if (msg) msg.textContent = 'Erro ao salvar senha: ' + (troca.erro || '');
                return;
            }
            if (msg) msg.textContent = '✅ Senha definida! Entrando...';
        }

        entrarNoSistema(resultado.nome, resultado.permissao);

    } catch (error) {
        console.error('❌ Erro em aposOAuth:', error);
        if (msg) msg.textContent = 'Erro: ' + error.message + ' — tente novamente.';
    } finally {
        pararStatus();
        usuarioPendente  = null;
        authPromise      = null;
        loginEmAndamento = false;
    }
}

// ══ Iniciar login ══════════════════════════════════════
function iniciarLogin() {
    if (loginEmAndamento) {
        console.warn('⚠️ Login já em andamento, ignorando clique duplo');
        return;
    }

    const pontoEl = document.getElementById('username');
    const senhaEl = document.getElementById('password');
    const msg     = document.getElementById('loginMessage');

    if (!pontoEl || !senhaEl) return;
    const ponto = pontoEl.value.replace(/\D/g, '');
    const senha = senhaEl.value.trim();

    if (!ponto || !senha) {
        if (msg) msg.textContent = 'Informe seu número de ponto e senha.';
        return;
    }

    if (!tokenClient) {
        if (msg) msg.textContent = 'Aguardando Google carregar...';
        return;
    }

    loginEmAndamento = true;
    if (msg) msg.textContent = 'Autenticando...';
    usuarioPendente = { ponto, senha };

    console.log('▶ Login iniciado, disparando OAuth + Auth (hedged) em paralelo');
    authPromise = chamarAuth('login', { ponto, senha }, HEDGE_LEITURA)
        .catch(err => ({ ok: false, erro: err.message }));
    tokenClient.requestAccessToken({ prompt: '' });
}

// ══ Logout ═════════════════════════════════════════════
function fazerLogout() {
    localStorage.removeItem('usuarioLogado');
    localStorage.removeItem('access_token');
    localStorage.removeItem('token_expira_em');
    accessToken      = null;
    usuarioPendente  = null;
    authPromise      = null;
    loginEmAndamento = false;

    const loginEl   = document.getElementById('login-container');
    const systemsEl = document.getElementById('systems-container');
    const pontoEl   = document.getElementById('username');
    const senhaEl   = document.getElementById('password');
    const msg       = document.getElementById('loginMessage');

    if (loginEl)   loginEl.style.display   = 'block';
    if (systemsEl) systemsEl.style.display = 'none';
    if (pontoEl)   pontoEl.value           = '';
    if (senhaEl)   senhaEl.value           = '';
    if (msg)       msg.textContent         = '';

    aquecerServidor('logout');
}

// ══ Inicialização ══════════════════════════════════════
window.addEventListener('load', () => {

    aquecerServidor('page load');

    const loginBtn  = document.getElementById('loginButton');
    const senhaEl   = document.getElementById('password');
    const logoutBtn = document.getElementById('logoutButton');

    if (loginBtn)  loginBtn.addEventListener('click', iniciarLogin);
    if (senhaEl) {
        senhaEl.addEventListener('keydown', e => { if (e.key === 'Enter') iniciarLogin(); });
        senhaEl.addEventListener('focus', () => aquecerServidor('focus senha'), { once: true });
    }
    if (logoutBtn) logoutBtn.addEventListener('click', fazerLogout);

    const inicializarGoogle = () => {
        if (typeof google === 'undefined' || !google.accounts) {
            setTimeout(inicializarGoogle, 300);
            return;
        }
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email',
            callback: async (tokenResponse) => {
                if (tokenResponse.error) {
                    const msg = document.getElementById('loginMessage');
                    if (msg) msg.textContent = 'Erro Google: ' + tokenResponse.error;
                    loginEmAndamento = false;
                    return;
                }
                accessToken = tokenResponse.access_token;
                localStorage.setItem('access_token', accessToken);
                const expiraEm = Date.now() + (Number(tokenResponse.expires_in) || 3600) * 1000;
                localStorage.setItem('token_expira_em', String(expiraEm));
                await aposOAuth();
            }
        });
    };
    inicializarGoogle();

    // ── Sessão salva (valida expiração do token) ────────
    const usuarioLogado = lerJSON('usuarioLogado');
    const savedToken    = localStorage.getItem('access_token');
    const expiraEm      = Number(localStorage.getItem('token_expira_em') || 0);
    const tokenValido   = savedToken && Date.now() < expiraEm - 60000;

    if (usuarioLogado && tokenValido) {
        console.log('✓ Sessão salva encontrada:', usuarioLogado);
        accessToken = savedToken;
        const loginEl   = document.getElementById('login-container');
        const systemsEl = document.getElementById('systems-container');
        const nomeEl    = document.getElementById('nome-usuario');
        if (loginEl)   loginEl.style.display   = 'none';
        if (systemsEl) systemsEl.style.display = 'block';
        if (nomeEl)    nomeEl.textContent      = usuarioLogado.nome || '';
        configurarSistemas(usuarioLogado.permissao);
    } else {
        if (usuarioLogado && !tokenValido) {
            console.log('⚠️ Token expirado — exigindo novo login');
            localStorage.removeItem('access_token');
            localStorage.removeItem('token_expira_em');
        }
        const loginEl = document.getElementById('login-container');
        if (loginEl) loginEl.style.display = 'block';
    }
});