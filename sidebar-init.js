// ══════════════════════════════════════════════════════
//  COAUD — sidebar-init.js
//  Inicialização única de sidebar: usuário, permissões, tema
// ══════════════════════════════════════════════════════

// ══ PERMISSÕES ═════════════════════════════════════════
const PERMS_SIDEBAR = {
    supervisor:   ['nav-escanear', 'nav-comparador', 'nav-localizador', 'nav-almoxarifado'],
    almoxarifado: ['nav-almoxarifado'],
};

const PAGINAS_PERMISSAO = {
    'index-escanear.html':      'nav-escanear',
    'index-comparador.html':    'nav-comparador',
    'index_Local.html':         'nav-localizador',
    'index-almoxarifado.html':  'nav-almoxarifado',
    'fichas.html':              'nav-almoxarifado',
    'fichas-arquivadas.html':   'nav-almoxarifado',
    'relatorios.html':          'nav-almoxarifado',
};

// ══ USUÁRIO ═══════════════════════════════════════════
function preencherUsuarioSidebar() {
    const u = JSON.parse(localStorage.getItem('usuarioLogado'));
    if (!u) {
        window.location.href = 'index.html';
        return;
    }

    const initials = nome => nome
        ? nome.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase()
        : '?';

    const avatarEl = document.getElementById('user-avatar');
    const nameEl   = document.getElementById('user-name');
    const roleEl   = document.getElementById('user-role');

    if (avatarEl) avatarEl.textContent = initials(u.nome);
    if (nameEl)   nameEl.textContent   = u.nome || 'Usuário';
    if (roleEl)   roleEl.textContent   = u.permissao || '';
}

// ══ PERMISSÕES ═════════════════════════════════════════
function aplicarPermissoesSidebar() {
    const u = JSON.parse(localStorage.getItem('usuarioLogado')) || {};
    const perm = u.permissao;
    const liberados = PERMS_SIDEBAR[perm] || [];

    const todos = ['nav-escanear', 'nav-comparador', 'nav-localizador', 'nav-almoxarifado',];

    todos.forEach(id => {
        const el = document.getElementById(id);
        if (!el) {
            console.warn(`⚠️ Elemento com id="${id}" não encontrado na sidebar desta página.`);
            return;
        }
        if (liberados.includes(id)) {
            el.style.display = '';
        } else {
            el.style.display = 'none';
        }
    });

    // Se estiver em página sem permissão, redireciona
    const paginaAtual = window.location.pathname.split('/').pop();
    const permNecessaria = PAGINAS_PERMISSAO[paginaAtual];
    if (permNecessaria && !liberados.includes(permNecessaria)) {
        alert('Você não tem permissão para acessar esta página.');
        window.location.href = 'index.html';
    }
}

// ══ TEMA ═══════════════════════════════════════════════
function aplicarTema(tema) {
    document.documentElement.setAttribute('data-tema', tema);
    localStorage.setItem('tema-coaud', tema);
}

function carregarTemaSalvo() {
    const tema = localStorage.getItem('tema-coaud') || 'verde-neon';
    document.documentElement.setAttribute('data-tema', tema);
}

function criarSeletorTema() {
    // Só adiciona se não existir e tiver sidebar
    if (document.getElementById('theme-selector')) return;
    const footer = document.querySelector('.sidebar-footer');
    if (!footer) return;

    const container = document.createElement('div');
    container.id = 'theme-selector';
    container.style.cssText = 'margin-bottom:8px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08)';
    container.innerHTML = `
        <div style="font-size:9px;font-weight:700;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px">
            Tema
        </div>
        <div style="display:flex;gap:5px">
            <button class="theme-btn" data-tema="verde-neon"
                title="Verde Neon" style="flex:1;padding:5px;border-radius:3px;border:1px solid rgba(255,255,255,.15);background:linear-gradient(135deg,#0a2d17 50%,#00b04f 50%);cursor:pointer;height:22px"></button>
            <button class="theme-btn" data-tema="dark-neutro"
                title="Dark Neutro" style="flex:1;padding:5px;border-radius:3px;border:1px solid rgba(255,255,255,.15);background:linear-gradient(135deg,#1e1e1e 50%,#4a90e2 50%);cursor:pointer;height:22px"></button>
            <button class="theme-btn" data-tema="claro"
                title="Claro" style="flex:1;padding:5px;border-radius:3px;border:1px solid rgba(255,255,255,.15);background:linear-gradient(135deg,#f5f5f5 50%,#1e6b2e 50%);cursor:pointer;height:22px"></button>
        </div>
    `;
    footer.parentNode.insertBefore(container, footer);

    // Marca ativo
    const temaAtivo = localStorage.getItem('tema-coaud') || 'verde-neon';
    container.querySelectorAll('.theme-btn').forEach(btn => {
        if (btn.dataset.tema === temaAtivo) {
            btn.style.outline = '2px solid #00b04f';
        }
        btn.addEventListener('click', () => {
            container.querySelectorAll('.theme-btn').forEach(b => b.style.outline = 'none');
            btn.style.outline = '2px solid #00b04f';
            aplicarTema(btn.dataset.tema);
        });
    });
}

// ══ LOGOUT ═════════════════════════════════════════════
function fazerLogout() {
    localStorage.removeItem('usuarioLogado');
    localStorage.removeItem('access_token');
    window.location.href = 'index.html';
}

// ══ TOGGLE MOBILE ══════════════════════════════════════
function toggleSidebar() {
    document.getElementById('sidebar')?.classList.toggle('open');
}

// ══ INIT ═══════════════════════════════════════════════
// Aplica tema imediatamente (antes do DOM para evitar flash)
carregarTemaSalvo();

function initSidebar() {
    preencherUsuarioSidebar();
    aplicarPermissoesSidebar();
    criarSeletorTema();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebar);
} else {
    initSidebar();
}