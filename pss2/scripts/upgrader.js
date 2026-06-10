import { formatHeaderCoins, resolveTcgdexImageUrl } from '/scripts/card_logic.js';
import { initGameInfo } from '/scripts/game-info.js';

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

const state = {
    bet: 50,
    coins: 0,
    minBet: 10,
    maxBet: 500,
    targets: [],
    selectedId: null,
    segments: [],
    rotation: 0,
    spinning: false,
};

const els = {
    loginGate: document.getElementById('upgraderLoginGate'),
    main: document.getElementById('upgraderMain'),
    canvas: document.getElementById('upgraderCanvas'),
    stage: document.querySelector('.upgrader-stage'),
    betInput: document.getElementById('betInput'),
    betSlider: document.getElementById('betSlider'),
    balanceLabel: document.getElementById('balanceLabel'),
    chanceLabel: document.getElementById('chanceLabel'),
    targetGrid: document.getElementById('targetGrid'),
    btnUpgrade: document.getElementById('btnUpgrade'),
    status: document.getElementById('upgraderStatus'),
    selectedPreview: document.getElementById('selectedTargetPreview'),
    selectedImg: document.getElementById('selectedTargetImg'),
    selectedName: document.getElementById('selectedTargetName'),
    selectedMeta: document.getElementById('selectedTargetMeta'),
    resultModal: document.getElementById('resultModal'),
    resultModalCard: document.getElementById('resultModalCard'),
    resultModalBadge: document.getElementById('resultModalBadge'),
    resultModalVisual: document.getElementById('resultModalVisual'),
    resultModalTitle: document.getElementById('resultModalTitle'),
    resultModalMessage: document.getElementById('resultModalMessage'),
    resultModalCollectionLink: document.getElementById('resultModalCollectionLink'),
    btnCloseResult: document.getElementById('btnCloseResult'),
};

const ctx = els.canvas?.getContext('2d');

function isLoggedIn() {
    return localStorage.getItem('isLogged') === 'true' && localStorage.getItem('userId');
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

function drawWheel(rotationDeg) {
    if (!ctx || !els.canvas || state.segments.length < 2) {
        if (ctx && els.canvas) {
            ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
        }
        return;
    }

    const size = els.canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 8;
    const totalWeight = state.segments.reduce((s, seg) => s + (seg.weight || 1), 0);
    let angle = -Math.PI / 2;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((rotationDeg * Math.PI) / 180);

    state.segments.forEach((seg) => {
        const slice = ((seg.weight || 1) / totalWeight) * Math.PI * 2;
        const end = angle + slice;
        const mid = angle + slice / 2;
        const base = seg.color || '#334155';
        const isWin = seg.type === 'win' || seg.label === 'WIN';

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, angle, end);
        ctx.closePath();

        const grad = ctx.createRadialGradient(0, 0, radius * 0.15, 0, 0, radius);
        if (isWin) {
            grad.addColorStop(0, '#22c55e');
            grad.addColorStop(0.55, base);
            grad.addColorStop(1, '#052e16');
        } else {
            grad.addColorStop(0, '#ef4444');
            grad.addColorStop(0.55, base);
            grad.addColorStop(1, '#450a0a');
        }
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(2, 6, 23, 0.75)';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.save();
        ctx.rotate(mid);
        ctx.textAlign = 'right';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
        ctx.shadowBlur = 4;
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 24px system-ui, sans-serif';
        ctx.fillText(seg.label || '', radius - 28, -6);
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.fillStyle = isWin ? '#bbf7d0' : '#fecaca';
        ctx.fillText(seg.short || '', radius - 28, 16);
        ctx.restore();

        angle = end;
    });

    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.2)';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius - 6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();
}

/** Same landing math as wheel.js, extended for weighted slices. */
function targetRotationForIndex(index) {
    const totalWeight = state.segments.reduce((s, seg) => s + (seg.weight || 1), 0);
    let startDeg = 0;

    for (let i = 0; i < state.segments.length; i++) {
        const sliceDeg = ((state.segments[i].weight || 1) / totalWeight) * 360;
        if (i === index) {
            const center = startDeg + sliceDeg / 2;
            const jitter = (Math.random() - 0.5) * sliceDeg * 0.06;
            const extra = 360 * (5 + Math.floor(Math.random() * 3));
            return extra + (360 - center + jitter);
        }
        startDeg += sliceDeg;
    }

    return 360 * 5;
}

function easeOutCubic(t) {
    return 1 - (1 - t) ** 3;
}

function animateWheelTo(targetDeg) {
    return new Promise((resolve) => {
        const start = state.rotation;
        const delta = targetDeg - start;
        const duration = 4000;
        const t0 = performance.now();

        function frame(now) {
            const t = Math.min(1, (now - t0) / duration);
            state.rotation = start + delta * easeOutCubic(t);
            drawWheel(state.rotation);
            if (t < 1) {
                requestAnimationFrame(frame);
            } else {
                state.rotation = targetDeg % 360;
                drawWheel(state.rotation);
                resolve();
            }
        }

        requestAnimationFrame(frame);
    });
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function cardMetaLine(card) {
    const parts = [];
    if (card.setName) parts.push(card.setName);
    parts.push(card.priceLabel || `${card.price} coins`);
    if (card.winChanceLabel || card.winChance != null) {
        parts.push(`${card.winChanceLabel || card.winChance + '%'} win`);
    }
    return parts.join(' · ');
}

function updateSelectedPreview(target) {
    if (!target || !els.selectedPreview) {
        els.selectedPreview?.classList.add('is-hidden');
        return;
    }
    els.selectedPreview.classList.remove('is-hidden');
    if (els.selectedImg) {
        els.selectedImg.src = cardImg(target);
        els.selectedImg.alt = target.name || 'Card';
    }
    if (els.selectedName) els.selectedName.textContent = target.name || 'Card';
    if (els.selectedMeta) {
        els.selectedMeta.textContent = cardMetaLine(target);
    }
}

function renderTargets() {
    if (!els.targetGrid) return;
    els.targetGrid.innerHTML = '';

    if (!state.targets.length) {
        els.targetGrid.innerHTML = '<p class="upgrader-target-empty">No targets for this bet. Raise your stake.</p>';
        return;
    }

    state.targets.forEach((card) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'upgrader-target-card';
        if (card.id === state.selectedId) btn.classList.add('is-selected');
        const setLine = card.setName
            ? `<span class="target-set">${escapeHtml(card.setName)}</span>`
            : '';
        btn.innerHTML = `
            <img src="${escapeHtml(cardImg(card))}" alt="" loading="lazy" />
            <div class="target-text">
                <span class="target-name">${escapeHtml(card.name)}</span>
                ${setLine}
                <span class="target-price">${escapeHtml(card.priceLabel || `${card.price} coins`)}</span>
                <span class="target-chance">${escapeHtml(card.winChanceLabel || `${card.winChance}%`)}</span>
            </div>
        `;
        btn.addEventListener('click', () => selectTarget(card.id));
        els.targetGrid.appendChild(btn);
    });
}

function updateControls() {
    const selected = state.targets.find((c) => c.id === state.selectedId);
    const canPlay = !state.spinning
        && selected
        && state.bet >= state.minBet
        && state.bet <= state.coins
        && state.segments.length >= 2;

    if (els.chanceLabel) {
        els.chanceLabel.textContent = selected
            ? (selected.winChanceLabel || `${selected.winChance}%`)
            : '—';
    }

    if (els.btnUpgrade) els.btnUpgrade.disabled = !canPlay;
    updateSelectedPreview(selected);
    drawWheel(state.rotation);
}

async function loadState(keepSelection = true) {
    const params = new URLSearchParams({ bet: String(state.bet) });
    if (keepSelection && state.selectedId) {
        params.set('targetId', state.selectedId);
    }

    const res = await fetch(`${API}/upgrader.php?action=getState&${params}`, { credentials: 'include' });
    const data = await readApiJson(res, 'Could not load upgrader');
    if (!data.success) throw new Error(data.message || 'Could not load upgrader');

    state.coins = data.coins ?? 0;
    state.minBet = data.minBet ?? 10;
    state.maxBet = data.maxBet ?? state.coins;
    state.bet = data.bet ?? state.bet;
    state.targets = data.targets || [];

    if (!keepSelection || !state.targets.some((c) => c.id === state.selectedId)) {
        state.selectedId = null;
        state.segments = [];
    }

    if (data.selectedTarget) {
        state.selectedId = data.selectedTarget.id;
        state.segments = data.segments || [];
    } else if (!state.selectedId) {
        state.segments = [];
    }

    if (els.balanceLabel) els.balanceLabel.textContent = formatHeaderCoins(state.coins);
    if (els.betInput) {
        els.betInput.min = String(state.minBet);
        els.betInput.max = String(Math.max(state.minBet, state.maxBet));
        els.betInput.value = String(state.bet);
    }
    if (els.betSlider) {
        els.betSlider.min = String(state.minBet);
        els.betSlider.max = String(Math.max(state.minBet, state.maxBet));
        els.betSlider.value = String(state.bet);
    }

    const coinHeader = document.getElementById('coin-amount');
    if (coinHeader) coinHeader.textContent = formatHeaderCoins(state.coins);

    renderTargets();
    updateControls();
}

async function selectTarget(cardId) {
    state.selectedId = cardId;
    await loadState(true);
    setStatus('Target selected. Spin when ready.');
}

async function applyBet(bet) {
    const clamped = Math.max(state.minBet, Math.min(state.maxBet, bet));
    state.bet = clamped;
    state.selectedId = null;
    state.segments = [];
    await loadState(false);
}

function showResultModal(won, target, message, reward = null) {
    if (!els.resultModal) return;

    els.resultModalCard?.classList.toggle('is-win', won);
    els.resultModalCard?.classList.toggle('is-loss', !won);
    els.resultModalBadge.textContent = won ? 'In je collectie!' : 'Upgrade mislukt';
    els.resultModalTitle.textContent = won ? 'Upgrade gelukt!' : 'Volgende keer beter';
    els.resultModalMessage.textContent = message || '';

    if (els.resultModalCollectionLink) {
        els.resultModalCollectionLink.classList.toggle('is-hidden', !won);
    }

    if (els.resultModalVisual) {
        els.resultModalVisual.innerHTML = '';
        if (won && target) {
            const img = document.createElement('img');
            img.src = cardImg(target);
            img.alt = target.name || 'Card';
            els.resultModalVisual.appendChild(img);
            const meta = document.createElement('p');
            meta.className = 'result-card-meta';
            const ownedLine = reward?.amount
                ? `Je hebt er nu ${reward.amount}× in je collectie.`
                : 'De kaart staat in je collectie.';
            meta.textContent = [target.name, target.setName, ownedLine]
                .filter(Boolean)
                .join(' · ');
            els.resultModalVisual.appendChild(meta);
        } else {
            els.resultModalVisual.innerHTML = `<i class="fas fa-${won ? 'check-circle' : 'times-circle'}" style="font-size:4rem;color:${won ? '#4ade80' : '#f87171'}"></i>`;
        }
    }

    els.resultModal.classList.remove('is-hidden');
    if (won && typeof confetti === 'function') {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.55 } });
    }
}

async function doUpgrade() {
    if (!state.selectedId || state.spinning) return;

    state.spinning = true;
    els.stage?.classList.add('is-spinning');
    if (els.btnUpgrade) els.btnUpgrade.disabled = true;
    setStatus('Spinning…');

    try {
        const res = await fetch(`${API}/upgrader.php?action=upgrade`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bet: state.bet,
                targetId: state.selectedId,
            }),
        });
        const data = await readApiJson(res, 'Upgrade failed');
        if (!data.success) throw new Error(data.message || 'Upgrade failed');

        if (Array.isArray(data.segments) && data.segments.length >= 2) {
            state.segments = data.segments;
            drawWheel(state.rotation);
        }

        const index = data.segmentIndex ?? (data.won ? 0 : 1);
        await animateWheelTo(targetRotationForIndex(index));

        state.coins = data.coins ?? state.coins;
        if (els.balanceLabel) els.balanceLabel.textContent = formatHeaderCoins(state.coins);
        const coinHeader = document.getElementById('coin-amount');
        if (coinHeader) coinHeader.textContent = formatHeaderCoins(state.coins);

        if (data.won && data.cardGranted === false) {
            throw new Error('Kaart kon niet aan je collectie worden toegevoegd.');
        }

        showResultModal(data.won, data.target, data.message, data.reward);
        setStatus(data.message || 'Done');

        state.selectedId = null;
        state.segments = [];
        await loadState(false);
    } catch (e) {
        console.error(e);
        setStatus(e.message, true);
        await loadState(true);
    } finally {
        state.spinning = false;
        els.stage?.classList.remove('is-spinning');
        updateControls();
    }
}

function bindEvents() {
    initGameInfo();
    let betTimer = null;
    const queueBetReload = () => {
        clearTimeout(betTimer);
        betTimer = setTimeout(() => {
            const val = parseFloat(els.betInput?.value || els.betSlider?.value || state.bet);
            if (Number.isFinite(val)) applyBet(val);
        }, 350);
    };

    els.betInput?.addEventListener('change', () => {
        const val = parseFloat(els.betInput.value);
        if (Number.isFinite(val)) {
            if (els.betSlider) els.betSlider.value = String(val);
            applyBet(val);
        }
    });

    els.betSlider?.addEventListener('input', () => {
        if (els.betInput) els.betInput.value = els.betSlider.value;
        queueBetReload();
    });

    els.btnUpgrade?.addEventListener('click', doUpgrade);
    els.btnCloseResult?.addEventListener('click', () => els.resultModal?.classList.add('is-hidden'));
    els.resultModal?.querySelector('.upgrader-modal-backdrop')?.addEventListener('click', () => {
        els.resultModal?.classList.add('is-hidden');
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !els.resultModal?.classList.contains('is-hidden')) {
            els.resultModal.classList.add('is-hidden');
        }
    });

    window.addEventListener('resize', () => drawWheel(state.rotation));
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
        await loadState(false);
        setStatus('Choose a bet and target card.');
    } catch (e) {
        console.error(e);
        setStatus(e.message, true);
    }
}

init();
