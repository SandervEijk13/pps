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
    type: 'coins',
    types: [],
};

const els = {
    tabs: document.getElementById('leaderboardTabs'),
    list: document.getElementById('leaderboardList'),
    loader: document.getElementById('leaderboardLoader'),
    error: document.getElementById('leaderboardError'),
    empty: document.getElementById('leaderboardEmpty'),
    myRankCard: document.getElementById('myRankCard'),
    myRankValue: document.getElementById('myRankValue'),
    myRankStat: document.getElementById('myRankStat'),
};

function isLoggedIn() {
    return sessionStorage.getItem('isLogged') === 'true' && sessionStorage.getItem('userId');
}

function currentUserId() {
    return parseInt(sessionStorage.getItem('userId') || '0', 10) || 0;
}

function formatValue(type, value) {
    if (type === 'coins' || type === 'inventory' || type === 'biggest_win' || type === 'wagered') {
        return formatHeaderCoins(value);
    }
    if (type === 'level') {
        return `Level ${Math.floor(Number(value) || 1)}`;
    }
    return String(value);
}

function renderTabs(types, activeType) {
    if (!els.tabs) return;
    els.tabs.innerHTML = types.map((t) => `
        <button
            type="button"
            class="leaderboard-tab${t.id === activeType ? ' is-active' : ''}"
            data-type="${t.id}"
            role="tab"
            aria-selected="${t.id === activeType}"
        >
            <i class="fas ${t.icon}"></i>
            <span>${t.label}</span>
        </button>
    `).join('');

    els.tabs.querySelectorAll('.leaderboard-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            if (type && type !== state.type) {
                state.type = type;
                loadLeaderboard();
            }
        });
    });
}

function renderList(entries, type) {
    if (!els.list) return;
    const myId = currentUserId();

    els.list.innerHTML = entries.map((entry, index) => {
        const topClass = entry.rank === 1 ? ' is-top1' : entry.rank === 2 ? ' is-top2' : entry.rank === 3 ? ' is-top3' : '';
        const meClass = myId && entry.userId === myId ? ' is-me' : '';
        return `
            <li
                class="leaderboard-row${topClass}${meClass}"
                style="animation-delay: ${index * 35}ms"
            >
                <span class="leaderboard-rank">#${entry.rank}</span>
                <span class="leaderboard-name">${escapeHtml(entry.username)}</span>
                <span class="leaderboard-value">${formatValue(type, entry.value)}</span>
            </li>
        `;
    }).join('');
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function setLoading(loading) {
    els.loader?.classList.toggle('is-hidden', !loading);
}

function showError(msg) {
    if (!els.error) return;
    els.error.textContent = msg;
    els.error.classList.toggle('is-hidden', !msg);
}

function updateMyRank(myRank, type) {
    if (!els.myRankCard || !isLoggedIn() || !myRank) {
        els.myRankCard?.classList.add('is-hidden');
        return;
    }

    els.myRankCard.classList.remove('is-hidden');
    if (els.myRankValue) els.myRankValue.textContent = `#${myRank.rank}`;
    if (els.myRankStat) els.myRankStat.textContent = formatValue(type, myRank.value);
}

async function loadLeaderboard() {
    setLoading(true);
    showError('');
    els.list.innerHTML = '';
    els.empty?.classList.add('is-hidden');

    try {
        const res = await fetch(
            `${API}/leaderboard.php?action=get&type=${encodeURIComponent(state.type)}`,
            { credentials: 'include' }
        );
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Could not load leaderboard');

        state.types = data.types || state.types;
        renderTabs(state.types, state.type);
        updateMyRank(data.myRank, state.type);

        const entries = data.entries || [];
        if (!entries.length) {
            els.empty?.classList.remove('is-hidden');
        } else {
            renderList(entries, state.type);
        }
    } catch (e) {
        console.error(e);
        showError(e.message || 'Could not load leaderboard');
    } finally {
        setLoading(false);
        els.tabs?.querySelectorAll('.leaderboard-tab').forEach((btn) => {
            btn.classList.toggle('is-active', btn.dataset.type === state.type);
            btn.setAttribute('aria-selected', btn.dataset.type === state.type ? 'true' : 'false');
        });
    }
}

const params = new URLSearchParams(window.location.search);
const initialType = params.get('type');
if (initialType) {
    state.type = initialType;
}

loadLeaderboard();
