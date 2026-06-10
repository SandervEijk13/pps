/**
 * Global notifications — toasts (bottom-left) + mailbox (header).
 * Loaded by header.js when user is logged in.
 */

(function () {
    const POLL_MS = 5000;
    const TOAST_DURATION_MS = 5500;
    const MAX_TOASTS_PER_POLL = 3;

    const TYPE_ICONS = {
        level_up: 'fa-arrow-up',
        trade_received: 'fa-right-left',
        set_completed: 'fa-layer-group',
        raffle_won: 'fa-trophy',
        raffle_ended: 'fa-hourglass-end',
        market_sale: 'fa-coins',
    };

    let pollTimer = null;
    let lastPolledId = parseInt(localStorage.getItem('notifLastPolledId') || '0', 10);
    let toastContainer = null;
    let mailboxOpen = false;

    function getApiBase() {
        if (typeof window.getApiBase === 'function') {
            return window.getApiBase();
        }
        const root = window.location.port === '5173' ? '' : '/pss';
        return `${window.location.origin}${root}/api`;
    }

    function appUrl(path) {
        if (typeof window.appUrl === 'function') {
            return window.appUrl(path);
        }
        const root = window.location.port === '5173' ? '' : '/pss';
        return `${root}${path.startsWith('/') ? path : `/${path}`}`;
    }

    function isLoggedIn() {
        return localStorage.getItem('isLogged') === 'true' && localStorage.getItem('userId');
    }

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatTimeAgo(iso) {
        if (!iso) return '';
        const diff = Date.now() - new Date(iso).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Zojuist';
        if (mins < 60) return `${mins}m geleden`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}u geleden`;
        const days = Math.floor(hours / 24);
        return `${days}d geleden`;
    }

    function ensureToastContainer() {
        if (toastContainer) return toastContainer;
        toastContainer = document.getElementById('notifToastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'notifToastContainer';
            toastContainer.className = 'notif-toast-container';
            toastContainer.setAttribute('aria-live', 'polite');
            document.body.appendChild(toastContainer);
        }
        return toastContainer;
    }

    function getIconClass(type) {
        return TYPE_ICONS[type] || 'fa-bell';
    }

    function showToast(notification) {
        const container = ensureToastContainer();
        const icon = getIconClass(notification.type);
        const iconMod = `notif-toast-icon--${notification.type in TYPE_ICONS ? notification.type : 'default'}`;

        const el = document.createElement('div');
        el.className = 'notif-toast';
        el.dataset.id = String(notification.id);
        el.innerHTML = `
            <div class="notif-toast-icon ${iconMod}">
                <i class="fas ${icon}"></i>
            </div>
            <div class="notif-toast-body">
                <div class="notif-toast-title">${escapeHtml(notification.title)}</div>
                <div class="notif-toast-message">${escapeHtml(notification.message)}</div>
            </div>
            <button type="button" class="notif-toast-close" aria-label="Sluiten">
                <i class="fas fa-xmark"></i>
            </button>
        `;

        const dismiss = () => removeToast(el);
        el.querySelector('.notif-toast-close').addEventListener('click', (e) => {
            e.stopPropagation();
            dismiss();
        });
        el.addEventListener('click', () => {
            handleNotificationAction(notification);
            dismiss();
        });

        container.appendChild(el);

        const timeout = setTimeout(dismiss, TOAST_DURATION_MS);
        el._timeout = timeout;
    }

    function removeToast(el) {
        if (!el || el.classList.contains('is-leaving')) return;
        clearTimeout(el._timeout);
        el.classList.add('is-leaving');
        el.addEventListener('animationend', () => el.remove(), { once: true });
    }

    async function apiGet(action, params = {}) {
        const qs = new URLSearchParams({ action, ...params });
        const res = await fetch(`${getApiBase()}/notifications.php?${qs}`, { credentials: 'include' });
        return res.json();
    }

    async function apiPost(action, body = {}) {
        const res = await fetch(`${getApiBase()}/notifications.php?action=${action}`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        return res.json();
    }

    function updateBadge(count) {
        const badge = document.getElementById('notifBadge');
        if (!badge) return;
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : String(count);
            badge.classList.remove('is-hidden');
        } else {
            badge.classList.add('is-hidden');
        }
    }

    async function markRead(ids) {
        if (!ids || !ids.length) return;
        try {
            const data = await apiPost('markRead', { ids });
            if (data.success) {
                updateBadge(data.unreadCount);
                renderMailboxList();
            }
        } catch {
            // silent
        }
    }

    function handleNotificationAction(notification) {
        markRead([notification.id]);

        const payload = notification.payload || {};

        switch (notification.type) {
            case 'trade_received':
                if (payload.tradeId && window.PokeTrade?.openTradeById) {
                    window.PokeTrade.openTradeById(payload.tradeId);
                } else {
                    window.location.href = appUrl('/pages/trades.html');
                }
                break;
            case 'level_up':
                window.location.href = appUrl('/pages/profile.html');
                break;
            case 'set_completed':
                window.location.href = appUrl('/pages/sets.html');
                break;
            case 'raffle_won':
            case 'raffle_ended':
                window.location.href = appUrl('/pages/profile.html');
                break;
            case 'market_sale':
                window.location.href = appUrl('/pages/market.html');
                break;
            default:
                break;
        }

        document.dispatchEvent(new CustomEvent('pokevault:notification', { detail: notification }));
    }

    function renderMailboxItem(notification) {
        const icon = getIconClass(notification.type);
        const iconMod = `notif-toast-icon--${notification.type in TYPE_ICONS ? notification.type : 'default'}`;
        const unreadClass = notification.read ? '' : ' is-unread';

        return `
            <div class="notif-mailbox-item${unreadClass}" data-id="${notification.id}">
                <div class="notif-mailbox-item-icon ${iconMod}">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="notif-mailbox-item-body">
                    <div class="notif-mailbox-item-title">${escapeHtml(notification.title)}</div>
                    <div class="notif-mailbox-item-message">${escapeHtml(notification.message)}</div>
                    <div class="notif-mailbox-item-time">${escapeHtml(formatTimeAgo(notification.createdAt))}</div>
                </div>
            </div>
        `;
    }

    async function renderMailboxList() {
        const list = document.getElementById('notifMailboxList');
        if (!list) return;

        try {
            const data = await apiGet('list', { limit: 30 });
            if (!data.success) return;

            updateBadge(data.unreadCount);

            if (!data.notifications.length) {
                list.innerHTML = '<div class="notif-mailbox-empty">Geen meldingen.</div>';
                return;
            }

            list.innerHTML = data.notifications.map(renderMailboxItem).join('');

            list.querySelectorAll('.notif-mailbox-item').forEach((item) => {
                item.addEventListener('click', () => {
                    const id = parseInt(item.dataset.id, 10);
                    const notification = data.notifications.find((n) => n.id === id);
                    if (notification) {
                        handleNotificationAction(notification);
                        closeMailbox();
                    }
                });
            });
        } catch {
            list.innerHTML = '<div class="notif-mailbox-empty">Kon meldingen niet laden.</div>';
        }
    }

    function openMailbox() {
        const mailbox = document.getElementById('notifMailbox');
        const btn = document.getElementById('notifBellBtn');
        if (!mailbox || !btn) return;
        mailbox.classList.add('is-open');
        btn.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
        mailboxOpen = true;
        renderMailboxList();
    }

    function closeMailbox() {
        const mailbox = document.getElementById('notifMailbox');
        const btn = document.getElementById('notifBellBtn');
        if (!mailbox || !btn) return;
        mailbox.classList.remove('is-open');
        btn.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
        mailboxOpen = false;
    }

    function setupMailboxUi() {
        const btn = document.getElementById('notifBellBtn');
        const mailbox = document.getElementById('notifMailbox');
        const markAll = document.getElementById('notifMarkAllRead');

        if (!btn || !mailbox) return;

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (mailboxOpen) {
                closeMailbox();
            } else {
                openMailbox();
            }
        });

        document.addEventListener('click', () => {
            if (mailboxOpen) closeMailbox();
        });

        mailbox.addEventListener('click', (e) => e.stopPropagation());

        if (markAll) {
            markAll.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    const data = await apiPost('markAllRead');
                    if (data.success) {
                        updateBadge(0);
                        renderMailboxList();
                    }
                } catch {
                    // silent
                }
            });
        }
    }

    async function pollNotifications() {
        if (!isLoggedIn()) return;

        try {
            const data = await apiGet('poll', { sinceId: lastPolledId });
            if (!data.success) return;

            updateBadge(data.unreadCount);

            const items = data.notifications || [];
            if (!items.length) return;

            const newestId = Math.max(...items.map((n) => n.id));
            const isCatchUp = items.length > MAX_TOASTS_PER_POLL;
            const toToast = isCatchUp ? items.slice(-MAX_TOASTS_PER_POLL) : items;

            toToast.forEach((n, i) => {
                setTimeout(() => showToast(n), i * 200);
            });

            if (isCatchUp && !mailboxOpen) {
                showToast({
                    id: 0,
                    type: 'default',
                    title: `${items.length} nieuwe meldingen`,
                    message: 'Open je mailbox om alles te bekijken.',
                    payload: {},
                });
            }

            lastPolledId = newestId;
            localStorage.setItem('notifLastPolledId', String(lastPolledId));

            items.forEach((n) => {
                if (n.type === 'trade_received') {
                    document.dispatchEvent(new CustomEvent('pokevault:notification', { detail: n }));
                    const tradeId = n.payload?.tradeId;
                    if (tradeId && window.PokeTrade?.openTradeById) {
                        window.PokeTrade.openTradeById(tradeId);
                    }
                }
            });
        } catch {
            // silent
        }
    }

    function startPolling() {
        if (pollTimer) clearInterval(pollTimer);
        pollNotifications();
        pollTimer = setInterval(pollNotifications, POLL_MS);
    }

    function initNotifications() {
        if (!isLoggedIn()) return;

        ensureToastContainer();
        setupMailboxUi();
        startPolling();
    }

    window.initNotifications = initNotifications;
    window.showNotificationToast = showToast;
})();
