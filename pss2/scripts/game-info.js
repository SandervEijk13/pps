/**
 * Shared “how it works” info modal — use on game pages with matching HTML ids.
 */
export function initGameInfo({
    modalId = 'infoModal',
    btnId = 'btnGameInfo',
    closeId = 'btnCloseInfo',
    gotItId = 'btnInfoGotIt',
} = {}) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    const open = () => {
        modal.classList.remove('is-hidden');
        modal.querySelectorAll('.game-info-step').forEach((step, index) => {
            step.classList.remove('is-visible');
            window.setTimeout(() => step.classList.add('is-visible'), 70 + index * 90);
        });
    };

    const close = () => {
        modal.classList.add('is-hidden');
        modal.querySelectorAll('.game-info-step').forEach((step) => {
            step.classList.remove('is-visible');
        });
    };

    document.getElementById(btnId)?.addEventListener('click', open);
    document.getElementById(closeId)?.addEventListener('click', close);
    document.getElementById(gotItId)?.addEventListener('click', close);
    modal.querySelector('.game-info-backdrop')?.addEventListener('click', close);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('is-hidden')) {
            close();
        }
    });
}
