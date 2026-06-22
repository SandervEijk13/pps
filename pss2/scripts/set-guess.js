import { formatHeaderCoins } from '/scripts/card_logic.js';
import { notification } from '/scripts/notifications.js';

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

const state = {
    coins: 0,
    minBet: 10,
    maxBet: 500,
    bet: 50,
    game: null,
    busy: false,
    awaitingContinue: false,
    lastCorrectSetId: null,
};

const els = {
    loginGate: document.getElementById('sgLoginGate'),
    main: document.getElementById('sgMain'),
    balance: document.getElementById('sgBalance'),
    multiplier: document.getElementById('sgMultiplier'),
    streak: document.getElementById('sgStreak'),
    potential: document.getElementById('sgPotential'),
    cardFrame: document.getElementById('sgCardFrame'),
    cardImg: document.getElementById('sgCardImg'),
    cardMystery: document.getElementById('sgCardMystery'),
    cardHint: document.getElementById('sgCardHint'),
    cardReveal: document.getElementById('sgCardReveal'),
    options: document.getElementById('sgOptions'),
    betPanel: document.getElementById('sgBetPanel'),
    continuePanel: document.getElementById('sgContinuePanel'),
    betInput: document.getElementById('sgBetInput'),
    btnHalf: document.getElementById('sgBtnHalf'),
    btnDouble: document.getElementById('sgBtnDouble'),
    btnMax: document.getElementById('sgBtnMax'),
    btnStart: document.getElementById('sgBtnStart'),
    btnCashOut: document.getElementById('sgBtnCashOut'),
    btnContinue: document.getElementById('sgBtnContinue'),
    status: document.getElementById('sgStatus'),
    infoModal: document.getElementById('sgInfoModal'),
    btnSgInfo: document.getElementById('btnSgInfo'),
    btnSgInfoClose: document.getElementById('btnSgInfoClose'),
    btnSgInfoGotIt: document.getElementById('btnSgInfoGotIt'),
    resultModal: document.getElementById('sgResultModal'),
    resultBadge: document.getElementById('sgResultBadge'),
    resultTitle: document.getElementById('sgResultTitle'),
    resultMessage: document.getElementById('sgResultMessage'),
    btnCloseResult: document.getElementById('sgBtnCloseResult'),
};

function isLoggedIn() {
    return sessionStorage.getItem('isLogged') === 'true' && sessionStorage.getItem('userId');
}

function setStatus(msg, isError = false) {
    if (!els.status) return;
    els.status.textContent = msg;
    els.status.classList.toggle('is-error', isError);
}

async function readApiJson(res, fallback = 'Request failed') {
    const text = await res.text();
    const start = text.indexOf('{');
    try {
        return JSON.parse(start >= 0 ? text.slice(start) : text);
    } catch {
        throw new Error(`${fallback}: ${text.slice(0, 160)}`);
    }
}

function formatMultiplier(value) {
    return `${Number(value).toFixed(2)}×`;
}

function updateHeaderCoins(coins) {
    const coinEl = document.getElementById('coin-amount');
    if (coinEl) {
        coinEl.textContent = formatHeaderCoins(coins);
    }
}

function showIdleCard() {
    els.cardFrame?.classList.add('sg-card-frame--idle');
    els.cardFrame?.classList.remove('sg-card-frame--reveal-correct', 'sg-card-frame--reveal-wrong');
    els.cardImg?.classList.add('is-hidden');
    els.cardMystery?.classList.remove('is-hidden');
    els.cardReveal?.classList.add('is-hidden');
    els.cardHint.textContent = 'Welke set hoort bij deze kaart?';
    els.options.innerHTML = '';
}

function renderCard(card) {
    if (!card?.image) return;
    els.cardFrame?.classList.remove('sg-card-frame--idle', 'sg-card-frame--reveal-correct', 'sg-card-frame--reveal-wrong');
    els.cardImg.src = card.image;
    els.cardImg.alt = card.name || 'Mystery card';
    els.cardImg.classList.remove('is-hidden');
    els.cardMystery?.classList.add('is-hidden');
    els.cardReveal?.classList.add('is-hidden');
    els.cardHint.textContent = 'Kies de juiste set';
}

function renderOptions(options, disabled = false) {
    if (!els.options) return;
    els.options.innerHTML = '';
    options.forEach((option) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sg-option-btn';
        btn.textContent = option.name;
        btn.dataset.setId = String(option.id || '');
        btn.disabled = disabled;
        els.options.appendChild(btn);
    });
}

function highlightOptions(pickedSetId, correctSetId) {
    els.options.querySelectorAll('.sg-option-btn').forEach((btn) => {
        btn.disabled = true;
        const id = btn.dataset.setId;
        if (id === correctSetId) btn.classList.add('is-correct');
        if (id === pickedSetId && pickedSetId !== correctSetId) btn.classList.add('is-wrong');
    });
}

function updateStats() {
    const game = state.game;
    els.balance.textContent = formatHeaderCoins(state.coins);
    updateHeaderCoins(state.coins);

    if (!game) {
        els.multiplier.textContent = '1.00×';
        els.streak.textContent = '0';
        els.potential.textContent = '0';
        return;
    }

    els.multiplier.textContent = formatMultiplier(game.multiplier);
    els.streak.textContent = String(game.streak);
    els.potential.textContent = formatHeaderCoins(game.potentialWin);
}

function setPanels(mode) {
    const inGame = mode === 'playing' || mode === 'continue';
    els.betPanel?.classList.toggle('is-hidden', inGame);
    els.continuePanel?.classList.toggle('is-hidden', mode !== 'continue');
    els.btnStart && (els.btnStart.disabled = state.busy || !!state.game);

    const showContinue = mode === 'continue' && state.awaitingContinue && state.game;
    if (els.btnCashOut) {
        els.btnCashOut.disabled = !showContinue || state.busy || !state.game.canCashOut;
    }
    if (els.btnContinue) {
        els.btnContinue.disabled = !showContinue || state.busy || !state.game;
    }
}

function applyGame(game) {
    state.game = game;
    if (!game) {
        showIdleCard();
        setPanels('betting');
        updateStats();
        return;
    }

    renderCard(game.card);
    renderOptions(game.options, state.awaitingContinue);
    setPanels(state.awaitingContinue ? 'continue' : 'playing');
    updateStats();
}

function clampBet(value) {
    const n = Math.round(Number(value) || state.minBet);
    return Math.max(state.minBet, Math.min(state.maxBet, n));
}

function syncBetInput() {
    state.bet = clampBet(els.betInput.value);
    els.betInput.value = String(state.bet);
}

async function resetToIdle(message = 'Zet je inzet en start de game.') {
    state.game = null;
    state.awaitingContinue = false;
    state.busy = false;
    state.lastCorrectSetId = null;
    showIdleCard();
    setPanels('betting');

    try {
        const res = await fetch(`${API}/set_guess.php?action=getState`, { credentials: 'include' });
        const data = await readApiJson(res, 'Refresh failed');
        if (data.success) {
            state.coins = data.coins;
            state.maxBet = data.maxBet;
            els.betInput.max = String(state.maxBet);
            state.bet = clampBet(state.bet);
            els.betInput.value = String(state.bet);
            if (!data.game) applyGame(null);
            else {
                state.awaitingContinue = false;
                applyGame(data.game);
            }
        }
    } catch {
        updateStats();
    }

    setStatus(message);
}

async function loadState() {
    const res = await fetch(`${API}/set_guess.php?action=getState`, { credentials: 'include' });
    const data = await readApiJson(res, 'Load failed');
    if (!data.success) throw new Error(data.message || 'Could not load game');

    state.coins = data.coins;
    state.minBet = data.minBet;
    state.maxBet = data.maxBet;
    state.bet = clampBet(state.bet);
    els.betInput.min = String(state.minBet);
    els.betInput.max = String(state.maxBet);
    els.betInput.value = String(state.bet);
    state.awaitingContinue = false;
    applyGame(data.game);
}

async function startGame() {
    if (state.busy) return;
    syncBetInput();
    state.busy = true;
    setStatus('Game starten…');

    try {
        const res = await fetch(`${API}/set_guess.php?action=start`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bet: state.bet }),
        });
        const data = await readApiJson(res, 'Start failed');

        if (!data.success) {
            setStatus(data.message || 'Kon niet starten', true);
            setPanels('betting');
            return;
        }

        state.coins = data.coins;
        state.awaitingContinue = false;
        applyGame(data.game);
        setStatus('Kies de juiste set!');
    } catch (err) {
        setStatus(err.message, true);
        setPanels('betting');
    } finally {
        state.busy = false;
        if (state.game && !state.awaitingContinue) {
            renderOptions(state.game.options, false);
        }
        setPanels(state.game ? (state.awaitingContinue ? 'continue' : 'playing') : 'betting');
    }
}

function showReveal(card, correctSetName, won) {
    els.cardFrame?.classList.toggle('sg-card-frame--reveal-correct', won);
    els.cardFrame?.classList.toggle('sg-card-frame--reveal-wrong', !won);
    els.cardReveal.classList.remove('is-hidden');
    els.cardReveal.textContent = `${card?.name || 'Kaart'} · ${correctSetName}`;
    els.cardHint.textContent = won ? 'Correct!' : 'Wrong guess';
}

function showResult(won, message, payout, multiplier) {
    els.resultBadge.textContent = won ? 'Gewonnen!' : 'Verloren';
    els.resultBadge.classList.toggle('sg-result-badge--win', won);
    els.resultBadge.classList.toggle('sg-result-badge--loss', !won);
    els.resultTitle.textContent = won ? 'Goed gedaan!' : 'Volgende keer beter';
    els.resultMessage.textContent = won
        ? `${message} ${payout > 0 ? `+${formatHeaderCoins(payout)} coins (${formatMultiplier(multiplier)})` : ''}`
        : message;
    els.resultModal.classList.remove('is-hidden');
}

async function submitGuess(setId) {
    if (state.busy || !state.game || state.awaitingContinue) return;

    state.busy = true;
    renderOptions(state.game.options, true);
    setStatus('Checking…');

    try {
        const res = await fetch(`${API}/set_guess.php?action=guess`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ setId }),
        });
        const data = await readApiJson(res, 'Guess failed');

        if (!data.success) {
            setStatus(data.message || 'Guess failed', true);
            renderOptions(state.game.options, false);
            return;
        }

        if (data.won && data.storyProgress && window.PokeNotifications) {
            window.PokeNotifications.showStoryProgress(data.storyProgress);
        }

        state.coins = data.coins;
        highlightOptions(setId, data.correctSetId);
        showReveal(data.card, data.correctSetName, data.won);
        await new Promise((r) => setTimeout(r, 900));

        if (!data.won) {
            state.game = null;
            state.awaitingContinue = false;
            updateStats();
            showResult(false, data.message, 0, 1);
            setPanels('betting');
            setStatus('');
            return;
        }

        if (data.autoCashOut) {
            state.game = null;
            state.awaitingContinue = false;
            updateStats();
            showResult(true, data.message, data.payout, data.multiplier);
            setPanels('betting');
            setStatus('');
            return;
        }

        state.game = data.game;
        state.awaitingContinue = true;
        state.lastCorrectSetId = data.correctSetId;
        updateStats();
        setStatus(data.message || 'Cash out of volgende kaart?');
    } catch (err) {
        setStatus(err.message, true);
        if (state.game) renderOptions(state.game.options, false);
    } finally {
        state.busy = false;
        if (state.awaitingContinue && state.game) {
            setPanels('continue');
        } else if (state.game) {
            setPanels('playing');
        } else {
            setPanels('betting');
        }
    }
}

async function cashOut() {
    if (state.busy || !state.game || !state.awaitingContinue) return;
    state.busy = true;
    setPanels('continue');
    setStatus('Uitbetalen…');

    try {
        const res = await fetch(`${API}/set_guess.php?action=cashout`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
        const data = await readApiJson(res, 'Cash out failed');

        if (!data.success) {
            setStatus(data.message || 'Cash out failed', true);
            return;
        }

        state.coins = data.coins;
        state.game = null;
        state.awaitingContinue = false;
        updateStats();
        setPanels('betting');
        showResult(true, data.message, data.payout, data.multiplier);
        setStatus('');
    } catch (err) {
        setStatus(err.message, true);
    } finally {
        state.busy = false;
        if (state.awaitingContinue && state.game) {
            setPanels('continue');
        }
    }
}

function continueRound() {
    if (!state.game || !state.awaitingContinue || state.busy) return;
    state.awaitingContinue = false;
    els.cardFrame?.classList.remove('sg-card-frame--reveal-correct', 'sg-card-frame--reveal-wrong');
    els.cardReveal?.classList.add('is-hidden');
    renderCard(state.game.card);
    renderOptions(state.game.options, false);
    setPanels('playing');
    setStatus('Kies de juiste set!');
}

async function hideResult() {
    els.resultModal.classList.add('is-hidden');
    await resetToIdle('Zet je inzet en start de game.');
}

function openInfoModal() {
    if (!els.infoModal) return;
    els.infoModal.classList.remove('is-hidden');
    els.infoModal.querySelectorAll('.sg-info-step').forEach((step, index) => {
        step.classList.remove('is-visible');
        window.setTimeout(() => step.classList.add('is-visible'), 70 + index * 90);
    });
}

function closeInfoModal() {
    if (!els.infoModal) return;
    els.infoModal.classList.add('is-hidden');
    els.infoModal.querySelectorAll('.sg-info-step').forEach((step) => {
        step.classList.remove('is-visible');
    });
}

function bindEvents() {
    els.betInput?.addEventListener('change', syncBetInput);
    els.betInput?.addEventListener('blur', syncBetInput);
    els.btnHalf?.addEventListener('click', () => {
        els.betInput.value = String(clampBet(state.bet / 2));
        syncBetInput();
    });
    els.btnDouble?.addEventListener('click', () => {
        els.betInput.value = String(clampBet(state.bet * 2));
        syncBetInput();
    });
    els.btnMax?.addEventListener('click', () => {
        els.betInput.value = String(state.maxBet);
        syncBetInput();
    });
    els.btnStart?.addEventListener('click', startGame);
    els.btnCashOut?.addEventListener('click', cashOut);
    els.btnContinue?.addEventListener('click', continueRound);
    els.btnCloseResult?.addEventListener('click', hideResult);
    els.resultModal?.querySelector('.sg-modal-backdrop')?.addEventListener('click', hideResult);
    els.btnSgInfo?.addEventListener('click', openInfoModal);
    els.btnSgInfoClose?.addEventListener('click', closeInfoModal);
    els.btnSgInfoGotIt?.addEventListener('click', closeInfoModal);
    els.infoModal?.querySelector('.sg-info-backdrop')?.addEventListener('click', closeInfoModal);

    els.options?.addEventListener('click', (event) => {
        const btn = event.target.closest('.sg-option-btn');
        if (!btn || btn.disabled) return;
        const setId = btn.dataset.setId;
        if (setId) submitGuess(setId);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !els.infoModal?.classList.contains('is-hidden')) {
            closeInfoModal();
        }
    });
}

async function init() {
    bindEvents();

    if (!isLoggedIn()) {
        els.loginGate?.classList.remove('is-hidden');
        els.main?.classList.add('is-hidden');
        return;
    }

    els.loginGate?.classList.add('is-hidden');
    els.main?.classList.remove('is-hidden');

    try {
        await loadState();
        setStatus('Zet je inzet en start de game.');
    } catch (err) {
        setStatus(err.message, true);
    }
}

init();
