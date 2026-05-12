const pack = document.getElementById("pack");
const peel = document.createElement("div");
peel.id = "peel";
peel.className = "peel";
document.querySelector(".top-flap").appendChild(peel);
document.querySelector('.scene').style.background = 'none';

const packImage = document.getElementById("packImage");
const peelImage = document.getElementById("peelImage");
const bottomPart = document.getElementById("bottomPart");
const cardsContainer = document.getElementById("cardsContainer");

let opened = false;

pack.addEventListener("click", () => {
    if (opened) return;
    opened = true;

    // Start scheur omhoog meteen
    peelImage.classList.add("peel-image-animate");

    // Start de onderkant NADAT de top weg is (na ~1800ms, de top animatie duurt 2s)
    setTimeout(() => {
        packImage.classList.add("zakkenEnVerdwijnOnder");
        bottomPart.classList.add("zakkenEnVerdwijn");
    }, 1800);

    // Scheur omhoog
    peel.classList.add("zakkenEnVerdwijn");

    // Wacht totdat de animaties klaar zijn voordat je elementen verwijdert
    setTimeout(() => {
        peelImage.style.opacity = 0;
        peelImage.style.pointerEvents = "none";

        setTimeout(() => {
            peel.remove();
            peelImage.remove();
            document.getElementById("pack").remove();
        }, 2000);
    }, 2000);

    // Toon de kaarten METEEN als pack geklikt wordt (fade in over 0.8s)
    cardsContainer.classList.add("show");
});

// Voeg click handlers toe voor elke kaart (flip in volgorde)
const cards = document.querySelectorAll(".pokemon-card");
const frontImageUrl = 'Pictures/energypurp.jpg';

// Stel dezelfde afbeelding in voor de voorkant van alle kaarten
cards.forEach((card) => {
    const front = card.querySelector('.pokemon-card-front');
    front.style.backgroundImage = `url('${frontImageUrl}')`;
});

// ===============================
// CARD SYSTEM
// ===============================
// ===============================
// CARD SYSTEM
// ===============================

let currentCardIndex = 0;
const removedCards = [];

// Activeer volgende kaart
function activateCard(index){
    if(cards[index]){
        cards[index].style.pointerEvents = "auto";
    }
}

// Zet kaarten als stack
cards.forEach((card, index) => {

    card.style.zIndex = 100 - index;

    // Kleine zichtbare stack
    card.style.transform = `
        translateX(${index * 3}px)
        translateY(${index * 2}px)
    `;

    card.style.transition = "all 0.5s ease";

    // Alleen eerste kaart klikbaar
    if(index !== 0){
        card.style.pointerEvents = "none";
    }
});

// Update stack zodat je resterende kaarten ziet
function updateStack(){

    cards.forEach((card, index) => {

        // Skip verwijderde kaarten
        if(card.style.display === "none") return;

        const relativeIndex = index - currentCardIndex;

        if(relativeIndex >= 0){

            // Behoud flip state
            const flip = card.classList.contains("flipped")
                ? "rotateY(180deg)"
                : "";

            card.style.transform = `
                translateX(${relativeIndex * 4}px)
                translateY(${relativeIndex * 2}px)
                ${flip}
            `;
        }
    });
}

// Verwijder kaart animatie
function removeCard(card){

    card.style.transition = "all 0.7s ease";

    const flip = card.classList.contains("flipped")
        ? "rotateY(180deg)"
        : "";

    card.style.transform = `
        translateY(-120px)
        rotate(15deg)
        scale(0.7)
        ${flip}
    `;

    card.style.opacity = "0";

    setTimeout(() => {

        card.style.display = "none";

        // Voeg toe aan bekeken kaarten
        removedCards.push(card);

        // Laat stack opschuiven
        updateStack();

        // Alles bekeken?
        if(removedCards.length === cards.length){
            showReviewSpread();
        }

    }, 700);
}

// REVIEW SPREAD
function showReviewSpread(){

    cardsContainer.classList.add("review-mode");

    const total = removedCards.length;
    const spread = 900;

    removedCards.forEach((card, index) => {

        card.style.display = "block";
        card.style.opacity = "1";

        // Toon voorkant
        card.classList.add("flipped");

        const progress = index / (total - 1);

        // Horizontale spread
        const x = (progress - 0.5) * spread;

        // Regenboog curve
        const curve = Math.sin(progress * Math.PI) * -180;

        // Rotatie
        const rotate = (progress - 0.5) * 50;

        setTimeout(() => {

            card.style.transition = "all 1s ease";

            card.style.transform = `
                translate(${x}px, ${curve}px)
                rotate(${rotate}deg)
                rotateY(180deg)
                scale(1)
            `;

            card.style.zIndex = index + 1;

        }, index * 120);
    });
}

// Klik systeem
cards.forEach((card, index) => {

    let flipped = false;

    card.addEventListener("click", () => {

        // Alleen huidige kaart
        if(index !== currentCardIndex) return;

        // Eerste klik = flip
        if(!flipped){

            flipped = true;

            card.classList.add("flipped");

            // Stack update zodat positie behouden blijft
            updateStack();

        } else {

            // Tweede klik = verwijderen
            removeCard(card);

            // Volgende kaart
            currentCardIndex++;

            if(cards[currentCardIndex]){
                activateCard(currentCardIndex);
            }
        }
    });
});