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
    { id: 'set-guess', href: '/pages/set-guess.html', icon: 'fa-layer-group', label: 'Set Guess' },
    { id: 'wheel', href: '/pages/wheel.html', icon: 'fa-dharmachakra', label: 'Wheel of Fortune' },
    { id: 'upgrader', href: '/pages/upgrader.html', icon: 'fa-arrow-up', label: 'Upgrader' },
];

const GAMES_ACTIVE_IDS = new Set(['games', 'higher-lower', 'set-guess', 'wheel', 'upgrader']);


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
    return sessionStorage.getItem('isLogged') === 'true' && sessionStorage.getItem('userId');
}

const PUBLIC_APP_PATHS = new Set([
    '/',
    '/index.html',
    '/pages/login.html',
    '/pages/register.html',
]);

function getRelativeAppPath() {
    const path = window.location.pathname;
    const root = getAppRoot();
    let rel = root && path.startsWith(root) ? path.slice(root.length) : path;
    rel = rel || '/';
    if (rel !== '/' && rel.endsWith('/')) {
        rel = rel.slice(0, -1);
    }
    if (rel === '' || rel === '/') {
        return '/index.html';
    }
    return rel;
}

function isPublicPage() {
    const rel = getRelativeAppPath();
    return PUBLIC_APP_PATHS.has(rel);
}

function isHomePage() {
    const rel = getRelativeAppPath();
    return rel === '/index.html';
}

function enforceAuthGuard() {
    if (isLoggedIn() || isPublicPage()) {
        return;
    }

    const returnUrl = encodeURIComponent(
        window.location.pathname + window.location.search + window.location.hash
    );
    window.location.replace(`${appUrl('/pages/login.html')}?return=${returnUrl}`);
}

function renderAuthWarningBanner() {
    if (isLoggedIn() || !isHomePage()) {
        return;
    }

    const mount = document.getElementById('app-header');
    if (!mount || document.getElementById('auth-warning-banner')) {
        return;
    }

    const banner = document.createElement('div');
    banner.id = 'auth-warning-banner';
    banner.className = 'auth-warning-banner';
    banner.setAttribute('role', 'status');
    banner.innerHTML = `
        <i class="fas fa-circle-exclamation" aria-hidden="true"></i>
        <span>You're not signed in. <a href="${escapeHtml(appUrl('/pages/login.html'))}">Log in</a> to play and save your progress.</span>
    `;
    mount.insertAdjacentElement('afterend', banner);
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
                <div class="notif-wrap" id="notifWrap">
                    <button type="button" class="notif-bell" id="notifBell" aria-label="Notifications" aria-expanded="false">
                        <i class="fas fa-bell"></i>
                        <span class="notif-badge" id="notifBadge" hidden>0</span>
                    </button>
                    <div class="notif-panel" id="notifPanel" aria-label="Notifications panel">
                        <p class="notif-panel-empty">Loading...</p>
                    </div>
                </div>
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
                        <a href="#" class="dropdown-item" id="profileAction">
                            <i class="fas fa-user"></i>
                            <span id="profileActionText">Profile</span>
                        </a>
                        <a href="${escapeHtml(appUrl('/pages/leaderboard.html'))}" class="dropdown-item">
                            <i class="fas fa-trophy"></i>
                            <span>Leaderboard</span>
                        </a>
                        <a href="${escapeHtml(appUrl('/pages/trades.html'))}" class="dropdown-item">
                            <i class="fas fa-handshake"></i>
                            <span>Trade</span>
                        </a>
                        <a href="${escapeHtml(appUrl('/pages/friends.html'))}" class="dropdown-item">
                            <i class="fas fa-user-group"></i>
                            <span>Friends</span>
                        </a>
                        <a href="${escapeHtml(appUrl('/pages/roadmap.html'))}" class="dropdown-item">
                            <i class="fas fa-map-signs"></i>
                            <span>Roadmap</span>
                        </a>
                        <a href="${escapeHtml(appUrl('/pages/storybook.html'))}" class="dropdown-item">
                            <i class="fas fa-book-open"></i>
                            <span>Storybook</span>
                        </a>
                        <a href="${escapeHtml(appUrl('/pages/profile-customization.html'))}" class="dropdown-item">
                            <i class="fas fa-wand-magic-sparkles"></i>
                            <span>Customize</span>
                        </a>
                        <div class="dropdown-item dropdown-item--inventory" id="inventoryHoverItem" tabindex="0">
                            <i class="fas fa-box-open"></i>
                            <span>Inventory</span>
                            <i class="fas fa-chevron-right inventory-hover-chevron"></i>
                            <div class="inventory-hover-panel" id="inventoryHoverPanel" aria-label="Pack inventory preview">
                                <p class="inventory-hover-title">Your packs</p>
                                <div class="inventory-hover-list" id="inventoryHoverList">Hover to load...</div>
                                <span class="inventory-hover-hint">Click for full inventory page</span>
                            </div>
                        </div>

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
    const inventoryHoverItem = document.getElementById('inventoryHoverItem');
    const inventoryHoverList = document.getElementById('inventoryHoverList');

    if (!profileAction || !profileActionText || !authAction || !authActionText) {
        return;
    }

    const userNameElement = document.querySelector('.user-name');
    const username = sessionStorage.getItem('username');
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
        if (inventoryHoverItem) {
            inventoryHoverItem.style.display = 'none';
        }
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
    if (inventoryHoverItem) {
        let inventoryLoaded = false;
        let inventoryLoading = false;
        let groupedInventory = [];

        const getBaseSetCode = (setCode = '') => {
            const match = String(setCode || '').match(/^[a-zA-Z]+/);
            return match ? match[0].toLowerCase() : '';
        };

        const getPackImage = (setCode = '') => {
            const normalized = String(setCode || '').trim().toLowerCase();
            const base = getBaseSetCode(normalized);
            if (!normalized || !base) {
                return appUrl('/images/packs_top/base/base1.png');
            }
            return appUrl(`/images/packs_top/${base}/${normalized}.png`);
        };

        const groupPacks = (packs = []) => {
            const counts = new Map();
            for (const pack of packs) {
                const setName = String(pack?.set_name || pack?.tcgdex_set_id || pack?.set_id || 'Unknown set');
                const setCode = String(pack?.tcgdex_set_id || pack?.set_id || '').trim().toLowerCase();
                const key = `${setName}__${setCode}`;
                if (!counts.has(key)) {
                    counts.set(key, { name: setName, setCode, qty: 0 });
                }
                const entry = counts.get(key);
                entry.qty += 1;
            }
            return Array.from(counts.values())
                .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name));
        };

        const renderInventory = (targetEl, grouped = [], limit = null) => {
            if (!targetEl) return;
            if (!grouped.length) {
                targetEl.innerHTML = '<span class="inventory-hover-empty">No packs in inventory.</span>';
                return;
            }
            const source = limit ? grouped.slice(0, limit) : grouped;
            targetEl.innerHTML = source.map((entry) => (
                `<span class="inventory-hover-pack">
                    <img class="inventory-hover-pack-img" src="${escapeHtml(getPackImage(entry.setCode))}" alt="${escapeHtml(entry.name)}" onerror="this.onerror=null;this.src='${escapeHtml(appUrl('/images/packs_top/base/base1.png'))}';">
                    <strong>${escapeHtml(entry.name)}</strong>
                    <em>x${entry.qty}</em>
                </span>`
            )).join('');
        };

        const loadInventoryPreview = async () => {
            if (inventoryLoaded || inventoryLoading) return;
            inventoryLoading = true;
            if (inventoryHoverList) {
                inventoryHoverList.textContent = 'Loading packs...';
            }
            try {
                const res = await fetch(`${getApiBase()}/user_packs.php?action=list`, {
                    credentials: 'include',
                });
                const data = await res.json();
                if (data.success) {
                    groupedInventory = groupPacks(data.packs || []);
                    renderInventory(inventoryHoverList, groupedInventory, 6);
                    inventoryLoaded = true;
                } else if (inventoryHoverList) {
                    inventoryHoverList.textContent = data.message || 'Could not load inventory.';
                }
            } catch (error) {
                if (inventoryHoverList) {
                    inventoryHoverList.textContent = 'Could not load inventory.';
                }
            } finally {
                inventoryLoading = false;
            }
        };

        inventoryHoverItem.addEventListener('mouseenter', loadInventoryPreview);
        inventoryHoverItem.addEventListener('focusin', loadInventoryPreview);
        inventoryHoverItem.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            window.location.href = appUrl('/pages/inventory.html');
        });
    }
    profileAction.onclick = (e) => {
        e.preventDefault();
        window.location.href = appUrl('/pages/profile.html');
    };
    authAction.onclick = (e) => {
        e.preventDefault();
        sessionStorage.clear();
        localStorage.clear();
        window.location.href = appUrl('/pages/login.html');
    };
}

function loadNotificationsScript() {
    if (document.querySelector('script[data-notifications]')) {
        return;
    }
    const script = document.createElement('script');
    script.type = 'module';
    script.src = appUrl('/scripts/notifications.js');
    script.dataset.notifications = '1';
    document.head.appendChild(script);
}

function setupActivityHeartbeat() {
    if (!isLoggedIn()) {
        return;
    }

    const ping = () => {
        fetch(`${getApiBase()}/activity.php?action=ping`, { credentials: 'include' }).catch(() => {});
    };

    ping();
    window.setInterval(ping, 120000);
}

async function loadHeaderWallet(showTickets = false) {
    if (!isLoggedIn()) {
        return;
    }

    const userId = sessionStorage.getItem('userId');
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
    setupActivityHeartbeat();
    loadNotificationsScript();
    loadHeaderWallet(showTickets);
    renderAuthWarningBanner();
}

enforceAuthGuard();

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('app-header')) {
        initAppHeader();
    }
});

window.getAppRoot = getAppRoot;
window.getApiBase = getApiBase;
window.isLoggedIn = isLoggedIn;
window.renderAppHeader = renderAppHeader;
window.initAppHeader = initAppHeader;
window.setupHeaderGamesMenu = setupHeaderGamesMenu;
window.setupHeaderProfileMenu = setupHeaderProfileMenu;
window.loadHeaderWallet = loadHeaderWallet;
