const COINS_KEY = 'pokemon-coins';

export function getCoins() {
    return Number(localStorage.getItem(COINS_KEY)) || 5000;
}

export function setCoins(amount) {
    localStorage.setItem(COINS_KEY, amount);
}
