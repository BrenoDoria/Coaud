// ══════════════════════════════════════════════════════
//  COAUD — coaud-sessao.js
//  Sessão ASSINADA pelo servidor de login (Apps Script v7).
//
//  • No login, o servidor devolve um "crachá" (sessao_coaud) com
//    ponto, nome, permissão e validade, assinado com uma chave
//    PRIVADA que só existe no servidor.
//  • Cada página confere a assinatura com a chave PÚBLICA abaixo.
//    Crachá alterado, vencido ou ausente → sai do sistema.
//  • A permissão que as páginas leem em 'usuarioLogado' passa a vir
//    SEMPRE do crachá conferido (editar o localStorage não adianta).
//
//  Este arquivo precisa ser o PRIMEIRO script de cada página.
// ══════════════════════════════════════════════════════

const CHAVE_PUBLICA_SESSAO = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2j0zFOs2QsFBUppR3bM9U9bOQMQOl3QBUhDHusM5Y1iy3bJdXLS3cogIQTSDtxwHd4jyQrBh1U2me87ccFIuU1D4T5G0gVvekC6OFpkOtWJPXxZhGqY-yfz0PSOtnAvenzrfpZUSCPRx3pyZWo5XmwgFRQc_VhlbWqUhrL9JPUGMPdy1FF9nSQzp9BnpiSIQgF2m-LXRCsx4ek4CCcXNpMWXOp8D7lVZrMNsU859zZRRmd7ml6pheK8twskQuKg_dHDTy2265vrvkQqTpQ5G_OElDWwJdYApwSa3Osxiu7euKDGfeVs4Yn6ND1GJGB-MWn-HKj2iW4QnWaEaLqB1fwIDAQAB';
const CHAVE_SESSAO = 'sessao_coaud';

let USUARIO_SESSAO = null;   // usuário vindo do crachá (null = ainda não conferido)

function _b64urlParaBytes(txt) {
    const b64 = txt.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((txt.length + 3) % 4);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

// Lê o crachá SEM conferir a assinatura (a conferência vem logo depois)
function lerSessaoCoaud() {
    const t = Storage.prototype._getItemOriginal
        ? Storage.prototype._getItemOriginal.call(localStorage, CHAVE_SESSAO)
        : localStorage.getItem(CHAVE_SESSAO);
    if (!t || t.indexOf('.') < 0) return null;
    const [p, s] = t.split('.');
    try {
        const payload = JSON.parse(new TextDecoder().decode(_b64urlParaBytes(p)));
        return { p, s, payload };
    } catch (e) { return null; }
}

// Confere a assinatura e a validade. Devolve { ok, usuario } ou { ok:false, motivo }
async function verificarSessaoCoaud() {
    const ses = lerSessaoCoaud();
    if (!ses) return { ok: false, motivo: 'sem sessão' };
    if (!ses.payload.exp || ses.payload.exp * 1000 < Date.now()) return { ok: false, motivo: 'sessão vencida' };
    try {
        const chave = await crypto.subtle.importKey('spki', _b64urlParaBytes(CHAVE_PUBLICA_SESSAO),
            { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
        const valida = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', chave,
            _b64urlParaBytes(ses.s), new TextEncoder().encode(ses.p));
        if (!valida) return { ok: false, motivo: 'assinatura inválida' };
    } catch (e) {
        return { ok: false, motivo: 'não foi possível conferir a sessão' };
    }
    const u = { nome: ses.payload.n, permissao: ses.payload.perm, ponto: ses.payload.p, email: ses.payload.e || '' };
    return { ok: true, usuario: u };
}

function _estaNoPortal() {
    const pagina = window.location.pathname.split('/').pop();
    return pagina === '' || pagina === 'index.html' || pagina === 'index';
}

function sairPorSessaoInvalida(motivo) {
    console.warn('Sessão inválida:', motivo);
    USUARIO_SESSAO = null;
    ['usuarioLogado', 'access_token', 'token_expira_em', CHAVE_SESSAO].forEach(k => localStorage.removeItem(k));
    if (!_estaNoPortal()) window.location.replace('index.html');
}

// ── 'usuarioLogado' passa a vir do crachá conferido ──────
// Qualquer leitura de localStorage.getItem('usuarioLogado') devolve o
// usuário do crachá; editar o texto no navegador não muda a permissão.
// Apagar 'usuarioLogado' (Sair) também apaga o crachá.
(function () {
    if (Storage.prototype._getItemOriginal) return;   // já instalado
    const getOriginal = Storage.prototype.getItem;
    const removeOriginal = Storage.prototype.removeItem;
    Storage.prototype._getItemOriginal = getOriginal;
    Storage.prototype.getItem = function (k) {
        if (this === window.localStorage && k === 'usuarioLogado' && USUARIO_SESSAO) {
            return JSON.stringify({ nome: USUARIO_SESSAO.nome, permissao: USUARIO_SESSAO.permissao });
        }
        return getOriginal.call(this, k);
    };
    Storage.prototype.removeItem = function (k) {
        if (this === window.localStorage && k === 'usuarioLogado') {
            removeOriginal.call(this, CHAVE_SESSAO);
            USUARIO_SESSAO = null;
        }
        return removeOriginal.call(this, k);
    };
})();

// ── Guarda das páginas internas (o Portal se confere sozinho no script.js) ──
(function () {
    if (_estaNoPortal()) return;
    const ses = lerSessaoCoaud();
    if (!ses) { sairPorSessaoInvalida('sem sessão'); return; }
    // Enquanto confere a assinatura (milissegundos), usa os dados do crachá e esconde a página
    USUARIO_SESSAO = { nome: ses.payload.n, permissao: ses.payload.perm, ponto: ses.payload.p, email: ses.payload.e || '' };
    document.documentElement.style.visibility = 'hidden';
    verificarSessaoCoaud()
        .then(r => {
            if (!r.ok) { sairPorSessaoInvalida(r.motivo); return; }
            USUARIO_SESSAO = r.usuario;
            document.documentElement.style.visibility = '';
        })
        .catch(() => sairPorSessaoInvalida('erro ao conferir'));
})();
