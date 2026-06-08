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
    segments: [],
    rotation: 0,
    spinning: false,
    spinCostCoins: 50,
    spinCostTickets: 1,
    coins: 0,
    tickets: 0,
};

const els = {
    canvas: document.getElementById('wheelCanvas'),
    stage: document.querySelector('.wheel-stage'),
    loginGate: document.getElementById('wheelLoginGate'),
    main: document.getElementById('wheelMain'),
    coinAmount: document.getElementById('coin-amount'),
    ticketAmount: document.getElementById('ticket-amount'),
    coinCostLabel: document.getElementById('coinCostLabel'),
    wheelStatus: document.getElementById('wheelStatus'),
    btnSpinCoins: document.getElementById('btnSpinCoins'),
    btnSpinTicket: document.getElementById('btnSpinTicket'),
    rewardModal: document.getElementById('rewardModal'),
    rewardModalCard: document.querySelector('.reward-modal-card'),
    rewardModalBadge: document.getElementById('rewardModalBadge'),
    rewardModalVisual: document.getElementById('rewardModalVisual'),
    rewardModalTitle: document.getElementById('rewardModalTitle'),
    rewardModalMessage: document.getElementById('rewardModalMessage'),
    btnCloseReward: document.getElementById('btnCloseReward'),
    prizeList: document.getElementById('wheelPrizeList'),
};

const ctx = els.canvas?.getContext('2d');

function isLoggedIn() {
    return localStorage.getItem('isLogged') === 'true' && localStorage.getItem('userId');
}

function setStatus(msg, isError = false) {
    if (!els.wheelStatus) return;
    els.wheelStatus.textContent = msg;
    els.wheelStatus.classList.toggle('is-error', isError);
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
    if (!ctx || !els.canvas || !state.segments.length) return;

    const dpr = window.devicePixelRatio || 1;
    const size = els.canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 8;
    const n = state.segments.length;
    const slice = (Math.PI * 2) / n;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((rotationDeg * Math.PI) / 180);

    for (let i = 0; i < n; i++) {
        const seg = state.segments[i];
        const start = i * slice - Math.PI / 2;
        const end = start + slice;

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, start, end);
        ctx.closePath();
        ctx.fillStyle = seg.color || '#475569';
        ctx.fill();
        ctx.strokeStyle = 'rgba(2, 6, 23, 0.55)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.save();
        ctx.rotate(start + slice / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(248, 250, 252, 0.95)';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 2;

        const priceLine = seg.short || (seg.priceValue != null ? String(seg.priceValue) : '');
        const nameLine = seg.label || '';
        const compact = n > 24;
        const mainSize = compact ? 9 : 12;
        const subSize = compact ? 7 : 10;
        const pad = compact ? 10 : 16;
        const maxName = compact ? 8 : 16;

        ctx.font = `bold ${mainSize}px system-ui, sans-serif`;
        ctx.fillText(priceLine, radius - pad, !compact && nameLine && nameLine !== priceLine ? -5 : 2);

        if (!compact && nameLine && nameLine !== priceLine && seg.prizeKind !== 'coins' && seg.prizeKind !== 'nothing') {
            ctx.font = `${subSize}px system-ui, sans-serif`;
            const truncated = nameLine.length > maxName ? `${nameLine.slice(0, maxName - 1)}…` : nameLine;
            ctx.fillText(truncated, radius - pad, 9);
        } else if (!compact && seg.prizeKind === 'coins') {
            ctx.font = `${subSize}px system-ui, sans-serif`;
            ctx.fillText('coins', radius - pad, 9);
        }

        ctx.restore();
    }

    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 3;
    ctx.stroke();
}

function targetRotationForIndex(index) {
    const n = state.segments.length;
    const anglePer = 360 / n;
    const extra = 360 * (5 + Math.floor(Math.random() * 3));
    return extra + (360 - index * anglePer - anglePer / 2);
}

function easeOutCubic(t) {
    return 1 - (1 - t) ** 3;
}

function animateWheelTo(targetDeg) {
    return new Promise((resolve) => {
        const start = state.rotation;
        const delta = targetDeg - start;
        const duration = 4200;
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

function playWinSound() {
    try {
        const ctxAudio = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctxAudio.createOscillator();
        const gain = ctxAudio.createGain();
        osc.connect(gain);
        gain.connect(ctxAudio.destination);
        osc.frequency.setValueAtTime(440, ctxAudio.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctxAudio.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, ctxAudio.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctxAudio.currentTime + 0.4);
        osc.start();
        osc.stop(ctxAudio.currentTime + 0.4);
    } catch {
        // optional
    }
}

function fireConfetti() {
    if (typeof confetti !== 'function') return;
    confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
    setTimeout(() => confetti({ particleCount: 80, spread: 100, origin: { y: 0.5 } }), 200);
}

function showRewardModal(reward, bigWin) {
    if (!els.rewardModal) return;

    els.rewardModalCard?.classList.toggle('is-jackpot', reward.type === 'card_premium' || reward.type === 'jackpot');
    els.rewardModalBadge.textContent = reward.type === 'card_premium'
        ? 'MEGA WIN!'
        : reward.type === 'jackpot'
            ? 'JACKPOT!'
            : bigWin
                ? 'Big win!'
                : 'You won!';
    els.rewardModalTitle.textContent = reward.type === 'nothing' ? 'No prize' : 'Congratulations!';
    els.rewardModalMessage.textContent = reward.message || '';

    if (els.rewardModalVisual) {
        els.rewardModalVisual.innerHTML = '';
        if (reward.type === 'card' || reward.type === 'card_premium' || reward.type === 'jackpot') {
            const card = reward.card;
            if (card?.image) {
                const img = document.createElement('img');
                img.src = card.image;
                img.alt = card.name || 'Card';
                els.rewardModalVisual.appendChild(img);
            }
        } else if (reward.type === 'coins' || reward.type === 'jackpot') {
            const icon = document.createElement('div');
            icon.className = 'reward-coins';
            icon.innerHTML = '<i class="fas fa-coins"></i>';
            els.rewardModalVisual.appendChild(icon);
        } else if (reward.type === 'pack') {
            const packImg = reward.pack?.image;
            if (packImg) {
                const img = document.createElement('img');
                img.src = packImg;
                img.alt = reward.pack?.name || 'Pack';
                els.rewardModalVisual.appendChild(img);
            } else {
                els.rewardModalVisual.innerHTML = '<i class="fas fa-box-open" style="font-size:4rem;color:#a1a1aa"></i>';
            }
        } else if (reward.type === 'tickets') {
            els.rewardModalVisual.innerHTML = '<i class="fas fa-ticket" style="font-size:4rem;color:#a1a1aa"></i>';
        }
    }

    els.rewardModal.classList.remove('is-hidden');
}

function renderPrizeList() {
    if (!els.prizeList) return;
    els.prizeList.innerHTML = '';

    state.segments.forEach((seg) => {
        const item = document.createElement('div');
        item.className = 'wheel-prize-item';
        if (seg.bigWin) item.classList.add('is-big');

        let thumb = '';
        if (seg.image) {
            thumb = `<img class="wheel-prize-thumb" src="${seg.image}" alt="" />`;
        } else if (seg.prizeKind === 'coins') {
            thumb = '<span class="wheel-prize-icon"><i class="fas fa-coins"></i></span>';
        } else if (seg.prizeKind === 'ticket') {
            thumb = '<span class="wheel-prize-icon"><i class="fas fa-ticket"></i></span>';
        } else if (seg.prizeKind === 'nothing') {
            thumb = '<span class="wheel-prize-icon">—</span>';
        }

        const title = seg.prizeKind === 'coins'
            ? `${seg.short} coins`
            : seg.label;
        const sub = seg.prizeKind === 'card' || seg.prizeKind === 'mega'
            ? `${seg.short} coins value`
            : seg.prizeKind === 'pack'
                ? `${seg.short} coins`
                : '';

        item.innerHTML = `
            ${thumb}
            <div class="wheel-prize-text">
                <strong>${title}</strong>
                ${sub ? `<span>${sub}</span>` : ''}
            </div>
        `;
        els.prizeList.appendChild(item);
    });
}

function updateUiFromState(data) {
    if (data.spinCostCoins != null) state.spinCostCoins = data.spinCostCoins;
    if (data.spinCostTickets != null) state.spinCostTickets = data.spinCostTickets;
    if (data.coins != null) state.coins = data.coins;
    if (data.tickets != null) state.tickets = data.tickets;

    if (els.coinAmount) els.coinAmount.textContent = formatHeaderCoins(state.coins);
    if (els.ticketAmount) els.ticketAmount.textContent = String(state.tickets);
    if (els.coinCostLabel) els.coinCostLabel.textContent = String(state.spinCostCoins);

    const canSpin = !state.spinning;

    if (els.btnSpinCoins) {
        els.btnSpinCoins.disabled = !canSpin || state.coins < state.spinCostCoins;
    }
    if (els.btnSpinTicket) {
        els.btnSpinTicket.disabled = !canSpin || state.tickets < state.spinCostTickets;
    }
}

async function loadWheelState() {
    const res = await fetch(`${API}/wheel.php?action=getState`, { credentials: 'include' });
    const data = await readApiJson(res, 'Could not load wheel');
    if (!data.success) throw new Error(data.message || 'Could not load wheel');

    state.segments = data.segments || [];
    drawWheel(state.rotation);
    renderPrizeList();
    updateUiFromState(data);
    return data;
}

async function doSpin(payment) {
    if (!isLoggedIn()) {
        setStatus('Log in to spin.', true);
        return;
    }
    if (state.spinning) return;

    state.spinning = true;
    els.stage?.classList.add('is-spinning');
    setStatus('Spinning…');
    [els.btnSpinCoins, els.btnSpinTicket].forEach((b) => {
        if (b) b.disabled = true;
    });

    try {
        const res = await fetch(`${API}/wheel.php?action=spin`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payment }),
        });
        const data = await readApiJson(res, 'Spin failed');
        if (!data.success) throw new Error(data.message || 'Spin failed');

        const index = data.segmentIndex ?? 0;
        await animateWheelTo(targetRotationForIndex(index));

        updateUiFromState(data);

        if (data.bigWin) {
            playWinSound();
            fireConfetti();
        }

        showRewardModal(data.reward || {}, data.bigWin);
        setStatus(data.reward?.message || 'Done!');
    } catch (e) {
        console.error(e);
        setStatus(e.message, true);
        await loadWheelState();
    } finally {
        state.spinning = false;
        els.stage?.classList.remove('is-spinning');
        updateUiFromState({});
    }
}

function bindEvents() {
    els.btnSpinCoins?.addEventListener('click', () => doSpin('coins'));
    els.btnSpinTicket?.addEventListener('click', () => doSpin('ticket'));
    els.btnCloseReward?.addEventListener('click', () => els.rewardModal?.classList.add('is-hidden'));
    document.querySelector('.reward-modal-backdrop')?.addEventListener('click', () => {
        els.rewardModal?.classList.add('is-hidden');
    });

    window.addEventListener('resize', () => drawWheel(state.rotation));
}

async function init() {
    bindEvents();

    if (!isLoggedIn()) {
        els.loginGate?.classList.remove('is-hidden');
        els.main?.classList.add('is-hidden');
        setStatus('');
        return;
    }

    els.loginGate?.classList.add('is-hidden');
    els.main?.classList.remove('is-hidden');

    try {
        await loadWheelState();
        setStatus('Good luck!');
    } catch (e) {
        console.error(e);
        setStatus(e.message, true);
    }
}

init();
