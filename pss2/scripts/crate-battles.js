import TCGdex from '@tcgdex/sdk';
import MemoryCache from '@cachex/memory';
import {
    buildReelCrates,
    pickWeightedReelItem,
    formatCardPrice,
    formatCoinsAmount,
    formatHeaderCoins,
    getSellCoinsAmount,
    resolveTcgdexImageUrl
} from '/scripts/card_logic.js';
import { CrateReel, spinCrate } from '/scripts/crate-reel.js';
import { initGameInfo } from '/scripts/game-info.js';

const tcgdex = new TCGdex('en');
tcgdex.setCache(new MemoryCache());

function getApiBase() {
    if (window.location.port === '5173') {
        return 'http://localhost/pss/api';
    }
    const parts = window.location.pathname.split('/');
    const pagesIndex = parts.indexOf('pages');
    const rootParts = pagesIndex >= 0 ? parts.slice(0, pagesIndex) : parts.slice(0, -1);
    const root = rootParts.join('/') || '';
    return `${window.location.origin}${root}/api`;
}

const API = getApiBase();

function cardImg(card) {
    return resolveTcgdexImageUrl(card, { cardId: card?.id });
}

const MAX_CRATES = 5;
const PVP_ROOM_STORAGE_KEY = 'pss_pvp_room_code';
const AI_NAMES = ['Rival Kai', 'Team Rocket Bot', 'Gym Leader AI', 'Professor Oak Jr.', 'Champion Nexus'];

const state = {
    mode: 'solo',
    crates: [],
    selected: [],
    pvpRoom: null,
    pveToken: null,
    busy: false,
    pvpPollId: null,
    lastWonCard: null
};

let reel = null;

const els = {
    heroTitle: document.getElementById('heroTitle'),
    heroSubtitle: document.getElementById('heroSubtitle'),
    loader: document.getElementById('battleLoader'),
    loaderText: document.getElementById('battleLoaderText'),
    setup: document.getElementById('battleSetup'),
    arena: document.getElementById('battleArena'),
    results: document.getElementById('battleResults'),
    crateGrid: document.getElementById('crateSelectGrid'),
    cratePickerTitle: document.getElementById('cratePickerTitle'),
    cratePickerHint: document.getElementById('cratePickerHint'),
    selectedCount: document.getElementById('selectedCrateCount'),
    summaryWager: document.getElementById('summaryWager'),
    summaryCostLabel: document.getElementById('summaryCostLabel'),
    summaryCrates: document.getElementById('summaryCrates'),
    battleStatus: document.getElementById('battleStatus'),
    btnStart: document.getElementById('btnStartBattle'),
    btnClear: document.getElementById('btnClearCrates'),
    pvpLobby: document.getElementById('pvpLobby'),
    pvpRoomInfo: document.getElementById('pvpRoomInfo'),
    roomCodeDisplay: document.getElementById('roomCodeDisplay'),
    pvpRoomStatus: document.getElementById('pvpRoomStatus'),
    btnCreateRoom: document.getElementById('btnCreateRoom'),
    btnJoinRoom: document.getElementById('btnJoinRoom'),
    btnRefreshRoom: document.getElementById('btnRefreshRoom'),
    btnCancelRoom: document.getElementById('btnCancelRoom'),
    btnPayEntry: document.getElementById('btnPayEntry'),
    btnStartPvp: document.getElementById('btnStartPvp'),
    pvpRoomWager: document.getElementById('pvpRoomWager'),
    btnCopyCode: document.getElementById('btnCopyCode'),
    joinRoomCode: document.getElementById('joinRoomCode'),
    arenaScoreboard: document.getElementById('arenaScoreboard'),
    arenaMiniPulls: document.getElementById('arenaMiniPulls'),
    playerLabel: document.getElementById('playerLabel'),
    opponentLabel: document.getElementById('opponentLabel'),
    playerTotalValue: document.getElementById('playerTotalValue'),
    opponentTotalValue: document.getElementById('opponentTotalValue'),
    playerMiniPulls: document.getElementById('playerMiniPulls'),
    opponentMiniPulls: document.getElementById('opponentMiniPulls'),
    arenaStatus: document.getElementById('arenaStatus'),
    reelWrap: document.getElementById('reelWrap'),
    reelTrack: document.getElementById('reelTrack'),
    centerMarker: document.getElementById('centerMarker'),
    arenaPhaseBanner: document.getElementById('arenaPhaseBanner'),
    arenaPhaseText: document.getElementById('arenaPhaseText'),
    opponentPullsCol: document.getElementById('opponentPullsCol'),
    resultBanner: document.getElementById('resultBanner'),
    resultTitle: document.getElementById('resultTitle'),
    resultSubtitle: document.getElementById('resultSubtitle'),
    resultPlayerValue: document.getElementById('resultPlayerValue'),
    resultOpponentValue: document.getElementById('resultOpponentValue'),
    resultCardsWon: document.getElementById('resultCardsWon'),
    resultYourCards: document.getElementById('resultYourCards'),
    resultOpponentCards: document.getElementById('resultOpponentCards'),
    resultOpponentLabel: document.getElementById('resultOpponentLabel'),
    btnBattleAgain: document.getElementById('btnBattleAgain'),
    pullModal: document.getElementById('pullModal'),
    pullModalBackdrop: document.getElementById('pullModalBackdrop'),
    modalCardName: document.getElementById('modalCardName'),
    modalCardImg: document.getElementById('modalCardImg'),
    modalCardRarity: document.getElementById('modalCardRarity'),
    modalCardPrice: document.getElementById('modalCardPrice'),
    modalSellPrice: document.getElementById('modalSellPrice'),
    btnSell: document.getElementById('btnSell'),
    btnKeep: document.getElementById('btnKeep')
};

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isLoggedIn() {
    return sessionStorage.getItem('isLogged') === 'true' && sessionStorage.getItem('userId');
}

function requireLogin(actionLabel = 'continue') {
    if (isLoggedIn()) return true;
    setStatus(`Log in to ${actionLabel}.`, true);
    return false;
}

function setStatus(message, isError = false) {
    if (!els.battleStatus) return;
    els.battleStatus.textContent = message;
    els.battleStatus.classList.toggle('is-error', isError);
}

function setArenaStatus(message) {
    if (els.arenaStatus) els.arenaStatus.textContent = message;
}

async function readApiJson(response, fallback = 'Invalid response') {
    const text = await response.text();
    const jsonStart = text.indexOf('{');
    const jsonText = jsonStart >= 0 ? text.slice(jsonStart) : text;
    try {
        return JSON.parse(jsonText);
    } catch {
        throw new Error(`${fallback}: ${text.slice(0, 200)}`);
    }
}

async function refreshHeaderCoins() {
    const userId = sessionStorage.getItem('userId');
    const coinEl = document.getElementById('coin-amount');
    if (!userId || !coinEl) return;

    try {
        const res = await fetch(`${API}/users.php?action=getCoins&id=${userId}`, {
            credentials: 'include'
        });
        const data = await readApiJson(res);
        if (data.success) coinEl.textContent = formatHeaderCoins(data.coins);
    } catch (e) {
        notification({
            text: `Failed to refresh coins: ${e.message}`,
            duration: 5000,
            type: 'error',
            closeable: true
        });
    }
}

function getCrateById(crateId) {
    if (!crateId) return null;
    return state.crates.find((c) => c.id === crateId || c.tier === crateId) || null;
}

const START_BUTTON_LABELS = {
    solo: '<i class="fas fa-box-open"></i> Open crates',
    pve: '<i class="fas fa-play"></i> Start PvE battle',
    pvp: '<i class="fas fa-users"></i> Create / join room'
};

function updateStartButtonLabel() {
    if (!els.btnStart || state.busy) return;
    els.btnStart.innerHTML = START_BUTTON_LABELS[state.mode] || START_BUTTON_LABELS.solo;
}

function setStartButtonLoading(loading) {
    if (!els.btnStart) return;
    if (loading) {
        els.btnStart.disabled = true;
        els.btnStart.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading…';
        els.btnStart.classList.add('is-loading');
    } else {
        els.btnStart.classList.remove('is-loading');
        updateStartButtonLabel();
        updateSummary();
    }
}

function getSelectedPayload() {
    return state.selected.map((entry) => ({
        id: entry.id,
        tier: entry.tier,
        price: entry.price
    }));
}

function getTotalWager() {
    return state.selected.reduce((sum, c) => sum + Number(c.price || 0), 0);
}

function sumPullsValue(pulls) {
    return pulls.reduce((sum, card) => sum + Number(card?.price || 0), 0);
}

function getRoomCrateCount() {
    return state.pvpRoom?.crates?.length || state.selected.length;
}

function updateSummary() {
    const count = state.selected.length;
    const roomCrates = state.pvpRoom?.crates?.length || 0;
    const displayCount = state.pvpRoom?.code ? Math.max(roomCrates, count) : count;

    if (els.selectedCount) {
        els.selectedCount.textContent = state.pvpRoom?.code
            ? `${displayCount} in room`
            : `${count} / ${MAX_CRATES}`;
    }

    if (els.summaryWager) {
        const wager = state.pvpRoom?.wagerTotal ?? getTotalWager();
        els.summaryWager.textContent = formatCoinsAmount(wager);
    }

    if (els.summaryCrates) {
        const list = state.pvpRoom?.crates?.length
            ? state.pvpRoom.crates
            : state.selected.map((c) => ({ tier: c.tier }));
        els.summaryCrates.textContent = formatCrateListSummary(list);
    }

    const canStart = state.mode === 'pvp' && state.pvpRoom?.code
        ? displayCount >= 1 && !state.busy
        : count >= 1 && count <= MAX_CRATES && !state.busy;

    if (els.btnStart) {
        els.btnStart.disabled = !canStart;
        if (state.mode === 'pvp' && state.pvpRoom?.code) {
            els.btnStart.classList.add('is-hidden');
        } else {
            els.btnStart.classList.remove('is-hidden');
        }
    }

    updatePvpUi();

    const atMax = count >= MAX_CRATES;

    document.querySelectorAll('.crate-select-card').forEach((card) => {
        const crateId = card.dataset.crateId;
        const selectedCount = countSelectedCrate(crateId);
        const countEl = card.querySelector('.crate-select-count');
        const removeBtn = card.querySelector('.crate-remove-btn');
        if (countEl) countEl.textContent = String(selectedCount);
        if (removeBtn) removeBtn.disabled = selectedCount === 0;
        card.classList.toggle('is-selected', selectedCount > 0);
        card.classList.toggle('at-max', atMax);
    });
}

function renderCratePicker() {
    if (!els.crateGrid) return;
    els.crateGrid.innerHTML = '';

    state.crates.forEach((crate) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'crate-select-card';
        btn.dataset.crateId = crate.id;
        btn.dataset.tier = crate.tier;
        btn.innerHTML = `
            <span class="crate-select-count">0</span>
            <span class="crate-select-tier">${crate.tier}</span>
            <img class="crate-select-thumb" src="${crate.image}" alt="${crate.name}" />
            <span class="crate-select-name">${crate.name}</span>
            <span class="crate-select-price">${formatCoinsAmount(crate.price)}</span>
            <div class="crate-select-actions">
                <button type="button" class="crate-add-btn" aria-label="Add one">+</button>
                <button type="button" class="crate-remove-btn" aria-label="Remove one" disabled>−</button>
            </div>
        `;
        const addBtn = btn.querySelector('.crate-add-btn');
        const removeBtn = btn.querySelector('.crate-remove-btn');
        addBtn?.addEventListener('click', (event) => {
            event.stopPropagation();
            addCrate(crate);
        });
        removeBtn?.addEventListener('click', (event) => {
            event.stopPropagation();
            removeOneCrate(crate);
        });
        els.crateGrid.appendChild(btn);
    });

    updateSummary();
}

function addCrate(crate) {
    if (state.busy || state.pvpRoom?.code) return;
    if (state.selected.length >= MAX_CRATES) return;
    state.selected.push(crate);
    updateSummary();
}

function removeOneCrate(crate) {
    if (state.busy || state.pvpRoom?.code) return;
    for (let i = state.selected.length - 1; i >= 0; i--) {
        if (state.selected[i].id === crate.id) {
            state.selected.splice(i, 1);
            break;
        }
    }
    updateSummary();
}

function countSelectedCrate(crateId) {
    return state.selected.filter((c) => c.id === crateId).length;
}

function formatCrateListSummary(crates) {
    if (!crates?.length) return 'None';
    const counts = {};
    crates.forEach((c) => {
        const key = c.id || c.tier;
        const label = getCrateById(key)?.name || key;
        counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts)
        .map(([label, n]) => (n > 1 ? `${label} ×${n}` : label))
        .join(', ');
}

function clearSelection() {
    if (state.pvpRoom?.code) return;
    state.selected = [];
    updateSummary();
    setStatus('');
}

function syncSelectionFromRoom(room) {
    if (!room?.crates?.length) return;
    state.selected = room.crates.map((slot) => {
        const crate = getCrateById(slot.id || slot.tier);
        if (crate) return crate;
        return {
            tier: slot.tier,
            id: slot.id || slot.tier,
            name: slot.tier,
            price: slot.price ?? 0,
            image: '',
            items: []
        };
    });
    updateSummary();
}

function savePvpRoomCode(code) {
    if (!code) return;
    localStorage.setItem(PVP_ROOM_STORAGE_KEY, code);
    const url = new URL(window.location.href);
    url.searchParams.set('mode', 'pvp');
    url.searchParams.set('room', code);
    url.searchParams.delete('join');
    window.history.replaceState(null, '', url);
}

function clearPvpRoomStorage() {
    localStorage.removeItem(PVP_ROOM_STORAGE_KEY);
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    url.searchParams.delete('join');
    window.history.replaceState(null, '', url);
}

function canCancelPvpRoom(room) {
    if (!room?.code) return false;
    const userId = Number(sessionStorage.getItem('userId'));
    const isHost = room.youAreHost || room.host?.id === userId;
    const status = room.status;
    return isHost && (status === 'waiting' || status === 'ready') && !state.busy;
}

function enterPvpRoom(room) {
    state.pvpRoom = room;
    syncSelectionFromRoom(room);
    els.pvpRoomInfo?.classList.remove('is-hidden');
    if (els.roomCodeDisplay) els.roomCodeDisplay.textContent = room.code;
    if (els.joinRoomCode) els.joinRoomCode.value = room.code;
    updatePvpRoomStatus(room);
    savePvpRoomCode(room.code);
    updateSummary();
    updatePvpUi();
    startPvpPolling();
}

function exitPvpRoomLocal() {
    stopPvpPolling();
    clearPvpRoomStorage();
    state.pvpRoom = null;
    els.pvpRoomInfo?.classList.add('is-hidden');
    updatePvpUi();
    updateSummary();
}

async function handleActivePvpRoom(room) {
    if (room.status === 'opening' && !state.busy) {
        const userId = Number(sessionStorage.getItem('userId'));
        const isHost = room.youAreHost || room.host?.id === userId;
        const you = isHost ? room.host : room.guest;
        if (you?.pullsSubmitted && !getOpponentPulls(room).length) {
            state.busy = true;
            try {
                await waitForOpponentAndReveal(room);
            } finally {
                state.busy = false;
            }
        } else if (you?.pullsSubmitted && getOpponentPulls(room).length) {
            configureArenaLayout();
            showSection('arena');
            renderMiniPulls(els.playerMiniPulls, getYourPulls(room));
            renderMiniPulls(els.opponentMiniPulls, getOpponentPulls(room));
            els.playerTotalValue.textContent = formatCardPrice({ price: sumPullsValue(getYourPulls(room)) });
            els.opponentTotalValue.textContent = formatCardPrice({ price: sumPullsValue(getOpponentPulls(room)) });
        } else if (!you?.pullsSubmitted) {
            await runPvpBattle(room);
        }
    } else if (room.status === 'finished') {
        stopPvpPolling();
        clearPvpRoomStorage();
        showPvpResults(room);
    }
}

async function restorePvpRoom() {
    if (!isLoggedIn()) {
        clearPvpRoomStorage();
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const code = (
        params.get('room')
        || params.get('join')
        || localStorage.getItem(PVP_ROOM_STORAGE_KEY)
        || ''
    ).trim().toUpperCase();

    if (!code) return;

    setMode('pvp');

    try {
        const room = await fetchRoom(code);
        enterPvpRoom(room);
        setStatus(`Rejoined room ${room.code}.`);
        await handleActivePvpRoom(room);
    } catch (e) {
        notification({
            text: `Failed to restore PvP room: ${e.message}`,
            duration: 5000,
            type: 'error',
            closeable: true
        });
        exitPvpRoomLocal();
        setStatus('Your previous room is no longer available.', true);
    }
}

function currentUserPaidInRoom(room) {
    if (!room) return false;
    const userId = Number(sessionStorage.getItem('userId'));
    const isHost = room.youAreHost || room.host?.id === userId;
    if (isHost) return Boolean(room.host?.paid);
    if (room.youAreGuest || room.guest?.id === userId) return Boolean(room.guest?.paid);
    return false;
}

function updatePvpUi() {
    const room = state.pvpRoom;
    const inRoom = state.mode === 'pvp' && room?.code;

    if (!inRoom) {
        els.btnPayEntry?.classList.add('is-hidden');
        els.btnStartPvp?.classList.add('is-hidden');
        els.btnStart?.classList.remove('is-hidden');
        return;
    }

    els.btnStart?.classList.add('is-hidden');

    const wager = room.wagerTotal ?? 0;
    if (els.pvpRoomWager) {
        els.pvpRoomWager.textContent = `Entry per player: ${formatCoinsAmount(wager)}`;
    }

    const hasGuest = Boolean(room.guest);
    const youPaid = currentUserPaidInRoom(room);
    const bothPaid = room.host?.paid && room.guest?.paid;
    const canPay = hasGuest && !youPaid && !state.busy;
    const canStart = bothPaid && room.status === 'opening' && !state.busy;

    if (els.btnPayEntry) {
        els.btnPayEntry.classList.toggle('is-hidden', youPaid || !hasGuest);
        els.btnPayEntry.disabled = !canPay;
        els.btnPayEntry.innerHTML = hasGuest
            ? `<i class="fas fa-coins"></i> Pay entry (${formatCoinsAmount(wager)})`
            : `<i class="fas fa-coins"></i> Pay entry`;
    }

    if (els.btnStartPvp) {
        els.btnStartPvp.classList.toggle('is-hidden', !bothPaid || room.status === 'finished');
        els.btnStartPvp.disabled = !canStart;
    }

    if (els.btnCancelRoom) {
        const showCancel = canCancelPvpRoom(room);
        els.btnCancelRoom.classList.toggle('is-hidden', !showCancel);
        els.btnCancelRoom.disabled = !showCancel;
    }
}

function showSection(section) {
    els.setup?.classList.toggle('is-hidden', section !== 'setup');
    els.arena?.classList.toggle('is-hidden', section !== 'arena');
    els.results?.classList.toggle('is-hidden', section !== 'results');
}

function configureArenaLayout() {
    const isSolo = state.mode === 'solo';
    els.arenaScoreboard?.classList.toggle('is-hidden', isSolo);
    els.arenaMiniPulls?.classList.toggle('is-hidden', isSolo);
}

function appendMiniPull(container, card) {
    if (!container || !card) return;
    const img = document.createElement('img');
    img.className = 'mini-pull-thumb';
    img.src = cardImg(card);
    img.alt = card.name;
    img.title = `${card.name} — ${formatCardPrice({ price: card.price })}`;
    container.appendChild(img);
}

function renderMiniPulls(container, pulls = []) {
    if (!container) return;
    container.innerHTML = '';
    pulls.forEach((card) => appendMiniPull(container, card));
}

function getOpponentPulls(room) {
    const userId = Number(sessionStorage.getItem('userId'));
    const isHost = room.youAreHost || room.host?.id === userId;
    return isHost ? (room.guest?.pulls || []) : (room.host?.pulls || []);
}

function getYourPulls(room) {
    const userId = Number(sessionStorage.getItem('userId'));
    const isHost = room.youAreHost || room.host?.id === userId;
    return isHost ? (room.host?.pulls || []) : (room.guest?.pulls || []);
}

async function fetchRoom(code) {
    const res = await fetch(
        `${API}/crate_battles.php?action=getRoom&code=${encodeURIComponent(code)}`,
        { credentials: 'include' }
    );
    const data = await readApiJson(res, 'Get room failed');
    if (!data.success) throw new Error(data.message || 'Room not found');
    return data.room;
}

async function revealOpponentPulls(room) {
    const theirPulls = getOpponentPulls(room);
    if (!theirPulls.length) return room;

    const crates = room.crates || [];
    const them = room.youAreHost ? room.guest : room.host;
    const opponentName = them?.username || 'Opponent';
    if (els.opponentLabel) els.opponentLabel.textContent = opponentName;

    if (els.opponentMiniPulls) els.opponentMiniPulls.innerHTML = '';
    setArenaPhase('opponent', opponentName);

    for (let i = 0; i < theirPulls.length; i++) {
        const pull = theirPulls[i];
        const crate = getCrateById(crates[i]?.id || crates[i]?.tier) || state.crates[0];
        if (!crate) {
            appendMiniPull(els.opponentMiniPulls, pull);
            continue;
        }
        await spinCrateAnimated(
            crate,
            `${opponentName} — crate ${i + 1} of ${theirPulls.length}`,
            'opponent',
            opponentName,
            pull
        );
        appendMiniPull(els.opponentMiniPulls, pull);
    }

    els.opponentTotalValue.textContent = formatCardPrice({ price: sumPullsValue(theirPulls) });
    setArenaPhase(null);
    return room;
}

async function waitForOpponentAndReveal(room) {
    configureArenaLayout();
    showSection('arena');

    const you = getYourPulls(room);
    renderMiniPulls(els.playerMiniPulls, you);
    els.playerTotalValue.textContent = formatCardPrice({ price: sumPullsValue(you) });

    let finalRoom = room;
    for (let i = 0; i < 50; i++) {
        const theirPulls = getOpponentPulls(finalRoom);
        if (theirPulls.length > 0) {
            await revealOpponentPulls(finalRoom);
            if (finalRoom.status !== 'finished') {
                for (let j = 0; j < 20; j++) {
                    await sleep(800);
                    try {
                        finalRoom = await fetchRoom(finalRoom.code);
                        state.pvpRoom = finalRoom;
                        if (finalRoom.status === 'finished') break;
                    } catch {
                        break;
                    }
                }
            }
            if (finalRoom.status === 'finished') {
                stopPvpPolling();
                showPvpResults(finalRoom);
            } else {
                setArenaStatus('Opponent finished. Waiting for battle result…');
            }
            return finalRoom;
        }
        if (finalRoom.status === 'finished') {
            finalRoom = await fetchRoom(finalRoom.code);
            await revealOpponentPulls(finalRoom);
            stopPvpPolling();
            showPvpResults(finalRoom);
            return finalRoom;
        }
        const waitName = (finalRoom.youAreHost ? finalRoom.guest : finalRoom.host)?.username || 'Opponent';
        setArenaPhase('opponent', waitName);
        setArenaStatus(`Waiting for ${waitName} to open crates…`);
        await sleep(1500);
        finalRoom = await fetchRoom(finalRoom.code);
        state.pvpRoom = finalRoom;
    }

    setArenaStatus('Still waiting for opponent — use Refresh.');
    return finalRoom;
}

function resetArenaPulls() {
    if (els.playerMiniPulls) els.playerMiniPulls.innerHTML = '';
    if (els.opponentMiniPulls) els.opponentMiniPulls.innerHTML = '';
    if (els.playerTotalValue) els.playerTotalValue.textContent = '€0.00';
    if (els.opponentTotalValue) els.opponentTotalValue.textContent = '€0.00';
    reel?.hide();
    setArenaPhase(null);
}

function setArenaPhase(phase, opponentName = '') {
    const arena = els.arena;
    if (arena) {
        arena.classList.remove('phase-you', 'phase-opponent');
        if (phase === 'you') arena.classList.add('phase-you');
        if (phase === 'opponent') arena.classList.add('phase-opponent');
    }

    if (!els.arenaPhaseBanner) return;

    if (!phase) {
        els.arenaPhaseBanner.classList.remove('is-visible', 'phase-you', 'phase-opponent');
        return;
    }

    els.arenaPhaseBanner.classList.add('is-visible');
    els.arenaPhaseBanner.classList.toggle('phase-you', phase === 'you');
    els.arenaPhaseBanner.classList.toggle('phase-opponent', phase === 'opponent');

    const icon = els.arenaPhaseBanner.querySelector('i');
    if (icon) {
        icon.className = phase === 'opponent' ? 'fas fa-eye' : 'fas fa-box-open';
    }

    if (phase === 'opponent') {
        const name = opponentName || els.opponentLabel?.textContent || 'Opponent';
        if (els.arenaPhaseText) {
            els.arenaPhaseText.textContent = `Watching ${name} open crates`;
        }
    } else if (els.arenaPhaseText) {
        els.arenaPhaseText.textContent = 'Your turn — opening crates';
    }
}

function normalizePullForReel(pull, crate) {
    if (!pull) return pull;
    const fromPool = crate?.items?.find((it) => it.id === pull.id);
    return fromPool ? { ...fromPool, ...pull } : pull;
}

async function spinCrateAnimated(crate, label, phase = 'you', opponentName = '', fixedWinner = null) {
    setArenaPhase(phase, opponentName);
    setArenaStatus(label || (phase === 'opponent' ? 'Watching opponent…' : 'Spinning reel…'));
    const predetermined = fixedWinner != null
        ? normalizePullForReel(fixedWinner, crate)
        : null;
    const winner = await spinCrate(crate, reel, predetermined);
    await sleep(400);
    reel?.hide();
    return winner;
}

function showPullModal(card) {
    return new Promise((resolve) => {
        state.lastWonCard = card;
        const sellCoins = getSellCoinsAmount(card.price);

        els.modalCardName.textContent = card.name;
        els.modalCardImg.src = cardImg(card);
        els.modalCardImg.alt = card.name;
        els.modalCardRarity.textContent = card.rarityLabel || card.rarity || '';
        els.modalCardPrice.textContent = `Value: ${formatCardPrice({ price: card.price })}`;
        els.modalSellPrice.textContent = `Sell for ${formatCoinsAmount(sellCoins)} (80%)`;
        els.btnSell.textContent = `Sell (${formatCoinsAmount(sellCoins)})`;

        const cleanup = () => {
            els.pullModal?.classList.remove('is-open');
            els.pullModal?.setAttribute('aria-hidden', 'true');
            els.btnSell?.removeEventListener('click', onSell);
            els.btnKeep?.removeEventListener('click', onKeep);
            els.pullModalBackdrop?.removeEventListener('click', onBackdrop);
        };

        const finish = (action) => {
            cleanup();
            resolve(action);
        };

        const onSell = () => finish('sell');
        const onKeep = () => finish('keep');
        const onBackdrop = () => finish('keep');

        els.btnSell?.addEventListener('click', onSell);
        els.btnKeep?.addEventListener('click', onKeep);
        els.pullModalBackdrop?.addEventListener('click', onBackdrop);

        els.pullModal?.classList.add('is-open');
        els.pullModal?.setAttribute('aria-hidden', 'false');
    });
}

async function payForCrate(crate) {
    const res = await fetch(`${API}/users.php?action=removeCoins`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: crate.price })
    });
    const data = await readApiJson(res, 'Payment failed');
    if (!data.success) throw new Error(data.message || 'Not enough coins');
    await refreshHeaderCoins();
    return data;
}

async function sellCard(card) {
    const res = await fetch(`${API}/users.php?action=instaSell`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardValue: card.price || 0 })
    });
    return readApiJson(res, 'Sell failed');
}

async function keepCard(card) {
    const res = await fetch(`${API}/add_card.php`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: card.id })
    });
    return readApiJson(res, 'Keep failed');
}

async function runSoloOpen() {
    configureArenaLayout();
    showSection('arena');
    resetArenaPulls();

    const queue = [...state.selected];

    for (let i = 0; i < queue.length; i++) {
        const crate = queue[i];
        setArenaStatus(`Paying for ${crate.name} (${i + 1}/${queue.length})…`);
        await payForCrate(crate);

        const winner = await spinCrateAnimated(crate, `Opening ${crate.name}…`, 'you');
        if (!winner) continue;

        const action = await showPullModal(winner);
        if (action === 'sell') {
            await sellCard(winner);
            await refreshHeaderCoins();
        } else {
            await keepCard(winner);
        }
    }

    setArenaStatus('Done! Pick more crates or switch to battles.');
    await sleep(800);
    showSection('setup');
    clearSelection();
}

async function runPveBattle() {
    configureArenaLayout();
    showSection('arena');
    resetArenaPulls();

    const payload = { crates: getSelectedPayload() };
    const startRes = await fetch(`${API}/crate_battles.php?action=startPve`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const startData = await readApiJson(startRes, 'Start PvE failed');
    if (!startData.success) throw new Error(startData.message || 'Could not start battle');

    state.pveToken = startData.token;
    await refreshHeaderCoins();

    const opponentName = AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)];
    els.playerLabel.textContent = sessionStorage.getItem('username') || 'You';
    els.opponentLabel.textContent = opponentName;

    const playerPulls = [];
    const opponentPulls = [];

    for (let i = 0; i < state.selected.length; i++) {
        const crate = state.selected[i];
        setArenaStatus(`Your crate ${i + 1}/${state.selected.length}…`);
        const pull = await spinCrateAnimated(crate, `You — ${crate.name}`, 'you');
        playerPulls.push(pull);
        appendMiniPull(els.playerMiniPulls, pull);
        els.playerTotalValue.textContent = formatCardPrice({ price: sumPullsValue(playerPulls) });
    }

    for (let i = 0; i < state.selected.length; i++) {
        const crate = state.selected[i];
        setArenaStatus(`${opponentName} — crate ${i + 1}/${state.selected.length}…`);
        const pull = pickWeightedReelItem(crate.items || []);
        opponentPulls.push(pull);
        await spinCrateAnimated(crate, `${opponentName} — ${crate.name}`, 'opponent', opponentName, pull);
        appendMiniPull(els.opponentMiniPulls, pull);
        els.opponentTotalValue.textContent = formatCardPrice({ price: sumPullsValue(opponentPulls) });
    }

    setArenaStatus('Calculating winner…');
    await sleep(500);

    const completeRes = await fetch(`${API}/crate_battles.php?action=completePve`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            token: state.pveToken,
            playerPulls,
            opponentPulls
        })
    });
    const completeData = await readApiJson(completeRes, 'Complete PvE failed');
    if (!completeData.success) throw new Error(completeData.message || 'Could not finish battle');

    await refreshHeaderCoins();
    showResults({
        won: completeData.outcome === 'win',
        playerValue: completeData.playerValue,
        opponentValue: completeData.opponentValue,
        yourPulls: playerPulls,
        theirPulls: opponentPulls,
        wonCards: completeData.outcome === 'win' ? [...playerPulls, ...opponentPulls] : [],
        opponentName
    });
}

async function createPvpRoom() {
    if (!requireLogin('create a room')) return;

    if (state.selected.length < 1) {
        setStatus('Select at least one crate before creating a room.', true);
        return;
    }

    state.busy = true;
    if (els.btnCreateRoom) els.btnCreateRoom.disabled = true;
    setStatus('Creating room…');

    try {
        const res = await fetch(`${API}/crate_battles.php?action=createRoom`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ crates: getSelectedPayload() })
        });
        const data = await readApiJson(res, 'Create room failed');

        if (!data.success) throw new Error(data.message || 'Could not create room');

        enterPvpRoom({ ...data.room, youAreHost: true });
        els.pvpRoomStatus.textContent = 'Share this code. Waiting for opponent to join…';
        setStatus(`Room ${data.room.code} created! Share the code. Pay when your opponent has joined.`);
    } catch (e) {
        notification({
            text: `Failed to create PvP room: ${e.message}`,
            duration: 5000,
            type: 'error',
            closeable: true
        });

        setStatus(e.message, true);
    } finally {
        state.busy = false;
        if (els.btnCreateRoom) els.btnCreateRoom.disabled = false;
        updatePvpUi();
    }
}

async function joinPvpRoom() {
    if (!requireLogin('join a room')) return;

    const code = (els.joinRoomCode?.value || '').trim().toUpperCase();
    if (!code) {
        setStatus('Enter a 6-character room code.', true);
        return;
    }

    state.busy = true;
    if (els.btnJoinRoom) els.btnJoinRoom.disabled = true;
    setStatus('Joining room…');

    try {
        const res = await fetch(`${API}/crate_battles.php?action=joinRoom`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        const data = await readApiJson(res, 'Join room failed');

        if (!data.success) throw new Error(data.message || 'Could not join room');

        enterPvpRoom(data.room);
        setStatus(`Joined room ${data.room.code}. Click Pay entry below.`);
    } catch (e) {
        notification({
            text: `Failed to join PvP room: ${e.message}`,
            duration: 5000,
            type: 'error',
            closeable: true
        });
        
        setStatus(e.message, true);
    } finally {
        state.busy = false;
        if (els.btnJoinRoom) els.btnJoinRoom.disabled = false;
        updatePvpUi();
    }
}

function startPvpPolling() {
    if (state.pvpPollId) return;
    state.pvpPollId = window.setInterval(() => {
        if (state.mode === 'pvp' && state.pvpRoom?.code && !state.busy) {
            refreshPvpRoom();
        }
    }, 2500);
}

function stopPvpPolling() {
    if (state.pvpPollId) {
        clearInterval(state.pvpPollId);
        state.pvpPollId = null;
    }
}

async function refreshPvpRoom() {
    if (!state.pvpRoom?.code) return;

    try {
        const res = await fetch(
            `${API}/crate_battles.php?action=getRoom&code=${encodeURIComponent(state.pvpRoom.code)}`,
            { credentials: 'include' }
        );
        const data = await readApiJson(res, 'Get room failed');
        if (!data.success) {
            setStatus(data.message || 'Room not found', true);
            exitPvpRoomLocal();
            return;
        }

        state.pvpRoom = data.room;
        savePvpRoomCode(data.room.code);
        updatePvpRoomStatus(data.room);
        updatePvpUi();
        await handleActivePvpRoom(data.room);
    } catch (e) {
        notification({
            text: `Failed to refresh PvP room: ${e.message}`,
            duration: 5000,
            type: 'warning',
            closeable: true
        });
    }
}

async function cancelPvpRoom() {
    if (!state.pvpRoom?.code || !canCancelPvpRoom(state.pvpRoom)) return;
    if (!requireLogin('cancel the room')) return;

    if (!window.confirm('Cancel this room? It will be removed and cannot be rejoined.')) {
        return;
    }

    state.busy = true;
    if (els.btnCancelRoom) els.btnCancelRoom.disabled = true;
    setStatus('Cancelling room…');

    try {
        const res = await fetch(`${API}/crate_battles.php?action=cancelRoom`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: state.pvpRoom.code })
        });
        const data = await readApiJson(res, 'Cancel room failed');
        if (!data.success) throw new Error(data.message || 'Could not cancel room');

        exitPvpRoomLocal();
        clearSelection();
        await refreshHeaderCoins();
        setStatus('Room cancelled.');
    } catch (e) {
        notification({
            text: `Failed to cancel PvP room: ${e.message}`,
            duration: 5000,
            type: 'error',
            closeable: true
        });

        setStatus(e.message, true);
    } finally {
        state.busy = false;
        updatePvpUi();
    }
}

function updatePvpRoomStatus(room) {
    if (!els.pvpRoomStatus) return;

    const youPaid = currentUserPaidInRoom(room);

    if (!room.guest) {
        els.pvpRoomStatus.textContent = 'Waiting for opponent to join… (pay unlocks after they join)';
        return;
    }

    const hostPaid = room.host?.paid;
    const guestPaid = room.guest?.paid;

    if (!hostPaid || !guestPaid) {
        if (!youPaid) {
            els.pvpRoomStatus.textContent = 'Opponent is here — use Pay entry below.';
        } else {
            els.pvpRoomStatus.textContent = `You paid ✓ · Waiting for opponent (${hostPaid ? 'host paid' : 'host not paid'}, ${guestPaid ? 'guest paid' : 'guest not paid'})`;
        }
        return;
    }

    if (room.status === 'opening') {
        els.pvpRoomStatus.textContent = 'Both paid — click Start battle or wait for auto-start.';
    } else if (room.status === 'finished') {
        els.pvpRoomStatus.textContent = 'Battle finished.';
    }
}

async function payPvpEntry() {
    if (!state.pvpRoom?.code) {
        throw new Error('No room — create or join first.');
    }
    if (!state.pvpRoom.guest) {
        throw new Error('Waiting for an opponent to join before you can pay.');
    }
    if (currentUserPaidInRoom(state.pvpRoom)) {
        return state.pvpRoom;
    }

    const res = await fetch(`${API}/crate_battles.php?action=payEntry`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: state.pvpRoom.code })
    });
    const data = await readApiJson(res, 'Pay entry failed');
    if (!data.success) throw new Error(data.message || 'Payment failed');
    await refreshHeaderCoins();
    state.pvpRoom = data.room;
    updatePvpRoomStatus(data.room);
    updatePvpUi();
    return data.room;
}

async function onPayEntryClick() {
    if (!requireLogin('pay entry')) return;

    state.busy = true;
    if (els.btnPayEntry) els.btnPayEntry.disabled = true;
    setStatus('Processing payment…');

    try {
        const room = await payPvpEntry();
        setStatus('Entry paid! ' + (room.host?.paid && room.guest?.paid
            ? 'Both players ready — start the battle.'
            : 'Waiting for opponent to pay.'));

        if (room.host?.paid && room.guest?.paid && room.status === 'opening') {
            await runPvpBattle(room);
        }
    } catch (e) {
        notification({
            text: `Failed to pay PvP entry: ${e.message}`,
            duration: 5000,
            type: 'error',
            closeable: true
        });

        setStatus(e.message, true);
    } finally {
        state.busy = false;
        updatePvpUi();
    }
}

async function onStartPvpClick() {
    if (!state.pvpRoom?.code) return;
    if (!state.pvpRoom.host?.paid || !state.pvpRoom.guest?.paid) {
        setStatus('Both players must pay entry first.', true);
        return;
    }
    state.busy = true;
    const prevLabel = els.btnStartPvp?.innerHTML;
    if (els.btnStartPvp) {
        els.btnStartPvp.disabled = true;
        els.btnStartPvp.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading…';
    }
    try {
        await runPvpBattle(state.pvpRoom);
    } catch (e) {
        notification({
            text: `Failed to start PvP battle: ${e.message}`,
            duration: 5000,
            type: 'error',
            closeable: true
        });

        setStatus(e.message, true);
    } finally {
        state.busy = false;
        if (els.btnStartPvp && prevLabel) {
            els.btnStartPvp.innerHTML = prevLabel;
        }
        updatePvpUi();
    }
}

async function runPvpBattle(room) {
    if (state.busy) return;

    const userId = Number(sessionStorage.getItem('userId'));
    const isHost = room.youAreHost || room.host?.id === userId;
    const you = isHost ? room.host : room.guest;

    if (you?.pullsSubmitted && room.status !== 'finished') {
        state.busy = true;
        try {
            await waitForOpponentAndReveal(room);
        } finally {
            state.busy = false;
        }
        return;
    }

    if (room.status === 'finished') {
        showPvpResults(room);
        return;
    }

    state.busy = true;
    configureArenaLayout();
    showSection('arena');
    resetArenaPulls();

    const them = isHost ? room.guest : room.host;
    els.playerLabel.textContent = sessionStorage.getItem('username') || 'You';
    els.opponentLabel.textContent = them?.username || 'Opponent';

    const crates = room.crates || [];
    const pulls = [];

    for (let i = 0; i < crates.length; i++) {
        const crate = getCrateById(crates[i].id || crates[i].tier);
        if (!crate) continue;
        const pull = await spinCrateAnimated(crate, `Your crate ${i + 1}/${crates.length}…`, 'you');
        pulls.push(pull);
        appendMiniPull(els.playerMiniPulls, pull);
        els.playerTotalValue.textContent = formatCardPrice({ price: sumPullsValue(pulls) });
    }

    const submitRes = await fetch(`${API}/crate_battles.php?action=submitPulls`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: room.code, pulls })
    });
    const submitData = await readApiJson(submitRes, 'Submit pulls failed');
    if (!submitData.success) throw new Error(submitData.message || 'Could not submit pulls');

    state.pvpRoom = submitData.room;
    setArenaStatus('Waiting for opponent…');

    const finalRoom = await waitForOpponentAndReveal(submitData.room);

    if (finalRoom.status === 'finished') {
        stopPvpPolling();
        showPvpResults(finalRoom);
    }

    state.busy = false;
}

function showPvpResults(room) {
    clearPvpRoomStorage();
    const userId = Number(sessionStorage.getItem('userId'));
    const isHost = room.youAreHost || room.host?.id === userId;
    const yourPulls = isHost ? (room.host?.pulls || []) : (room.guest?.pulls || []);
    const theirPulls = isHost ? (room.guest?.pulls || []) : (room.host?.pulls || []);
    const yourValue = isHost ? room.host?.totalValue : room.guest?.totalValue;
    const theirValue = isHost ? room.guest?.totalValue : room.host?.totalValue;
    const won = room.winnerId === userId;

    const opponentName = isHost ? room.guest?.username : room.host?.username;

    showResults({
        won,
        playerValue: yourValue,
        opponentValue: theirValue,
        yourPulls,
        theirPulls,
        opponentName
    });
}

function renderResultCards(container, cards = []) {
    if (!container) return;
    container.innerHTML = '';
    if (!cards.length) {
        container.innerHTML = '<p class="result-empty">—</p>';
        return;
    }
    cards.forEach((card) => {
        const tile = document.createElement('div');
        tile.className = 'result-card-tile';
        tile.innerHTML = `<img src="${cardImg(card)}" alt="${card.name}" /><span>${card.name}</span>`;
        container.appendChild(tile);
    });
}

function showResults({ won, playerValue, opponentValue, yourPulls = [], theirPulls = [], wonCards, opponentName }) {
    showSection('results');
    reel?.hide();

    const yours = yourPulls.length ? yourPulls : [];
    const theirs = theirPulls.length ? theirPulls : [];
    const allWon = wonCards?.length ? wonCards : (won ? [...yours, ...theirs] : []);

    els.resultBanner.classList.toggle('lose', !won);
    els.resultTitle.textContent = won ? 'Victory!' : 'Defeat';
    els.resultSubtitle.textContent = won
        ? `You beat ${opponentName || 'your opponent'} and claimed every card.`
        : `${opponentName || 'Your opponent'} had higher total value.`;

    els.resultPlayerValue.textContent = formatCardPrice({ price: playerValue });
    els.resultOpponentValue.textContent = formatCardPrice({ price: opponentValue });
    els.resultCardsWon.textContent = String(won ? allWon.length : 0);

    if (els.resultOpponentLabel) {
        els.resultOpponentLabel.textContent = `${opponentName || 'Opponent'} pulls`;
    }

    renderResultCards(els.resultYourCards, yours);
    renderResultCards(els.resultOpponentCards, theirs);
}

async function startBattle() {
    if (!requireLogin('play')) return;

    if (state.selected.length < 1) {
        setStatus('Select at least one crate.', true);
        return;
    }

    state.busy = true;
    setStartButtonLoading(true);
    setStatus('');

    try {
        if (state.mode === 'solo') {
            await runSoloOpen();
        } else if (state.mode === 'pve') {
            await runPveBattle();
        } else if (state.mode === 'pvp') {
            setStatus('Use Pay entry in the room panel above.', true);
            return;
        }
    } catch (e) {
        notification({
            text: `Failed to start battle: ${e.message}`,
            duration: 5000,
            type: 'error',
            closeable: true
        });
        setStatus(e.message || 'Something went wrong', true);
        showSection('setup');
    } finally {
        state.busy = false;
        setStartButtonLoading(false);
    }
}

function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll('.mode-btn').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.mode === mode);
    });
    els.pvpLobby?.classList.toggle('is-hidden', mode !== 'pvp');

    if (mode === 'solo') {
        els.summaryCostLabel.textContent = 'Total cost';
        els.cratePickerHint.textContent = 'Use + to add crates (same type allowed, max 5).';
        if (els.heroTitle) els.heroTitle.textContent = 'Open crates on the reel.';
    } else if (mode === 'pve') {
        els.summaryCostLabel.textContent = 'Entry cost';
        els.cratePickerHint.textContent = 'Use + to queue crates for battle (max 5, duplicates OK).';
        if (els.heroTitle) els.heroTitle.textContent = 'Battle the AI. Highest value wins all cards.';
    } else {
        els.summaryCostLabel.textContent = 'Entry per player';
        els.cratePickerHint.textContent = 'Host: + crates → Create room. Guest joins → Pay entry.';
        if (els.heroTitle) els.heroTitle.textContent = 'PvP crate battles with room codes.';
    }

    updateStartButtonLabel();

    updatePvpUi();

    setStatus(mode === 'pvp'
        ? 'Create or join a room. Pay entry appears in the room box when both players are present.'
        : '');
}

function resetToSetup() {
    stopPvpPolling();
    clearPvpRoomStorage();
    state.pveToken = null;
    state.pvpRoom = null;
    state.busy = false;
    clearSelection();
    reel?.hide();
    showSection('setup');
    setStatus('');
    els.pvpRoomInfo?.classList.add('is-hidden');
    updatePvpUi();
}

function bindEvents() {
    initGameInfo();
    document.querySelectorAll('.mode-btn').forEach((btn) => {
        btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });

    els.btnClear?.addEventListener('click', clearSelection);
    els.btnStart?.addEventListener('click', startBattle);
    els.btnCreateRoom?.addEventListener('click', createPvpRoom);
    els.btnJoinRoom?.addEventListener('click', joinPvpRoom);
    els.btnRefreshRoom?.addEventListener('click', refreshPvpRoom);
    els.btnCancelRoom?.addEventListener('click', cancelPvpRoom);
    els.btnPayEntry?.addEventListener('click', onPayEntryClick);
    els.btnStartPvp?.addEventListener('click', onStartPvpClick);
    els.btnBattleAgain?.addEventListener('click', resetToSetup);

    els.btnCopyCode?.addEventListener('click', () => {
        const code = state.pvpRoom?.code || els.roomCodeDisplay?.textContent;
        if (code) navigator.clipboard?.writeText(code);
        setStatus('Room code copied.');
    });

    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');
    const modeParam = params.get('mode');

    const roomCode = params.get('room');

    if ((joinCode || roomCode) && els.joinRoomCode) {
        setMode('pvp');
        els.joinRoomCode.value = (roomCode || joinCode).toUpperCase();
    } else if (modeParam === 'battle' || modeParam === 'pve') {
        setMode('pve');
    } else if (modeParam === 'pvp') {
        setMode('pvp');
    } else {
        setMode('solo');
    }
}

async function loadBattleCrates() {
    const res = await fetch(`${API}/crates.php?action=getCrates`, { credentials: 'include' });
    const data = await readApiJson(res, 'Could not load crates');

    if (data.success && data.crates?.length && !data.needsSeed) {
        return { crates: data.crates, fromDb: true };
    }

    if (els.loaderText) els.loaderText.textContent = 'Building global crate catalog (one-time)…';

    const built = await buildReelCrates((msg) => {
        if (els.loaderText) els.loaderText.textContent = msg;
    }, { catalogSeed: 'pss-global-v1' });

    if (!isLoggedIn()) {
        return { crates: built.crates || [], fromDb: false };
    }

    const syncRes = await fetch(`${API}/crates.php?action=syncCrates`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            crates: built.crates,
            poolSeed: 'pss-global-v1'
        })
    });
    const syncData = await readApiJson(syncRes, 'Could not save crates');

    if (syncData.success && syncData.crates?.length) {
        return { crates: syncData.crates, fromDb: true };
    }

    return { crates: built.crates || [], fromDb: false };
}

async function init() {
    reel = new CrateReel({
        trackEl: els.reelTrack,
        wrapEl: els.reelWrap,
        markerEl: els.centerMarker
    });

    bindEvents();

    try {
        if (els.loaderText) els.loaderText.textContent = 'Loading crates…';
        const data = await loadBattleCrates();
        state.crates = data.crates || [];
        els.loader?.classList.add('is-hidden');
        els.setup?.classList.remove('is-hidden');
        renderCratePicker();
        updateStartButtonLabel();
        await refreshHeaderCoins();

        if (!isLoggedIn()) {
            setStatus('Log in to open crates or battle.');
        } else if (!data.fromDb) {
            setStatus('Using local crates — log in once to save the catalog for everyone.');
        }

        await restorePvpRoom();
    } catch (e) {
        notification({
            text: `Failed to load crates: ${e.message}`,
            duration: 5000,
            type: 'error',
            closeable: true
        });

        if (els.loaderText) els.loaderText.textContent = 'Could not load crates. Refresh the page.';
    }
}

init();
