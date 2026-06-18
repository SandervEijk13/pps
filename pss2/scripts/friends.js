import { openTradeWithUser } from '/scripts/trade.js';

const API = window.location.port === '5173'
    ? 'http://localhost/pss/api'
    : `${window.location.origin}/pss/api`;

const incomingList = document.getElementById('incomingList');
const outgoingList = document.getElementById('outgoingList');
const friendsList = document.getElementById('friendsList');
const inviteBtn = document.getElementById('friendInviteBtn');
const usernameInput = document.getElementById('friendUsername');
const inviteMsg = document.getElementById('friendInviteMsg');

const PRESENCE_ORDER = { online: 0, recent: 1, away: 2, offline: 3 };

function isLoggedIn() {
    return sessionStorage.getItem('isLogged') === 'true';
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function showMsg(text, type = 'success') {
    if (!inviteMsg) return;
    inviteMsg.hidden = false;
    inviteMsg.textContent = text;
    inviteMsg.className = `friends-msg is-${type}`;
}

function renderPresenceMeta(username, presence) {
    const status = presence?.status || 'offline';
    const label = presence?.label || 'Offline';
    return `
        <div class="friends-user-meta">
            <span class="presence-dot presence-dot--${escapeHtml(status)}" aria-hidden="true"></span>
            <div>
                <strong class="friends-username">${escapeHtml(username)}</strong>
                <span class="friends-presence-label">${escapeHtml(label)}</span>
            </div>
        </div>
    `;
}

function sortFriendsByPresence(friends) {
    return [...friends].sort((a, b) => {
        const aOrder = PRESENCE_ORDER[a.presence?.status] ?? 9;
        const bOrder = PRESENCE_ORDER[b.presence?.status] ?? 9;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return String(a.username).localeCompare(String(b.username));
    });
}

async function apiGet(action) {
    const res = await fetch(`${API}/friends.php?action=${action}`, { credentials: 'include' });
    return res.json();
}

async function apiPost(action, body = {}) {
    const res = await fetch(`${API}/friends.php?action=${action}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return res.json();
}

function renderEmpty(listEl, text) {
    listEl.innerHTML = `<li class="friends-empty">${escapeHtml(text)}</li>`;
}

async function loadIncoming() {
    const data = await apiGet('incoming');
    if (!data.success || !data.requests?.length) {
        renderEmpty(incomingList, 'No open invites');
        return;
    }

    incomingList.innerHTML = data.requests.map((req) => `
        <li class="friends-list-item">
            <div>
                <strong>${escapeHtml(req.username)}</strong>
            </div>
            <div class="friends-list-actions">
                <button type="button" class="friends-btn friends-btn-primary" data-accept="${req.userId}">Accept</button>
                <button type="button" class="friends-btn friends-btn-danger" data-decline="${req.userId}">Decline</button>
            </div>
        </li>
    `).join('');

    incomingList.querySelectorAll('[data-accept]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const userId = Number(btn.dataset.accept);
            const res = await apiPost('accept', { userId });
            if (!res.success) {
                showMsg(res.message || 'Could not accept', 'error');
                return;
            }
            await refreshAll();
        });
    });

    incomingList.querySelectorAll('[data-decline]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const userId = Number(btn.dataset.decline);
            await apiPost('decline', { userId });
            await refreshAll();
        });
    });
}

async function loadOutgoing() {
    const data = await apiGet('outgoing');
    if (!data.success || !data.requests?.length) {
        renderEmpty(outgoingList, 'No pending invites');
        return;
    }

    outgoingList.innerHTML = data.requests.map((req) => `
        <li class="friends-list-item">
            <div>
                <strong>${escapeHtml(req.username)}</strong>
                <span>Waiting for response</span>
            </div>
        </li>
    `).join('');
}

async function loadFriends() {
    const data = await apiGet('list');
    if (!data.success || !data.friends?.length) {
        renderEmpty(friendsList, 'No friends yet — invite someone!');
        return;
    }

    const friends = sortFriendsByPresence(data.friends);

    friendsList.innerHTML = friends.map((friend) => `
        <li class="friends-list-item friends-list-item--profile" data-profile="${friend.id}">
            ${renderPresenceMeta(friend.username, friend.presence)}
            <div class="friends-list-actions">
                <button type="button" class="friends-btn friends-btn-trade" data-trade="${friend.id}" data-name="${escapeHtml(friend.username)}">
                    <i class="fas fa-right-left"></i> Trade
                </button>
                <button type="button" class="friends-btn friends-btn-muted" data-remove="${friend.id}">Remove</button>
            </div>
        </li>
    `).join('');

    friendsList.querySelectorAll('[data-trade]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const userId = Number(btn.dataset.trade);
            const username = btn.dataset.name || '';
            await openTradeWithUser(userId, username);
        });
    });

    friendsList.querySelectorAll('[data-remove]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const userId = Number(btn.dataset.remove);
            if (!confirm('Vriend verwijderen?')) return;
            await apiPost('remove', { userId });
            await refreshAll();
        });
    });

    friendsList.querySelectorAll('[data-profile]').forEach((row) => {
        row.addEventListener('click', (event) => {
            if (event.target.closest('button, a, [data-trade], [data-remove]')) return;
            const profileId = Number(row.dataset.profile);
            if (!profileId) return;
            window.location.href = `/pages/profile.html?id=${encodeURIComponent(profileId)}`;
        });
    });
}

async function refreshAll() {
    await Promise.all([loadIncoming(), loadOutgoing(), loadFriends()]);
}

inviteBtn?.addEventListener('click', async () => {
    const username = usernameInput?.value?.trim();
    if (!username) {
        showMsg('Enter a username', 'error');
        return;
    }

    const res = await apiPost('send', { username });
    if (!res.success) {
        showMsg(res.message || 'Invite failed', 'error');
        return;
    }

    usernameInput.value = '';
    showMsg(res.message || 'Invite sent', 'success');
    await refreshAll();
});

async function init() {
    if (!isLoggedIn()) {
        window.location.href = '/pages/login.html';
        return;
    }
    await refreshAll();
    setInterval(refreshAll, 60000);
}

init();
