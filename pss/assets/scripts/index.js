// ==================== HEADER INTERACTIONS ====================
(function headerSetup() {
    const coinContainer = document.querySelector('.coin-badge');
    const coinAmount = document.querySelector('.coin-amount');
    if (coinContainer && coinAmount) {
        coinContainer.addEventListener('mouseenter', () => {
            coinAmount.style.textShadow = '0 0 6px #ffbc3c';
        });
        coinContainer.addEventListener('mouseleave', () => {
            coinAmount.style.textShadow = 'none';
        });
    }
})();

// ==================== CAROUSEL LOGIC ====================
(function carouselSetup() {
    const TOTAL_SLIDES = 6;
    const packData = [
        { name: 'Sun and moon Rising Shadow', image: '../assets/images/packs/pankie1.png', price: '1200' },
        { name: 'White Flare', image: '../assets/images/packs/pankie2.png', price: '300' },
        { name: 'Base Set 1', image: '../assets/images/packs/pankie3.png', price: '2000' },
        { name: 'Evolving skies', image: '../assets/images/packs/pankie4.png', price: '3000' },
        { name: 'XY Breakpoint', image: '../assets/images/packs/pankie5.png', price: '650' },
        { name: 'Darkness Ablaze', image: '../assets/images/packs/pankie6.png', price: '700 ' }
    ];

    const track = document.getElementById('carouselTrack');
    const wrapper = document.getElementById('carouselWrapper');
    const template = document.getElementById('carousel-slide-template');

    let visibleCount = 3;
    let currentIndex = 0;
    let autoInterval = null;
    let isTransitioning = false;

    function updateVisibleCount() {
        const w = wrapper.clientWidth;
        if (w <= 440) visibleCount = 1;
        else if (w <= 680) visibleCount = 2;
        else visibleCount = 3;
    }

    function createSlide(index) {
        const clone = document.importNode(template.content, true);
        const slide = clone.querySelector('.carousel-slide');
        const img = slide.querySelector('.pack-image');
        const name = slide.querySelector('.pack-name');
        const priceValue = slide.querySelector('.pack-price-value');
        const data = packData[index];
        img.src = data.image;
        img.alt = data.name + ' pack';
        name.textContent = data.name;
        priceValue.textContent = data.price;
        slide.addEventListener('click', () => {
            alert(`Clicked on ${data.name} pack (index ${index + 1})`);
        });
        return slide;
    }

    function buildSlides() {
        track.innerHTML = '';
        for (let i = 0; i < TOTAL_SLIDES; i++) {
            track.appendChild(createSlide(i));
        }
        for (let i = 0; i < visibleCount; i++) {
            const clone = createSlide(i);
            clone.classList.add('clone');
            track.appendChild(clone);
        }
    }

    function updateSlideWidths() {
        const slides = track.querySelectorAll('.carousel-slide');
        const widthPercent = 100 / visibleCount;
        slides.forEach(slide => {
            slide.style.width = `calc(${widthPercent}% )`;
        });
    }

    function goToSlide(index, instant = false) {
        if (index < 0 || index >= TOTAL_SLIDES) return;
        if (isTransitioning && !instant) return;
        currentIndex = index;
        const translateX = -index * (100 / visibleCount);
        if (instant) {
            track.style.transition = 'none';
        } else {
            track.style.transition = 'transform 0.55s cubic-bezier(0.4, 0.0, 0.2, 1)';
            isTransitioning = true;
        }
        track.style.transform = `translateX(${translateX}%)`;
        if (!instant) {
            setTimeout(() => { isTransitioning = false; }, 560);
        }
    }

    function advanceSlide() {
        if (isTransitioning) return;
        const nextIndex = currentIndex + 1;
        if (nextIndex >= TOTAL_SLIDES) {
            const slidePercent = 100 / visibleCount;
            track.style.transition = 'transform 0.55s cubic-bezier(0.4, 0.0, 0.2, 1)';
            track.style.transform = `translateX(${-nextIndex * slidePercent}%)`;
            isTransitioning = true;
            setTimeout(() => {
                track.style.transition = 'none';
                track.style.transform = 'translateX(0%)';
                currentIndex = 0;
                isTransitioning = false;
                track.offsetHeight;
                track.style.transition = 'transform 0.55s cubic-bezier(0.4, 0.0, 0.2, 1)';
            }, 560);
        } else {
            goToSlide(nextIndex);
        }
    }

    function resetAutoScroll() {
        clearInterval(autoInterval);
        autoInterval = setInterval(advanceSlide, 3200);
    }

    function initCarousel() {
        updateVisibleCount();
        buildSlides();
        updateSlideWidths();
        goToSlide(0, true);
        resetAutoScroll();
    }

    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const oldVisibleCount = visibleCount;
            updateVisibleCount();
            if (visibleCount !== oldVisibleCount) {
                buildSlides();
                updateSlideWidths();
                currentIndex = Math.min(currentIndex, TOTAL_SLIDES - 1);
                goToSlide(currentIndex, true);
            }
            resetAutoScroll();
        }, 300);
    });
    let resizeTimeout;

    wrapper.addEventListener('mouseenter', () => clearInterval(autoInterval));
    wrapper.addEventListener('mouseleave', resetAutoScroll);

    let touchStartX = 0;
    wrapper.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        clearInterval(autoInterval);
    }, { passive: true });

    wrapper.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;
        if (Math.abs(diff) > 40) {
            if (diff > 0) advanceSlide();
            else if (currentIndex > 0 && !isTransitioning) goToSlide(currentIndex - 1);
            else if (currentIndex === 0 && !isTransitioning) {
                const slidePercent = 100 / visibleCount;
                track.style.transition = 'none';
                track.style.transform = `translateX(${-TOTAL_SLIDES * slidePercent}%)`;
                currentIndex = TOTAL_SLIDES - 1;
                track.offsetHeight;
                track.style.transition = 'transform 0.55s cubic-bezier(0.4, 0.0, 0.2, 1)';
                goToSlide(TOTAL_SLIDES - 1);
            }
        }
        resetAutoScroll();
    }, { passive: true });

    initCarousel();
})();

// ==================== PROMO ROW: PERSISTENT FREE PACK COOLDOWN ====================
(function promoRowSetup() {
    const STORAGE_KEY = 'freePackCooldownEnd';
    const COUNTDOWN_SECONDS = 900; // 15 minutes

    const marketBtn = document.getElementById('marketBigBtn');
    const freePackBox = document.getElementById('freePackBox');
    const timerNumber = document.getElementById('freePackTimerNumber');
    const subText = document.getElementById('freePackSubText');

    let countdownInterval = null;
    let isCounting = false;

    function getStoredEndTime() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return null;
        const endTime = parseInt(stored, 10);
        return isNaN(endTime) ? null : endTime;
    }

    function clearStoredCooldown() {
        localStorage.removeItem(STORAGE_KEY);
    }

    function startCooldown(overrideEndTime = null) {
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        let endTime;
        if (overrideEndTime) {
            endTime = overrideEndTime;
        } else {
            endTime = Date.now() + COUNTDOWN_SECONDS * 1000;
            localStorage.setItem(STORAGE_KEY, endTime);
        }
        isCounting = true;
        freePackBox.classList.add('counting');
        subText.textContent = 'Cooldown…';
        updateTimerDisplay(endTime);
        countdownInterval = setInterval(() => {
            const remaining = updateTimerDisplay(endTime);
            if (remaining <= 0) {
                clearInterval(countdownInterval);
                countdownInterval = null;
                finishCooldown();
            }
        }, 1000);
    }

    function updateTimerDisplay(endTime) {
        const now = Date.now();
        const diff = endTime - now;
        const remaining = diff > 0 ? Math.ceil(diff / 1000) : 0;
        timerNumber.textContent = remaining;
        return remaining;
    }

    function finishCooldown() {
        freePackBox.classList.remove('counting');
        isCounting = false;
        subText.textContent = 'Click to claim!';
        timerNumber.textContent = COUNTDOWN_SECONDS;
        clearStoredCooldown();
    }

    function claimFreePack() {
        if (isCounting) return;
        alert('🎁 You received a free pack!');
        startCooldown();
    }

    function initCooldownState() {
        const endTime = getStoredEndTime();
        if (!endTime) return;
        const now = Date.now();
        if (endTime <= now) {
            clearStoredCooldown();
            return;
        }
        startCooldown(endTime);
    }

    if (marketBtn) {
        marketBtn.addEventListener('click', (e) => {
            // placeholder for real link later
        });
    }

    if (freePackBox) {
        freePackBox.addEventListener('click', claimFreePack);
        freePackBox.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                claimFreePack();
            }
        });
    }

    initCooldownState();
})();