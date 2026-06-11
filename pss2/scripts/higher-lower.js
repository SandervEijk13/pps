import { formatHeaderCoins } from '/scripts/card_logic.js';

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
};

const els = {
    loginGate: document.getElementById('hlLoginGate'),
    main: document.getElementById('hlMain'),
    balance: document.getElementById('hlBalance'),
    multiplier: document.getElementById('hlMultiplier'),
    streak: document.getElementById('hlStreak'),
    potential: document.getElementById('hlPotential'),
    frameA: document.getElementById('hlFrameA'),
    imgA: document.getElementById('hlImgA'),
    nameA: document.getElementById('hlNameA'),
    priceA: document.getElementById('hlPriceA'),
    overlayA: document.getElementById('hlOverlayA'),
    mysteryA: document.getElementById('hlMysteryA'),
    imgB: document.getElementById('hlImgB'),
    nameB: document.getElementById('hlNameB'),
    priceB: document.getElementById('hlPriceB'),
    frameB: document.getElementById('hlFrameB'),
    overlayB: document.getElementById('hlOverlayB'),
    mystery: document.getElementById('hlMystery'),
    infoModal: document.getElementById('hlInfoModal'),
    btnHlInfo: document.getElementById('btnHlInfo'),
    btnHlInfoClose: document.getElementById('btnHlInfoClose'),
    btnHlInfoGotIt: document.getElementById('btnHlInfoGotIt'),
    betPanel: document.getElementById('hlBetPanel'),
    playPanel: document.getElementById('hlPlayPanel'),
    continuePanel: document.getElementById('hlContinuePanel'),
    betInput: document.getElementById('hlBetInput'),
    btnHalf: document.getElementById('hlBtnHalf'),
    btnDouble: document.getElementById('hlBtnDouble'),
    btnMax: document.getElementById('hlBtnMax'),
    btnStart: document.getElementById('hlBtnStart'),
    btnLower: document.getElementById('hlBtnLower'),
    btnHigher: document.getElementById('hlBtnHigher'),
    btnCashOut: document.getElementById('hlBtnCashOut'),
    btnContinue: document.getElementById('hlBtnContinue'),
    status: document.getElementById('hlStatus'),
    resultModal: document.getElementById('hlResultModal'),
    resultBadge: document.getElementById('hlResultBadge'),
    resultTitle: document.getElementById('hlResultTitle'),
    resultMessage: document.getElementById('hlResultMessage'),
    btnCloseResult: document.getElementById('hlBtnCloseResult'),
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

function showIdleCards() {
    els.frameA?.classList.add('hl-card-frame--idle');
    els.frameB?.classList.add('hl-card-frame--idle', 'hl-card-frame--hidden');
    els.frameB?.classList.remove('hl-card-frame--revealed', 'hl-card-frame--flip');
    els.imgA?.classList.add('is-hidden');
    els.imgB?.classList.add('is-hidden');
    els.overlayA?.classList.add('hl-card-overlay--hidden');
    els.overlayB?.classList.add('hl-card-overlay--hidden');
    els.mysteryA?.classList.remove('is-hidden');
    els.mystery?.classList.remove('is-hidden');
}

function renderCardA(card) {
    if (!card) return;
    els.frameA?.classList.remove('hl-card-frame--idle');
    els.imgA.src = card.image || '';
    els.imgA.alt = card.name || 'Card A';
    els.nameA.textContent = card.name || '';
    els.priceA.textContent = card.priceLabel || '';
    els.imgA?.classList.remove('is-hidden');
    els.overlayA?.classList.remove('hl-card-overlay--hidden');
    els.mysteryA?.classList.add('is-hidden');
}

function renderCardB(card, hidden = true) {
    if (!card) return;
    els.frameB?.classList.remove('hl-card-frame--idle');
    els.imgB.src = card.image || '';
    els.imgB.alt = hidden ? 'Hidden card' : card.name || 'Card B';
    els.nameB.textContent = card.name || '';
    els.priceB.textContent = card.priceLabel || '';
    els.imgB?.classList.remove('is-hidden');

    els.frameB?.classList.toggle('hl-card-frame--hidden', hidden);
    els.frameB?.classList.toggle('hl-card-frame--revealed', !hidden);
    els.overlayB?.classList.toggle('hl-card-overlay--hidden', hidden);
    els.mystery?.classList.toggle('is-hidden', !hidden);
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
    els.betPanel.classList.toggle('is-hidden', inGame);
    els.playPanel.classList.toggle('is-hidden', !inGame);
    els.continuePanel.classList.toggle('is-hidden', mode !== 'continue');

    const guessDisabled = mode === 'continue' || state.busy;
    els.btnLower.disabled = guessDisabled;
    els.btnHigher.disabled = guessDisabled;
    els.btnCashOut.disabled = state.busy || !state.game?.canCashOut;
    els.btnContinue.disabled = state.busy;
    els.btnStart.disabled = state.busy;
}

function applyGame(game) {
    state.game = game;
    if (!game) {
        showIdleCards();
        setPanels('betting');
        updateStats();
        return;
    }

    renderCardA(game.cardA);
    renderCardB(game.cardB, true);
    setPanels(state.awaitingContinue ? 'continue' : 'playing');
    updateStats();
}

async function resetToIdle(message = 'Set your bet and start playing.') {
    state.game = null;
    state.awaitingContinue = false;
    state.busy = false;
    showIdleCards();
    setPanels('betting');

    try {
        const res = await fetch(`${API}/higher_lower.php?action=getState`, { credentials: 'include' });
        const data = await readApiJson(res, 'Refresh failed');
        if (data.success) {
            state.coins = data.coins;
            state.maxBet = data.maxBet;
            els.betInput.max = String(state.maxBet);
            state.bet = clampBet(state.bet);
            els.betInput.value = String(state.bet);
            if (!data.game) {
                applyGame(null);
            } else {
                state.awaitingContinue = false;
                applyGame(data.game);
            }
        }
    } catch {
        updateStats();
    }

    setStatus(message);
}

function clampBet(value) {
    const n = Math.round(Number(value) || state.minBet);
    return Math.max(state.minBet, Math.min(state.maxBet, n));
}

function syncBetInput() {
    state.bet = clampBet(els.betInput.value);
    els.betInput.value = String(state.bet);
}

async function loadState() {
    const res = await fetch(`${API}/higher_lower.php?action=getState`, { credentials: 'include' });
    const data = await readApiJson(res, 'Load failed');

    if (!data.success) {
        throw new Error(data.message || 'Could not load game');
    }

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
    setStatus('Starting game…');
    setPanels('playing');

    try {
        const res = await fetch(`${API}/higher_lower.php?action=start`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bet: state.bet }),
        });
        const data = await readApiJson(res, 'Start failed');

        if (!data.success) {
            setStatus(data.message || 'Could not start', true);
            setPanels('betting');
            return;
        }

        state.coins = data.coins;
        state.awaitingContinue = false;
        applyGame(data.game);
        setStatus('Higher or lower?');
    } catch (err) {
        setStatus(err.message, true);
        setPanels('betting');
    } finally {
        state.busy = false;
        setPanels(state.game ? 'playing' : 'betting');
    }
}

async function submitGuess(direction) {
    if (state.busy || !state.game || state.awaitingContinue) return;

    state.busy = true;
    els.btnLower.disabled = true;
    els.btnHigher.disabled = true;
    setStatus('Revealing…');

    try {
        const res = await fetch(`${API}/higher_lower.php?action=guess`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ direction }),
        });
        const data = await readApiJson(res, 'Guess failed');

        if (!data.success) {
            setStatus(data.message || 'Guess failed', true);
            return;
        }

        state.coins = data.coins;

        const revealed = {
            ...state.game.cardB,
            ...data.revealedB,
        };
        renderCardB(revealed, false);
        els.frameB.classList.add('hl-card-frame--flip');

        await new Promise((r) => setTimeout(r, 900));

        if (!data.won) {
            state.game = null;
            state.awaitingContinue = false;
            updateStats();
            showResult(false, data.message, 0, data.multiplier);
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
        updateStats();
        setPanels('continue');
        setStatus(data.message || 'Correct! Cash out or continue?');
    } catch (err) {
        setStatus(err.message, true);
    } finally {
        state.busy = false;
        els.frameB.classList.remove('hl-card-frame--flip');
        if (state.game && !state.awaitingContinue) {
            setPanels('playing');
        } else if (state.awaitingContinue) {
            setPanels('continue');
        }
    }
}

function showResult(won, message, payout, multiplier) {
    els.resultBadge.textContent = won ? 'You won!' : 'You lost';
    els.resultBadge.classList.toggle('hl-result-badge--win', won);
    els.resultBadge.classList.toggle('hl-result-badge--loss', !won);
    els.resultTitle.textContent = won ? 'Nice guess!' : 'Better luck next time';
    els.resultMessage.textContent = won
        ? `${message} ${payout > 0 ? `+${formatHeaderCoins(payout)} coins (${formatMultiplier(multiplier)})` : ''}`
        : message;
    els.resultModal.classList.remove('is-hidden');
}

async function hideResult() {
    els.resultModal.classList.add('is-hidden');
    await resetToIdle('Set your bet and start playing.');
}

function openInfoModal() {
    if (!els.infoModal) return;
    els.infoModal.classList.remove('is-hidden');
    els.infoModal.querySelectorAll('.hl-info-step').forEach((step, index) => {
        step.classList.remove('is-visible');
        window.setTimeout(() => step.classList.add('is-visible'), 70 + index * 90);
    });
}

function closeInfoModal() {
    els.infoModal?.classList.add('is-hidden');
    els.infoModal?.querySelectorAll('.hl-info-step').forEach((step) => {
        step.classList.remove('is-visible');
    });
}

async function cashOut() {
    if (state.busy || !state.game) return;

    state.busy = true;
    setStatus('Cashing out…');

    try {
        const res = await fetch(`${API}/higher_lower.php?action=cashout`, {
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
    }
}

function continueRound() {
    if (!state.game) return;
    state.awaitingContinue = false;
    renderCardA(state.game.cardA);
    renderCardB(state.game.cardB, true);
    setPanels('playing');
    setStatus('Higher or lower?');
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
    els.btnLower?.addEventListener('click', () => submitGuess('lower'));
    els.btnHigher?.addEventListener('click', () => submitGuess('higher'));
    els.btnCashOut?.addEventListener('click', cashOut);
    els.btnContinue?.addEventListener('click', continueRound);

    els.btnCloseResult?.addEventListener('click', hideResult);
    els.resultModal?.querySelector('.hl-modal-backdrop')?.addEventListener('click', hideResult);

    els.btnHlInfo?.addEventListener('click', openInfoModal);
    els.btnHlInfoClose?.addEventListener('click', closeInfoModal);
    els.btnHlInfoGotIt?.addEventListener('click', closeInfoModal);
    els.infoModal?.querySelector('.hl-info-backdrop')?.addEventListener('click', closeInfoModal);

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
        setStatus('Set your bet and start playing.');
    } catch (err) {
        setStatus(err.message, true);
    }
}

init();
