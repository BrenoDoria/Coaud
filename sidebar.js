// sidebar.js — monta a sidebar em qualquer página
(function() {
    const usuario = JSON.parse(localStorage.getItem('usuarioLogado')) || {};
    const paginaAtual = window.location.pathname.split('/').pop();

    const initials = (nome) => {
        if (!nome) return 'U';
        return nome.split(' ').slice(0,2).map(n => n[0]).join('').toUpperCase();
    };

    const navItems = [
        { icon: '🏠', label: 'Portal',          href: 'index.html',              id: 'index.html' },
        { icon: '📋', label: 'Nova Retirada',    href: 'index-almoxarifado.html', id: 'index-almoxarifado.html' },
        { icon: '⏳', label: 'Fichas Pendentes', href: 'fichas.html',             id: 'fichas.html' },
        { icon: '📁', label: 'Fichas Arquivadas',href: 'fichas-arquivadas.html',  id: 'fichas-arquivadas.html' },
        { icon: '📷', label: 'Escaneamento',     href: 'index-escanear.html',     id: 'index-escanear.html' },
    ];

    const sidebarHTML = `
    <aside class="sidebar" id="sidebar">
        <div class="sidebar-brand">
            <div class="brand-row">
                <div class="brand-icon">C</div>
                <div>
                    <div class="brand-name">CÂMARA DOS DEPUTADOS</div>
                    <div class="brand-sub">COAUD — Almoxarifado</div>
                </div>
            </div>
        </div>
        <div class="sidebar-user">
            <div class="user-avatar">${initials(usuario.nome)}</div>
            <div class="user-info">
                <div class="user-name">${usuario.nome || 'Usuário'}</div>
                <div class="user-role">${usuario.permissao || ''}</div>
            </div>
        </div>
        <nav class="sidebar-nav">
            <div class="nav-section-title">Navegação</div>
            ${navItems.map(item => `
                <a class="nav-item ${paginaAtual === item.id ? 'active' : ''}"
                   href="${item.href}">
                    <span class="nav-icon">${item.icon}</span>
                    <span>${item.label}</span>
                </a>
            `).join('')}
        </nav>
        <div class="sidebar-footer">
            <button class="btn-logout" onclick="fazerLogout()">
                <span>⎋</span> Sair do sistema
            </button>
        </div>
    </aside>`;

    document.body.insertAdjacentHTML('afterbegin', sidebarHTML);

    // Envolve o conteúdo existente no main-area
    const body = document.body;
    const sidebar = document.getElementById('sidebar');
    const wrap = document.createElement('div');
    wrap.className = 'app-layout';
    const main = document.createElement('div');
    main.className = 'main-area';
    Array.from(body.children).forEach(el => {
        if (el !== sidebar && el.tagName !== 'SCRIPT') main.appendChild(el);
    });
    wrap.appendChild(sidebar);
    wrap.appendChild(main);
    body.appendChild(wrap);

    // Botão hamburguer no mobile
    const topbar = document.querySelector('.topbar');
    if (topbar) {
        const btn = document.createElement('button');
        btn.className = 'btn-menu';
        btn.innerHTML = '☰';
        btn.onclick = () => sidebar.classList.toggle('open');
        topbar.prepend(btn);
    }
})();

function fazerLogout() {
    localStorage.removeItem('usuarioLogado');
    localStorage.removeItem('access_token');
    window.location.href = 'index.html';
}