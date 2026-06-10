/**
 * Shared site header — mount with <div id="app-header" data-active="wheel"></div>
 * Optional: data-show-tickets="true" for wheel ticket balance.
 *
 * Usage:
 *   <div id="app-header" data-active="market"></div>
 *   <script src="/scripts/header.js" defer></script>
 *
 * Or call manually: initAppHeader({ active: 'wheel', showTickets: true });
 */

const HEADER_NAV = [
    { id: 'market', href: '/pages/market.html', icon: 'fa-chart-line', label: 'Market' },
    { id: 'crates', href: '/pages/shop.html', icon: 'fa-box-open', label: 'Pack Shop' },
    { id: 'battles', href: '/pages/crate-battles.html?mode=battle', icon: 'fa-bolt', label: 'Battles' },
    { id: 'collection', href: '/pages/sets.html', icon: 'fa-layer-group', label: 'Collection' },
];

const HEADER_GAMES = [
    { id: 'higher-lower', href: '/pages/higher-lower.html', icon: 'fa-sort', label: 'Higher / Lower' },
    { id: 'wheel', href: '/pages/wheel.html', icon: 'fa-dharmachakra', label: 'Wheel of Fortune' },
    { id: 'upgrader', href: '/pages/upgrader.html', icon: 'fa-arrow-up', label: 'Upgrader' },
];

const GAMES_ACTIVE_IDS = new Set(['games', 'higher-lower', 'wheel', 'upgrader']);

function getAppRoot() {
    if (window.location.port === '5173') {
        return '';
    }
    const parts = window.location.pathname.split('/');
    const pagesIndex = parts.indexOf('pages');
    const rootParts = pagesIndex >= 0 ? parts.slice(0, pagesIndex) : parts.slice(0, -1);
    return rootParts.join('/') || '';
}

function getApiBase() {
    const root = getAppRoot();
    return `${window.location.origin}${root}/api`;
}

function appUrl(path) {
    const root = getAppRoot();
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${root}${normalized}`;
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function isLoggedIn() {
    return localStorage.getItem('isLogged') === 'true' && localStorage.getItem('userId');
}

function buildHeaderHtml(options = {}) {
    const active = options.active || '';
    const showTickets = Boolean(options.showTickets);

    const buildNavLink = (item) => {
        const href = appUrl(item.href.replace(/^\//, ''));
        const isActive = active === item.id ? ' nav-link-active' : '';
        return `
            <a href="${escapeHtml(href)}" class="nav-link${isActive}" data-nav="${item.id}">
                <i class="fas ${item.icon}"></i>
                <span>${escapeHtml(item.label)}</span>
            </a>
        `;
    };

    const navBeforeGames = HEADER_NAV.slice(0, 2);
    const navAfterGames = HEADER_NAV.slice(2);

    const gamesActive = GAMES_ACTIVE_IDS.has(active) ? ' nav-link-active' : '';
    const gamesItemsHtml = HEADER_GAMES.map((item) => {
        const href = appUrl(item.href.replace(/^\//, ''));
        const isActive = active === item.id ? ' nav-games-item-active' : '';
        return `
            <a href="${escapeHtml(href)}" class="nav-games-item${isActive}" data-nav="${item.id}">
                <i class="fas ${item.icon}"></i>
                <span>${escapeHtml(item.label)}</span>
            </a>
        `;
    }).join('');

    const gamesDropdownHtml = `
        <div class="nav-games" id="navGames">
            <button type="button" class="nav-link nav-games-trigger${gamesActive}" aria-expanded="false" aria-haspopup="true">
                <i class="fas fa-gamepad"></i>
                <span>Games</span>
                <i class="fas fa-chevron-down nav-games-chevron"></i>
            </button>
            <div class="nav-games-dropdown" id="navGamesDropdown">
                ${gamesItemsHtml}
            </div>
        </div>
    `;

    const navHtml = [
        ...navBeforeGames.map(buildNavLink),
        gamesDropdownHtml,
        ...navAfterGames.map(buildNavLink),
    ].join('');

    const ticketsHtml = showTickets
        ? `
            <div class="ticket-widget" title="Wheel tickets">
                <i class="fas fa-ticket"></i>
                <span id="ticket-amount">0</span>
            </div>
        `
        : '';

    return `
        <header class="header">
            <div class="container">
                <div class="header-inner">
                    <div class="logo-area">
                        <div class="logo-icon"><i class="fas fa-database"></i></div>
                        <a href="${escapeHtml(appUrl('/index.html'))}"><span class="logo-text">PokeVault</span></a>
                    </div>
                    <div class="nav-links">${navHtml}</div>
                    <div class="right-actions">
                        ${ticketsHtml}
                        <div class="coin-widget">
                            <div class="coin-icon">
                                <img src="${escapeHtml(appUrl('/images/pokecoin.png'))}" alt="PokeCoin" class="coin-img" />
                            </div>
                            <span id="coin-amount">0</span>
                        </div>
                        <div class="user-profile" id="userProfile">
                            <div class="avatar-icon"><i class="fas fa-user-astronaut"></i></div>
                            <span class="user-name">Trainer</span>
                            <i class="fas fa-chevron-down dropdown-icon"></i>
                            <div class="profile-dropdown" id="profileDropdown">
                                <a href="${escapeHtml(appUrl('/pages/leaderboard.html'))}" class="dropdown-item">
                                    <i class="fas fa-trophy"></i>
                                    <span>Leaderboard</span>
                                </a>
                                <a href="#" class="dropdown-item" id="profileAction">
                                    <i class="fas fa-user"></i>
                                    <span id="profileActionText">Profile</span>
                                </a>
                                <a href="#" class="dropdown-item" id="authAction">
                                    <i class="fas fa-right-to-bracket"></i>
                                    <span id="authActionText">Login</span>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    `;
}

function renderAppHeader(options = {}) {
    const mount =
        options.mount instanceof HTMLElement
            ? options.mount
            : document.getElementById(options.mount || 'app-header');

    if (!mount) {
        return null;
    }

    mount.innerHTML = buildHeaderHtml(options);
    return mount;
}

function setupHeaderGamesMenu() {
    const navGames = document.getElementById('navGames');
    const navGamesDropdown = document.getElementById('navGamesDropdown');
    const trigger = navGames?.querySelector('.nav-games-trigger');

    if (!navGames || !navGamesDropdown || !trigger) {
        return;
    }

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = navGamesDropdown.classList.toggle('active');
        trigger.classList.toggle('is-open', isOpen);
        trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    document.addEventListener('click', () => {
        navGamesDropdown.classList.remove('active');
        trigger.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
    });

    navGamesDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

function setupHeaderProfileMenu() {
    const userProfile = document.getElementById('userProfile');
    const profileDropdown = document.getElementById('profileDropdown');
    const profileAction = document.getElementById('profileAction');
    const profileActionText = document.getElementById('profileActionText');
    const authAction = document.getElementById('authAction');
    const authActionText = document.getElementById('authActionText');

    if (!profileAction || !profileActionText || !authAction || !authActionText) {
        return;
    }

    const userNameElement = document.querySelector('.user-name');
    const username = localStorage.getItem('username');
    if (userNameElement && username) {
        userNameElement.textContent = username;
    }

    if (userProfile && profileDropdown) {
        userProfile.addEventListener('click', (e) => {
            e.stopPropagation();
            profileDropdown.classList.toggle('active');
        });
        document.addEventListener('click', () => {
            profileDropdown.classList.remove('active');
        });
    }

    if (!isLoggedIn()) {
        profileActionText.textContent = 'Login';
        authActionText.textContent = 'Login';
        const goLogin = (e) => {
            e.preventDefault();
            window.location.href = appUrl('/pages/login.html');
        };
        profileAction.onclick = goLogin;
        authAction.onclick = goLogin;
        return;
    }

    profileActionText.textContent = 'Profile';
    authActionText.textContent = 'Logout';
    profileAction.onclick = (e) => {
        e.preventDefault();
        window.location.href = appUrl('/pages/profile.html');
    };
    authAction.onclick = (e) => {
        e.preventDefault();
        localStorage.clear();
        window.location.href = appUrl('/pages/login.html');
    };
}

async function loadHeaderWallet(showTickets = false) {
    if (!isLoggedIn()) {
        return;
    }

    const userId = localStorage.getItem('userId');
    const coinEl = document.getElementById('coin-amount');
    const ticketEl = document.getElementById('ticket-amount');

    try {
        const res = await fetch(`${getApiBase()}/users.php?action=getCoins&id=${userId}`);
        const data = await res.json();
        if (data.success && coinEl) {
            coinEl.textContent = data.coins;
        }
    } catch (err) {
        console.error('Failed to load coins:', err);
    }

    if (!showTickets || !ticketEl) {
        return;
    }

    try {
        const res = await fetch(`${getApiBase()}/wheel.php?action=getState`, { credentials: 'include' });
        const data = await res.json();
        if (data.success) {
            ticketEl.textContent = String(data.tickets ?? 0);
            if (data.coins != null && coinEl) {
                coinEl.textContent = data.coins;
            }
        }
    } catch (err) {
        console.error('Failed to load tickets:', err);
    }
}

/**
 * Render header + profile menu + wallet balances.
 * @param {{ active?: string, showTickets?: boolean, mount?: string|HTMLElement }} options
 */
function initAppHeader(options = {}) {
    const mountEl = document.getElementById('app-header');
    const active = options.active ?? mountEl?.dataset.active ?? '';
    const showTickets =
        options.showTickets ??
        (mountEl?.dataset.showTickets === 'true');

    renderAppHeader({ ...options, active, showTickets });
    setupHeaderGamesMenu();
    setupHeaderProfileMenu();
    loadHeaderWallet(showTickets);
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('app-header')) {
        initAppHeader();
    }
});

window.getAppRoot = getAppRoot;
window.getApiBase = getApiBase;
window.renderAppHeader = renderAppHeader;
window.initAppHeader = initAppHeader;
window.setupHeaderGamesMenu = setupHeaderGamesMenu;
window.setupHeaderProfileMenu = setupHeaderProfileMenu;
window.loadHeaderWallet = loadHeaderWallet;
