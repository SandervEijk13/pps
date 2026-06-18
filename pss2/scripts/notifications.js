/**
 * Shared notifications: header badge, toasts, trade/friend polling.
 */

const NOTIF_POLL_MS = 15000;
let notifyTimer = null;
let tradeHandler = null;
const notifiedTradeIds = new Set();
const notifiedFriendIds = new Set();

function getApiBase() {
    if (typeof window.getApiBase === 'function') {
        return window.getApiBase();
    }
    return `${window.location.origin}/pss/api`;
}

function isLoggedIn() {
    if (typeof window.isLoggedIn === 'function') {
        return window.isLoggedIn();
    }
    return sessionStorage.getItem('isLogged') === 'true' && sessionStorage.getItem('userId');
}

function appUrl(path) {
    if (typeof window.getAppRoot === 'function') {
        return `${window.getAppRoot()}${path.startsWith('/') ? path : `/${path}`}`;
    }
    return path;
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function ensureToastRoot() {
    let root = document.getElementById('poke-toast-root');
    if (!root) {
        root = document.createElement('div');
        root.id = 'poke-toast-root';
        root.className = 'poke-toast-root';
        root.setAttribute('aria-live', 'polite');
        document.body.appendChild(root);
    }
    return root;
}

export function showToast(message, options = {}) {
    const root = ensureToastRoot();
    const toast = document.createElement('div');
    const type = options.type || 'info';
    toast.className = `poke-toast poke-toast--${type}`;
    toast.innerHTML = `
        <div class="poke-toast__icon" aria-hidden="true">
            <i class="fas ${options.icon || defaultToastIcon(type)}"></i>
        </div>
        <div class="poke-toast__body">
            <strong>${escapeHtml(message)}</strong>
            ${options.detail ? `<span>${escapeHtml(options.detail)}</span>` : ''}
        </div>
        <button type="button" class="poke-toast__close" aria-label="Dismiss">&times;</button>
    `;

    const remove = () => {
        toast.classList.add('is-leaving');
        window.setTimeout(() => toast.remove(), 220);
    };

    toast.querySelector('.poke-toast__close')?.addEventListener('click', remove);
    root.appendChild(toast);
    window.setTimeout(remove, options.duration ?? 4500);
}

function defaultToastIcon(type) {
    if (type === 'story') return 'fa-book-open';
    if (type === 'success') return 'fa-circle-check';
    if (type === 'warning') return 'fa-triangle-exclamation';
    if (type === 'friend') return 'fa-user-plus';
    if (type === 'trade') return 'fa-right-left';
    return 'fa-bell';
}

export function showStoryProgress(feedback) {
    if (!feedback) return;
    showToast(feedback.message || 'Storybook progress +1', {
        detail: feedback.detail || '',
        type: 'story',
        duration: 5200,
    });
}

export function registerTradeHandler(handler) {
    tradeHandler = handler;
}

function updateBadge(counts) {
    const badge = document.getElementById('notifBadge');
    const bell = document.getElementById('notifBell');
    if (!badge || !bell) return;

    const total = Number(counts?.total) || 0;
    badge.textContent = String(total);
    badge.hidden = total <= 0;
    bell.classList.toggle('has-unread', total > 0);
}

function renderPanel(data) {
    const panel = document.getElementById('notifPanel');
    if (!panel) return;

    const trades = Array.isArray(data.trades) ? data.trades : [];
    const friends = Array.isArray(data.friendRequests) ? data.friendRequests : [];
    const items = [];

    trades.forEach((trade) => {
        items.push(`
            <a class="notif-panel-item" href="${escapeHtml(appUrl('/pages/trades.html'))}">
                <i class="fas fa-right-left"></i>
                <span><strong>${escapeHtml(trade.fromUsername)}</strong> sent a trade offer</span>
            </a>
        `);
    });

    friends.forEach((req) => {
        items.push(`
            <a class="notif-panel-item" href="${escapeHtml(appUrl('/pages/friends.html'))}">
                <i class="fas fa-user-plus"></i>
                <span><strong>${escapeHtml(req.username)}</strong> sent a friend request</span>
            </a>
        `);
    });

    panel.innerHTML = items.length
        ? items.join('')
        : '<p class="notif-panel-empty">No new notifications.</p>';
}

async function fetchTradeDetail(tradeId) {
    const res = await fetch(`${getApiBase()}/trades.php?action=get&id=${tradeId}`, {
        credentials: 'include',
    });
    const data = await res.json();
    return data.success ? data.trade : null;
}

async function pollNotifications() {
    if (!isLoggedIn()) return;

    try {
        const res = await fetch(`${getApiBase()}/notifications.php?action=summary`, {
            credentials: 'include',
        });
        const data = await res.json();
        if (!data.success) return;

        updateBadge(data.counts || {});
        renderPanel(data);

        for (const trade of data.trades || []) {
            if (notifiedTradeIds.has(trade.id)) continue;
            notifiedTradeIds.add(trade.id);
            if (typeof tradeHandler === 'function') {
                const detail = await fetchTradeDetail(trade.id);
                if (detail) {
                    tradeHandler(detail);
                    break;
                }
            } else {
                showToast(`${trade.fromUsername} sent a trade offer`, {
                    type: 'trade',
                    detail: 'Open Trades to respond.',
                });
            }
        }

        for (const req of data.friendRequests || []) {
            const key = `${req.userId}`;
            if (notifiedFriendIds.has(key)) continue;
            notifiedFriendIds.add(key);
            showToast(`${req.username} sent a friend request`, {
                type: 'friend',
                detail: 'Open Friends to accept or decline.',
            });
        }
    } catch {
        // silent
    }
}

function setupBellToggle() {
    const bell = document.getElementById('notifBell');
    const panel = document.getElementById('notifPanel');
    if (!bell || !panel || bell.dataset.bound === '1') return;
    bell.dataset.bound = '1';

    bell.addEventListener('click', (event) => {
        event.stopPropagation();
        const open = panel.classList.toggle('is-open');
        bell.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) pollNotifications();
    });

    document.addEventListener('click', () => {
        panel.classList.remove('is-open');
        bell.setAttribute('aria-expanded', 'false');
    });

    panel.addEventListener('click', (event) => event.stopPropagation());
}

export function initNotifications() {
    if (!isLoggedIn()) return;

    ensureToastRoot();
    setupBellToggle();

    if (notifyTimer) clearInterval(notifyTimer);
    pollNotifications();
    notifyTimer = setInterval(pollNotifications, NOTIF_POLL_MS);
}

window.PokeNotifications = {
    showToast,
    showStoryProgress,
    registerTradeHandler,
    initNotifications,
};

document.addEventListener('DOMContentLoaded', () => {
    initNotifications();
});
