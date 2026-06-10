import { formatHeaderCoins, resolveTcgdexImageUrl } from '/scripts/card_logic.js';

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

const state = {
    trade: null,
    loading: false,
    mode: null,
    createDraft: null,
};

let overlayEl = null;
let notifyTimer = null;
let filterMenuCloseHandler = null;
const notifiedTradeIds = new Set();

function isLoggedIn() {
    return localStorage.getItem('isLogged') === 'true' && localStorage.getItem('userId');
}

function currentUserId() {
    return Number(localStorage.getItem('userId') || 0);
}

function assertNotSelfTrade(partnerId) {
    const myId = currentUserId();
    const targetId = Number(partnerId);
    if (!targetId || !myId) {
        throw new Error('Ongeldige speler');
    }
    if (targetId === myId) {
        throw new Error('Je kunt niet met jezelf traden');
    }
    return targetId;
}

function ensureLogin() {
    if (!isLoggedIn()) {
        window.location.href = `${appRoot()}/pages/login.html`;
        return false;
    }
    return true;
}

function appRoot() {
    const parts = window.location.pathname.split('/');
    const pagesIndex = parts.indexOf('pages');
    const rootParts = pagesIndex >= 0 ? parts.slice(0, pagesIndex) : parts.slice(0, -1);
    return rootParts.join('/') || '';
}

function escapeHtml(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function cardImageUrl(image, cardId) {
    return resolveTcgdexImageUrl(image, { cardId });
}

function ensureOverlay() {
    if (overlayEl) return overlayEl;

    overlayEl = document.createElement('div');
    overlayEl.className = 'trade-modal-overlay is-hidden';
    overlayEl.innerHTML = `
        <div class="trade-modal" role="dialog" aria-modal="true">
            <div class="trade-modal-glow" aria-hidden="true"></div>
            <div class="trade-modal-header">
                <div class="trade-modal-header__text">
                    <span class="trade-modal-badge"><i class="fas fa-right-left"></i> Trade</span>
                    <h2 id="tradeModalTitle">Trade</h2>
                    <p id="tradeModalSubtitle"></p>
                </div>
                <button type="button" class="trade-modal-close" aria-label="Sluiten"><i class="fas fa-times"></i></button>
            </div>
            <div class="trade-modal-body" id="tradeModalBody"></div>
        </div>
    `;
    document.body.appendChild(overlayEl);
    overlayEl.querySelector('.trade-modal-close').addEventListener('click', closeTradeModal);
    overlayEl.addEventListener('click', (e) => { if (e.target === overlayEl) closeTradeModal(); });
    return overlayEl;
}

function closeTradeModal() {
    state.trade = null;
    state.mode = null;
    state.createDraft = null;
    overlayEl?.classList.add('is-hidden');
}

async function apiPost(action, body = {}) {
    const res = await fetch(`${API}/trades.php?action=${action}`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Request failed');
    return data;
}

async function apiGet(action, params = {}) {
    const qs = new URLSearchParams({ action, ...params });
    const res = await fetch(`${API}/trades.php?${qs}`, { credentials: 'include' });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Request failed');
    return data;
}

function renderSelectedCards(map, removable = true, removeAttr = 'data-remove-offer') {
    const entries = Object.values(map);
    if (!entries.length) return '<li class="trade-offer-item"><span>Geen kaarten geselecteerd</span></li>';
    return entries.map((card) => `
        <li class="trade-offer-item">
            <img src="${escapeHtml(cardImageUrl(card.image, card.cardId))}" alt="">
            <div class="trade-offer-meta">
                <strong>${escapeHtml(card.name)}</strong>
                <span>${card.quantity}× · ${formatHeaderCoins(card.price * card.quantity)}</span>
            </div>
            ${removable ? `<button type="button" class="trade-offer-remove" ${removeAttr}="${escapeHtml(card.cardId)}">&minus;</button>` : ''}
        </li>
    `).join('');
}

function renderSideSummary(side, label) {
    const cards = side?.cards || [];
    const list = cards.length
        ? cards.map((c) => `
            <li class="trade-offer-item">
                <img src="${escapeHtml(cardImageUrl(c.image, c.cardId))}" alt="">
                <div class="trade-offer-meta">
                    <strong>${escapeHtml(c.name)}</strong>
                    <span>${c.quantity}× · ${formatHeaderCoins(c.lineValue)}</span>
                </div>
            </li>
        `).join('')
        : '<li class="trade-offer-item"><span>Geen kaarten</span></li>';

    const isGive = label.toLowerCase().includes('geeft');
    const icon = isGive ? 'fa-arrow-up-from-bracket' : 'fa-gift';
    return `
        <div class="trade-side ${isGive ? 'is-me' : 'is-partner'}">
            <div class="trade-side-head">
                <span class="trade-side-name"><i class="fas ${icon}"></i> ${escapeHtml(label)}</span>
                <span class="trade-side-pill ${isGive ? '' : 'trade-side-pill--receive'}">${formatHeaderCoins(side?.totalValue || 0)}</span>
            </div>
            ${side?.coins > 0 ? `<div class="trade-side-coins-note"><i class="fas fa-coins"></i> ${formatHeaderCoins(side.coins)} coins</div>` : ''}
            <ul class="trade-offer-list">${list}</ul>
        </div>
    `;
}

function deriveSetIdFromCardId(cardId) {
    const id = String(cardId || '');
    const dash = id.lastIndexOf('-');
    if (dash > 0) return id.slice(0, dash);
    return id || 'unknown';
}

function enrichInventoryCard(card) {
    const setId = card.setId || deriveSetIdFromCardId(card.cardId);
    return {
        ...card,
        setId,
        setName: card.setName || setId,
    };
}

function enrichInventory(inventory) {
    return (inventory || []).map(enrichInventoryCard);
}

function buildSetOptions(inventory) {
    const sets = new Map();
    inventory.forEach((card) => {
        if (!sets.has(card.setId)) {
            sets.set(card.setId, card.setName || card.setId);
        }
    });
    return [...sets.entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'nl'));
}

function filterInventoryBySet(inventory, setFilter) {
    if (!setFilter) return inventory;
    return inventory.filter((card) => card.setId === setFilter);
}

function getActiveCreateInventory(d) {
    const raw = d.activeInventory === 'partner' ? d.partnerInventory : d.myInventory;
    return enrichInventory(raw);
}

function renderSetFilterMenu(d, inventory) {
    const sets = buildSetOptions(inventory);
    const activeName = sets.find((s) => s.id === d.setFilter)?.name;

    return `
        <div class="trade-inventory-filter">
            <button
                type="button"
                class="trade-inventory-filter-btn${d.setFilter ? ' is-active' : ''}${d.setFilterOpen ? ' is-open' : ''}"
                id="tradeSetFilterBtn"
                aria-expanded="${d.setFilterOpen ? 'true' : 'false'}"
                aria-haspopup="listbox"
            >
                <i class="fas fa-filter"></i>
                <span>${d.setFilter && activeName ? escapeHtml(activeName) : 'Set filter'}</span>
            </button>
            <div class="trade-inventory-filter-menu${d.setFilterOpen ? ' is-open' : ''}" id="tradeSetFilterMenu" role="listbox">
                <button type="button" class="trade-inventory-filter-option${!d.setFilter ? ' is-selected' : ''}" data-set-filter="">
                    Alle sets
                </button>
                ${sets.map((set) => `
                    <button
                        type="button"
                        class="trade-inventory-filter-option${d.setFilter === set.id ? ' is-selected' : ''}"
                        data-set-filter="${escapeHtml(set.id)}"
                    >${escapeHtml(set.name)}</button>
                `).join('')}
            </div>
        </div>
    `;
}

function buildOwnedCardIdSet(inventory) {
    return new Set((inventory || []).map((card) => card.cardId));
}

function renderInventoryGrid(inventory, dataAttr, emptyLabel, ownedCardIds = null) {
    if (!inventory?.length) {
        return `<p class="trade-status-msg">${emptyLabel}</p>`;
    }
    return `
        <div class="trade-inventory-grid">
            ${inventory.map((card) => {
                const notOwned = ownedCardIds && !ownedCardIds.has(card.cardId);
                return `
                <div class="trade-inv-card${notOwned ? ' trade-inv-card--missing' : ''}">
                    ${notOwned ? '<span class="trade-inv-missing-badge" title="Niet in jouw collectie"><i class="fas fa-lock"></i></span>' : ''}
                    <img src="${escapeHtml(cardImageUrl(card.image, card.cardId))}" alt="">
                    <strong>${escapeHtml(card.name)}</strong>
                    <span>Beschikbaar: ${card.available} · ${formatHeaderCoins(card.price)}</span>
                    <button type="button" ${dataAttr}="${escapeHtml(card.cardId)}" ${card.available <= 0 ? 'disabled' : ''}>+ Toevoegen</button>
                </div>
            `;
            }).join('')}
        </div>
    `;
}

function calcDraftValue(cardsMap, coins) {
    let total = Number(coins) || 0;
    Object.values(cardsMap).forEach((c) => { total += (c.price || 0) * (c.quantity || 0); });
    return total;
}

function addToDraftMap(map, card) {
    const existing = map[card.cardId];
    if (existing) {
        if (existing.quantity >= card.available) return false;
        existing.quantity += 1;
    } else {
        map[card.cardId] = {
            cardId: card.cardId,
            name: card.name,
            image: card.image,
            price: card.price,
            quantity: 1,
            available: card.available,
        };
    }
    return true;
}

function removeFromDraftMap(map, cardId) {
    const entry = map[cardId];
    if (!entry) return;
    entry.quantity -= 1;
    if (entry.quantity <= 0) delete map[cardId];
}

function renderCreateInventoryColumn(d) {
    const isMine = d.activeInventory !== 'partner';
    const panelClass = isMine ? 'trade-inventory-panel--mine' : 'trade-inventory-panel--partner';
    const title = isMine
        ? '<i class="fas fa-layer-group"></i> Jouw collectie'
        : `<i class="fas fa-user"></i> ${escapeHtml(d.partnerName)}`;
    const hint = isMine ? 'Klik + om aan te bieden' : 'Klik + om te vragen';
    const inventory = getActiveCreateInventory(d);
    const filtered = filterInventoryBySet(inventory, d.setFilter);
    const dataAttr = isMine ? 'data-offer-add' : 'data-request-add';
    const emptyLabel = isMine ? 'Geen kaarten beschikbaar' : 'Geen beschikbare kaarten';
    const ownedCardIds = isMine ? null : buildOwnedCardIdSet(d.myInventory);
    const grid = renderInventoryGrid(
        filtered,
        dataAttr,
        d.setFilter ? 'Geen kaarten in deze set' : emptyLabel,
        ownedCardIds,
    );
    const switchLabel = isMine
        ? `Collectie van ${escapeHtml(d.partnerName)}`
        : 'Jouw collectie';
    const switchIcon = isMine ? 'fa-arrow-right' : 'fa-arrow-left';

    return `
        <div class="trade-create-inventories">
            <div class="trade-inventory-toolbar">
                <button type="button" class="trade-inventory-switch-btn" id="switchInventoryBtn">
                    <i class="fas ${switchIcon}"></i>
                    <span>${switchLabel}</span>
                </button>
                ${renderSetFilterMenu(d, inventory)}
            </div>
            <section class="trade-inventory-panel ${panelClass}">
                <div class="trade-inventory-panel__head">
                    <h3>${title}</h3>
                    <span class="trade-inventory-panel__hint">${hint}</span>
                </div>
                ${grid}
            </section>
        </div>
    `;
}

function renderCreateModal() {
    const d = state.createDraft;
    if (!d) return;

    if (!d.activeInventory) d.activeInventory = 'mine';

    const overlay = ensureOverlay();
    overlay.querySelector('#tradeModalTitle').textContent = 'Trade aanmaken';
    overlay.querySelector('#tradeModalSubtitle').textContent =
        `Stel een voorstel samen voor ${d.partnerName}`;

    const offerValue = calcDraftValue(d.offerCards, d.offerCoins);
    const requestValue = calcDraftValue(d.requestCards, d.requestCoins);

    const totalOffer = offerValue;
    const totalRequest = requestValue;

    overlay.querySelector('#tradeModalBody').innerHTML = `
        <div class="trade-create-layout">
            ${renderCreateInventoryColumn(d)}

            <aside class="trade-create-summary">
                <div class="trade-summary-header">
                    <span class="trade-summary-header__label">Trade overzicht</span>
                    <strong class="trade-summary-header__partner">met ${escapeHtml(d.partnerName)}</strong>
                </div>

                <div class="trade-summary-sides">
                    <div class="trade-side is-me">
                        <div class="trade-side-head">
                            <span class="trade-side-name"><i class="fas fa-arrow-up-from-bracket"></i> Jij geeft</span>
                            <span class="trade-side-pill" data-draft-offer-pill>${formatHeaderCoins(totalOffer)}</span>
                        </div>
                        <ul class="trade-offer-list">${renderSelectedCards(d.offerCards, true, 'data-remove-offer')}</ul>
                        <div class="trade-coins-row">
                            <label for="draftOfferCoins"><i class="fas fa-coins"></i> Coins</label>
                            <input type="number" id="draftOfferCoins" min="0" step="1" value="${d.offerCoins}">
                        </div>
                    </div>

                    <div class="trade-summary-divider" aria-hidden="true">
                        <i class="fas fa-right-left"></i>
                    </div>

                    <div class="trade-side is-partner">
                        <div class="trade-side-head">
                            <span class="trade-side-name"><i class="fas fa-gift"></i> Jij ontvangt</span>
                            <span class="trade-side-pill trade-side-pill--receive" data-draft-request-pill>${formatHeaderCoins(totalRequest)}</span>
                        </div>
                        <ul class="trade-offer-list">${renderSelectedCards(d.requestCards, true, 'data-remove-request')}</ul>
                        <div class="trade-coins-row">
                            <label for="draftRequestCoins"><i class="fas fa-coins"></i> Coins</label>
                            <input type="number" id="draftRequestCoins" min="0" step="1" value="${d.requestCoins}">
                        </div>
                    </div>
                </div>

                <div class="trade-actions trade-actions--summary">
                    <button type="button" class="trade-btn trade-btn-success" id="submitProposalBtn">
                        <i class="fas fa-paper-plane"></i> Trade aanmaken
                    </button>
                    <button type="button" class="trade-btn trade-btn-muted" id="cancelCreateBtn">Annuleren</button>
                </div>
                <div class="trade-status-msg" id="tradeStatusMsg"></div>
            </aside>
        </div>
    `;

    bindCreateEvents();
    overlay.classList.remove('is-hidden');
}

function setStatus(msg, type = '') {
    const el = document.getElementById('tradeStatusMsg');
    if (!el) return;
    el.textContent = msg || '';
    el.className = `trade-status-msg${type ? ` is-${type}` : ''}`;
}

function updateDraftSummaryPills() {
    const d = state.createDraft;
    if (!d) return;
    const offerPill = document.querySelector('[data-draft-offer-pill]');
    const requestPill = document.querySelector('[data-draft-request-pill]');
    if (offerPill) offerPill.textContent = formatHeaderCoins(calcDraftValue(d.offerCards, d.offerCoins));
    if (requestPill) requestPill.textContent = formatHeaderCoins(calcDraftValue(d.requestCards, d.requestCoins));
}

function bindCreateEvents() {
    document.getElementById('switchInventoryBtn')?.addEventListener('click', () => {
        const d = state.createDraft;
        if (!d) return;
        d.activeInventory = d.activeInventory === 'partner' ? 'mine' : 'partner';
        d.setFilter = null;
        d.setFilterOpen = false;
        renderCreateModal();
    });

    document.getElementById('tradeSetFilterBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const d = state.createDraft;
        if (!d) return;
        d.setFilterOpen = !d.setFilterOpen;
        renderCreateModal();
    });

    document.querySelectorAll('[data-set-filter]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const d = state.createDraft;
            if (!d) return;
            const value = btn.dataset.setFilter || null;
            d.setFilter = value;
            d.setFilterOpen = false;
            renderCreateModal();
        });
    });

    if (filterMenuCloseHandler) {
        document.removeEventListener('click', filterMenuCloseHandler);
        filterMenuCloseHandler = null;
    }

    if (state.createDraft?.setFilterOpen) {
        filterMenuCloseHandler = (e) => {
            if (e.target.closest('.trade-inventory-filter')) return;
            if (!state.createDraft) return;
            state.createDraft.setFilterOpen = false;
            document.removeEventListener('click', filterMenuCloseHandler);
            filterMenuCloseHandler = null;
            renderCreateModal();
        };
        setTimeout(() => {
            if (filterMenuCloseHandler) {
                document.addEventListener('click', filterMenuCloseHandler);
            }
        }, 0);
    }

    document.getElementById('draftOfferCoins')?.addEventListener('input', (e) => {
        state.createDraft.offerCoins = Number(e.target.value) || 0;
        updateDraftSummaryPills();
    });
    document.getElementById('draftRequestCoins')?.addEventListener('input', (e) => {
        state.createDraft.requestCoins = Number(e.target.value) || 0;
        updateDraftSummaryPills();
    });

    document.querySelectorAll('[data-offer-add]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const card = state.createDraft.myInventory.find((c) => c.cardId === btn.dataset.offerAdd);
            if (card && addToDraftMap(state.createDraft.offerCards, card)) renderCreateModal();
        });
    });

    document.querySelectorAll('[data-request-add]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const card = state.createDraft.partnerInventory.find((c) => c.cardId === btn.dataset.requestAdd);
            if (card && addToDraftMap(state.createDraft.requestCards, card)) renderCreateModal();
        });
    });

    document.querySelectorAll('[data-remove-offer]').forEach((btn) => {
        btn.addEventListener('click', () => {
            removeFromDraftMap(state.createDraft.offerCards, btn.dataset.removeOffer);
            renderCreateModal();
        });
    });

    document.querySelectorAll('[data-remove-request]').forEach((btn) => {
        btn.addEventListener('click', () => {
            removeFromDraftMap(state.createDraft.requestCards, btn.dataset.removeRequest);
            renderCreateModal();
        });
    });

    document.getElementById('cancelCreateBtn')?.addEventListener('click', closeTradeModal);

    document.getElementById('submitProposalBtn')?.addEventListener('click', async () => {
        const d = state.createDraft;
        const offerCards = Object.values(d.offerCards).map((c) => ({ cardId: c.cardId, quantity: c.quantity }));
        const requestCards = Object.values(d.requestCards).map((c) => ({ cardId: c.cardId, quantity: c.quantity }));

        try {
            assertNotSelfTrade(d.partnerId);
            state.loading = true;
            setStatus('Trade versturen…');
            const data = await apiPost('submit', {
                receiverId: d.partnerId,
                offerCards,
                requestCards,
                offerCoins: d.offerCoins,
                requestCoins: d.requestCoins,
            });
            closeTradeModal();
            alert(data.message || 'Trade verzoek verstuurd!');
            document.dispatchEvent(new CustomEvent('pokevault:trade-submitted'));
        } catch (e) {
            setStatus(e.message, 'error');
        } finally {
            state.loading = false;
        }
    });
}

async function loadCreateDraft(partnerId, partnerName) {
    const myId = currentUserId();
    const targetId = assertNotSelfTrade(partnerId);

    const [myData, partnerData] = await Promise.all([
        apiGet('getInventory', { userId: myId }),
        apiGet('getInventory', { userId: targetId }),
    ]);

    state.createDraft = {
        partnerId: targetId,
        partnerName: partnerName || partnerData.user?.username || 'Trainer',
        offerCards: {},
        requestCards: {},
        offerCoins: 0,
        requestCoins: 0,
        activeInventory: 'mine',
        setFilter: null,
        setFilterOpen: false,
        myInventory: enrichInventory(myData.inventory || []),
        partnerInventory: enrichInventory(partnerData.inventory || []),
    };
    state.mode = 'create';
    renderCreateModal();
}

function renderTradeView() {
    const trade = state.trade;
    if (!trade) return;

    const overlay = ensureOverlay();
    const partnerName = trade.partner?.username || 'Partner';
    overlay.querySelector('#tradeModalTitle').textContent =
        state.mode === 'respond' ? 'Trade verzoek' : 'Trade';

    overlay.querySelector('#tradeModalSubtitle').textContent =
        `${trade.statusLabel || trade.status} met ${partnerName}`;

    let actions = '';

    if (state.mode === 'respond' && trade.canRespond) {
        actions = `
            <button type="button" class="trade-btn trade-btn-success" id="acceptTradeBtn">
                <i class="fas fa-check"></i> Accepteren
            </button>
            <button type="button" class="trade-btn trade-btn-danger" id="declineTradeBtn">
                <i class="fas fa-xmark"></i> Weigeren
            </button>
        `;
    } else if (trade.canCancel) {
        actions = `<button type="button" class="trade-btn trade-btn-danger" id="tradeCancelBtn">Annuleren</button>`;
    } else {
        actions = `<button type="button" class="trade-btn trade-btn-muted" id="tradeCloseBtn">Sluiten</button>`;
    }

    overlay.querySelector('#tradeModalBody').innerHTML = `
        <div class="trade-review-layout">
            <div class="trade-review-visual" aria-hidden="true">
                <div class="trade-review-orb trade-review-orb--a"></div>
                <div class="trade-review-orb trade-review-orb--b"></div>
                <i class="fas fa-handshake trade-review-icon"></i>
            </div>
            <aside class="trade-create-summary trade-create-summary--review">
                <div class="trade-summary-header">
                    <span class="trade-summary-header__label">${escapeHtml(trade.statusLabel || trade.status)}</span>
                    <strong class="trade-summary-header__partner">met ${escapeHtml(partnerName)}</strong>
                </div>
                <div class="trade-summary-sides">
                    ${renderSideSummary(trade.youGive, 'Jij geeft')}
                    <div class="trade-summary-divider" aria-hidden="true"><i class="fas fa-right-left"></i></div>
                    ${renderSideSummary(trade.youReceive, 'Jij ontvangt')}
                </div>
                <div class="trade-actions trade-actions--summary">${actions}</div>
                <div class="trade-status-msg" id="tradeStatusMsg"></div>
            </aside>
        </div>
    `;

    bindTradeViewEvents(trade.id);
    overlay.classList.remove('is-hidden');
}

async function runTradeAction(fn) {
    state.loading = true;
    try { await fn(); } finally { state.loading = false; }
}

function bindTradeViewEvents(tradeId) {
    document.getElementById('acceptTradeBtn')?.addEventListener('click', () => runTradeAction(async () => {
        if (!confirm('Trade accepteren? Items worden direct overgedragen.')) return;
        const data = await apiPost('accept', { tradeId });
        state.trade = data.trade;
        state.mode = 'view';
        renderTradeView();
        setStatus(data.message || 'Geaccepteerd!', 'success');
        document.dispatchEvent(new CustomEvent('pokevault:trade-completed'));
    }).catch((e) => setStatus(e.message, 'error')));

    document.getElementById('declineTradeBtn')?.addEventListener('click', () => runTradeAction(async () => {
        await apiPost('decline', { tradeId });
        closeTradeModal();
        document.dispatchEvent(new CustomEvent('pokevault:trade-cancelled'));
    }).catch((e) => setStatus(e.message, 'error')));

    document.getElementById('tradeCancelBtn')?.addEventListener('click', () => runTradeAction(async () => {
        if (!confirm('Trade annuleren?')) return;
        await apiPost('cancel', { tradeId });
        closeTradeModal();
        document.dispatchEvent(new CustomEvent('pokevault:trade-cancelled'));
    }).catch((e) => setStatus(e.message, 'error')));

    document.getElementById('tradeCloseBtn')?.addEventListener('click', closeTradeModal);
}

export async function openTradeById(tradeId) {
    if (!ensureLogin()) return;
    const data = await apiGet('get', { id: tradeId });
    state.trade = data.trade;
    if (data.trade.status === 'pending' && data.trade.canRespond) state.mode = 'respond';
    else state.mode = 'view';
    renderTradeView();
}

export async function openTradeWithUser(receiverId, receiverName = '') {
    if (!ensureLogin()) return;
    assertNotSelfTrade(receiverId);
    await loadCreateDraft(Number(receiverId), receiverName);
}

export function openTradePartnerPicker(prefillCardId = null) {
    if (!ensureLogin()) return;

    const pickerOverlay = document.createElement('div');
    pickerOverlay.className = 'trade-modal-overlay';
    pickerOverlay.innerHTML = `
        <div class="trade-picker-modal">
            <h3>Trade aanmaken</h3>
            <p>Kies de trainer waarmee je wilt traden.</p>
            <input type="text" id="tradePartnerUsername" placeholder="Gebruikersnaam" autocomplete="off">
            <div class="trade-actions">
                <button type="button" class="trade-btn trade-btn-primary" id="tradePartnerStart">Volgende</button>
                <button type="button" class="trade-btn trade-btn-muted" id="tradePartnerCancel">Annuleren</button>
            </div>
            <div class="trade-status-msg" id="tradePickerMsg"></div>
        </div>
    `;
    document.body.appendChild(pickerOverlay);
    const closePicker = () => pickerOverlay.remove();
    pickerOverlay.querySelector('#tradePartnerCancel').addEventListener('click', closePicker);
    pickerOverlay.addEventListener('click', (e) => { if (e.target === pickerOverlay) closePicker(); });

    pickerOverlay.querySelector('#tradePartnerStart').addEventListener('click', async () => {
        const username = pickerOverlay.querySelector('#tradePartnerUsername')?.value?.trim();
        const msg = pickerOverlay.querySelector('#tradePickerMsg');
        if (!username) {
            msg.textContent = 'Vul een gebruikersnaam in';
            msg.className = 'trade-status-msg is-error';
            return;
        }
        try {
            const lookup = await apiGet('lookupUser', { username });
            assertNotSelfTrade(lookup.user.id);
            closePicker();
            await loadCreateDraft(lookup.user.id, lookup.user.username);
            if (prefillCardId) {
                const card = state.createDraft.myInventory.find((c) => c.cardId === prefillCardId);
                if (card) addToDraftMap(state.createDraft.offerCards, card);
                renderCreateModal();
            }
        } catch (e) {
            msg.textContent = e.message;
            msg.className = 'trade-status-msg is-error';
        }
    });
}

export async function openTradeWithUserFromMarket(sellerId, sellerName) {
    assertNotSelfTrade(sellerId);
    await openTradeWithUser(sellerId, sellerName);
}

function showIncomingRequestPopup(trade) {
    if (overlayEl && !overlayEl.classList.contains('is-hidden')) return;
    state.trade = trade;
    state.mode = 'respond';
    renderTradeView();
}

async function pollIncomingTrades() {
    if (!isLoggedIn() || state.mode === 'create') return;
    if (overlayEl && !overlayEl.classList.contains('is-hidden')) return;

    try {
        const data = await apiGet('pendingIncoming');
        for (const trade of data.trades || []) {
            if (notifiedTradeIds.has(trade.id)) continue;
            notifiedTradeIds.add(trade.id);
            showIncomingRequestPopup(trade);
            break;
        }
    } catch {
        // silent
    }
}

export function initTradeNotifications() {
    if (!isLoggedIn()) return;
    if (notifyTimer) clearInterval(notifyTimer);
    pollIncomingTrades();
    notifyTimer = setInterval(pollIncomingTrades, POLL_MS);
}

if (!document.querySelector('link[data-trade-css]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${appRoot()}/styles/trade.css`;
    link.dataset.tradeCss = '1';
    document.head.appendChild(link);
}

window.PokeTrade = {
    openTradeById,
    openTradeWithUser,
    openTradePartnerPicker,
    openTradeWithUserFromMarket,
    closeTradeModal,
    initTradeNotifications,
};

function setupProfileTradeButton() {
    const btn = document.getElementById('profileTradeBtn');
    if (!btn || btn.dataset.tradeBound === '1') {
        return;
    }
    btn.dataset.tradeBound = '1';

    btn.addEventListener('click', async () => {
        const params = new URLSearchParams(window.location.search);
        const partnerId = params.get('id');
        const partnerName = document.getElementById('profileName')?.textContent?.trim() || '';

        if (!partnerId) {
            return;
        }

        if (String(partnerId) === String(currentUserId())) {
            alert('Je kunt niet met jezelf traden');
            return;
        }

        try {
            await openTradeWithUser(Number(partnerId), partnerName);
        } catch (e) {
            alert(e.message || 'Trade kon niet gestart worden');
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setupProfileTradeButton();
    if (isLoggedIn()) {
        initTradeNotifications();
    }
});
