import { formatHeaderCoins } from '/scripts/card_logic.js';
import { openTradeById, openTradePartnerPicker } from '/scripts/trade.js';
import { initGameInfo } from '/scripts/game-info.js';
import { notification } from '/scripts/notifications.js';

function getApiBase() {
    if (typeof window.getApiBase === 'function') return window.getApiBase();
    if (window.location.port === '5173') return 'http://localhost/pss/api';
    const parts = window.location.pathname.split('/');
    const pagesIndex = parts.indexOf('pages');
    const rootParts = pagesIndex >= 0 ? parts.slice(0, pagesIndex) : parts.slice(0, -1);
    return `${window.location.origin}${rootParts.join('/') || ''}/api`;
}

const API = getApiBase();
const POLL_MS = 3000;
const listEl = document.getElementById('tradesList');
const emptyEl = document.getElementById('tradesEmpty');
const errorEl = document.getElementById('tradesError');
const loaderEl = document.getElementById('tradesLoader');
const statIncoming = document.getElementById('statIncoming');
const statOutgoing = document.getElementById('statOutgoing');
const statActive = document.getElementById('statActive');

function escapeHtml(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function updateStats(trades) {
    const incoming = trades.filter((t) => t.canRespond).length;
    const outgoing = trades.filter((t) => t.myRole === 'initiator' && t.status === 'pending').length;

    if (statIncoming) statIncoming.textContent = String(incoming);
    if (statOutgoing) statOutgoing.textContent = String(outgoing);
    if (statActive) statActive.textContent = String(trades.length);
}

function renderTradeItem(trade, index) {
    const partner = trade.partner?.username || 'Trainer';
    const give = trade.youGive?.totalValue || 0;
    const receive = trade.youReceive?.totalValue || 0;
    const status = trade.statusLabel || trade.status;

    let roleBadge = '';
    if (trade.canRespond) {
        roleBadge = '<span class="trades-list-item__badge is-incoming">Incoming</span>';
    } else if (trade.myRole === 'initiator' && trade.status === 'pending') {
        roleBadge = '<span class="trades-list-item__badge is-outgoing">Sent</span>';
    } else {
        roleBadge = `<span class="trades-list-item__badge is-status">${escapeHtml(status)}</span>`;
    }

    return `
        <li class="trades-list-item" data-trade-id="${trade.id}" style="animation-delay: ${index * 60}ms">
            <div class="trades-list-item__main">
                <div class="trades-list-item__head">
                    <span class="trades-list-item__partner">${escapeHtml(partner)}</span>
                    ${roleBadge}
                </div>
                <span class="trades-list-item__status">${escapeHtml(status)}</span>
            </div>
            <div class="trades-list-values">
                Jij geeft: <strong>${formatHeaderCoins(give)}</strong><br>
                Jij krijgt: <strong>${formatHeaderCoins(receive)}</strong>
            </div>
            <i class="fas fa-chevron-right trades-list-item__chevron" aria-hidden="true"></i>
        </li>
    `;
}

async function loadTrades({ showLoader = false } = {}) {
    if (errorEl) errorEl.classList.add('is-hidden');
    if (showLoader) loaderEl?.classList.remove('is-hidden');

    try {
        const res = await fetch(`${API}/trades.php?action=list&status=active`, { credentials: 'include' });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Kon trades niet laden');

        const trades = data.trades || [];
        updateStats(trades);

        if (!trades.length) {
            listEl.innerHTML = '';
            emptyEl?.classList.remove('is-hidden');
            return;
        }

        emptyEl?.classList.add('is-hidden');
        listEl.innerHTML = trades.map((trade, index) => renderTradeItem(trade, index)).join('');

        listEl.querySelectorAll('[data-trade-id]').forEach((item) => {
            item.addEventListener('click', () => openTradeById(Number(item.dataset.tradeId)));
        });
    } catch (e) {
        if (errorEl) {
            errorEl.textContent = e.message;
            errorEl.classList.remove('is-hidden');
        }
    } finally {
        loaderEl?.classList.add('is-hidden');
    }
}

document.getElementById('newTradeBtn')?.addEventListener('click', () => openTradePartnerPicker());

['pokevault:trade-completed', 'pokevault:trade-cancelled', 'pokevault:trade-submitted'].forEach((evt) => {
    document.addEventListener(evt, () => loadTrades());
});

initGameInfo();
loadTrades({ showLoader: true });
setInterval(() => loadTrades(), POLL_MS);
