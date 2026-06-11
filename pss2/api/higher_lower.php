<?php

function hlMinBet(): float
{
    return 10.0;
}

function hlMaxBet(): float
{
    return 500.0;
}

function hlMultiplierIncrement(): float
{
    return 0.10;
}

function hlMaxStreak(): int
{
    return 9999999999999999;
}

function readHlJsonBody(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function requireHlLogin(): ?int
{
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(['success' => false, 'message' => 'Not logged in']);
        return null;
    }
    return (int) $_SESSION['user_id'];
}

function hlCardPrice(array $card): float
{
    return round(max(0, (float) ($card['price'] ?? 0)), 2);
}

function getHlCardPool(PDO $pdo): array
{
    try {
        $crates = fetchAllCrates($pdo);
        $byId = [];
        foreach ($crates as $crate) {
            foreach ($crate['items'] ?? [] as $card) {
                $id = (string) ($card['id'] ?? '');
                if ($id === '') {
                    continue;
                }
                if (!isset($byId[$id]) || hlCardPrice($card) > hlCardPrice($byId[$id])) {
                    $byId[$id] = $card;
                }
            }
        }
        if ($byId !== []) {
            return array_values($byId);
        }
    } catch (Throwable $e) {
        // fallback below
    }

    return [
        ['id' => 'sv1-015', 'name' => 'Floragato', 'image' => 'https://assets.tcgdex.net/en/sv1/015/high.webp', 'rarity' => 'uncommon', 'price' => 2.5],
        ['id' => 'sv1-050', 'name' => 'Ninetales', 'image' => 'https://assets.tcgdex.net/en/sv1/050/high.webp', 'rarity' => 'rare', 'price' => 12],
        ['id' => 'sv1-100', 'name' => 'Gardevoir', 'image' => 'https://assets.tcgdex.net/en/sv1/100/high.webp', 'rarity' => 'rare', 'price' => 28],
        ['id' => 'sv1-200', 'name' => 'Meowscarada ex', 'image' => 'https://assets.tcgdex.net/en/sv1/200/high.webp', 'rarity' => 'rare', 'price' => 45],
        ['id' => 'sv1-201', 'name' => 'Gardevoir ex', 'image' => 'https://assets.tcgdex.net/en/sv1/201/high.webp', 'rarity' => 'rare', 'price' => 120],
        ['id' => 'sv1-202', 'name' => 'Charizard ex', 'image' => 'https://assets.tcgdex.net/en/sv1/202/high.webp', 'rarity' => 'rare', 'price' => 250],
    ];
}

function hlCardToClient(array $card, bool $revealPrice = true): array
{
    $price = hlCardPrice($card);
    $row = [
        'id' => $card['id'] ?? '',
        'name' => $card['name'] ?? 'Card',
        'image' => $card['image'] ?? '',
        'rarity' => $card['rarityLabel'] ?? $card['rarity'] ?? '',
    ];
    if ($revealPrice) {
        $row['price'] = $price;
        $row['priceLabel'] = number_format($price, $price == floor($price) ? 0 : 2, '.', '') . ' coins';
    }
    return $row;
}

function pickHlRandomCard(array $pool, ?string $excludeId = null, ?float $excludePrice = null): ?array
{
    if ($pool === []) {
        return null;
    }

    $candidates = array_values(array_filter($pool, function ($card) use ($excludeId, $excludePrice) {
        $id = (string) ($card['id'] ?? '');
        if ($excludeId !== null && $id === $excludeId) {
            return false;
        }
        if ($excludePrice !== null && abs(hlCardPrice($card) - $excludePrice) < 0.001) {
            return false;
        }
        return true;
    }));

    if ($candidates === []) {
        $candidates = array_values(array_filter($pool, fn($card) => (string) ($card['id'] ?? '') !== (string) $excludeId));
    }
    if ($candidates === []) {
        return $pool[array_rand($pool)];
    }

    return $candidates[array_rand($candidates)];
}

function dealHlRound(array $pool, ?array $knownCard = null): ?array
{
    $cardA = $knownCard ?? pickHlRandomCard($pool);
    if (!$cardA) {
        return null;
    }
    $priceA = hlCardPrice($cardA);
    $cardB = pickHlRandomCard($pool, (string) ($cardA['id'] ?? ''), $priceA);
    if (!$cardB) {
        return null;
    }

    return ['card_a' => $cardA, 'card_b' => $cardB];
}

function hlMultiplierForStreak(int $streak): float
{
    if ($streak <= 0) {
        return 1.0;
    }
    return round(1.0 + $streak * hlMultiplierIncrement(), 2);
}

function hlGameToClient(?array $game): ?array
{
    if (!$game || empty($game['active'])) {
        return null;
    }

    $streak = (int) ($game['streak'] ?? 0);

    return [
        'bet' => round((float) ($game['bet'] ?? 0), 2),
        'streak' => $streak,
        'multiplier' => hlMultiplierForStreak($streak),
        'canCashOut' => $streak > 0,
        'potentialWin' => round((float) ($game['bet'] ?? 0) * hlMultiplierForStreak($streak), 2),
        'cardA' => hlCardToClient($game['card_a'] ?? [], true),
        'cardB' => hlCardToClient($game['card_b'] ?? [], false),
    ];
}

function getHlState(PDO $pdo): void
{
    $userId = requireHlLogin();
    if ($userId === null) {
        return;
    }

    $stmt = $pdo->prepare('SELECT user_coins FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user) {
        echo json_encode(['success' => false, 'message' => 'User not found']);
        return;
    }

    $coins = round((float) $user['user_coins'], 2);
    $maxBet = min(hlMaxBet(), $coins);
    $game = $_SESSION['hl_game'] ?? null;

    echo json_encode([
        'success' => true,
        'coins' => $coins,
        'minBet' => hlMinBet(),
        'maxBet' => max(hlMinBet(), $maxBet),
        'multiplierIncrement' => hlMultiplierIncrement(),
        'game' => hlGameToClient(is_array($game) ? $game : null),
    ]);
}

function startHlGame(PDO $pdo): void
{
    $userId = requireHlLogin();
    if ($userId === null) {
        return;
    }

    if (!empty($_SESSION['hl_game']['active'])) {
        echo json_encode(['success' => false, 'message' => 'Finish or cash out your current game first']);
        return;
    }

    $input = readHlJsonBody();
    $bet = round((float) ($input['bet'] ?? 0), 2);

    if ($bet < hlMinBet()) {
        echo json_encode(['success' => false, 'message' => 'Minimum bet is ' . hlMinBet() . ' coins']);
        return;
    }

    $stmt = $pdo->prepare('SELECT user_coins FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user) {
        echo json_encode(['success' => false, 'message' => 'User not found']);
        return;
    }

    $coins = round((float) $user['user_coins'], 2);
    if ($bet > $coins) {
        echo json_encode(['success' => false, 'message' => 'Not enough coins', 'coins' => $coins]);
        return;
    }

    if ($bet > hlMaxBet()) {
        echo json_encode(['success' => false, 'message' => 'Maximum bet is ' . hlMaxBet() . ' coins']);
        return;
    }

    $pool = getHlCardPool($pdo);
    $round = dealHlRound($pool);
    if (!$round) {
        echo json_encode(['success' => false, 'message' => 'Could not deal cards']);
        return;
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('UPDATE users SET user_coins = user_coins - ? WHERE id = ? AND user_coins >= ?');
        $stmt->execute([$bet, $userId, $bet]);
        if ($stmt->rowCount() === 0) {
            $pdo->rollBack();
            echo json_encode(['success' => false, 'message' => 'Not enough coins']);
            return;
        }

        require_once __DIR__ . '/leaderboard.php';
        recordUserWager($pdo, $userId, $bet, 100);

        $_SESSION['hl_game'] = [
            'active' => true,
            'bet' => $bet,
            'streak' => 0,
            'card_a' => $round['card_a'],
            'card_b' => $round['card_b'],
        ];

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        unset($_SESSION['hl_game']);
        echo json_encode(['success' => false, 'message' => 'Could not start game']);
        return;
    }

    $stmt = $pdo->prepare('SELECT user_coins FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $newCoins = round((float) ($stmt->fetch()['user_coins'] ?? 0), 2);

    echo json_encode([
        'success' => true,
        'coins' => $newCoins,
        'game' => hlGameToClient($_SESSION['hl_game']),
    ]);
}

function guessHl(PDO $pdo): void
{
    $userId = requireHlLogin();
    if ($userId === null) {
        return;
    }

    $game = $_SESSION['hl_game'] ?? null;
    if (!$game || empty($game['active'])) {
        echo json_encode(['success' => false, 'message' => 'No active game']);
        return;
    }

    $input = readHlJsonBody();
    $direction = strtolower(trim((string) ($input['direction'] ?? '')));
    if ($direction !== 'higher' && $direction !== 'lower') {
        echo json_encode(['success' => false, 'message' => 'Invalid guess']);
        return;
    }

    $priceA = hlCardPrice($game['card_a']);
    $priceB = hlCardPrice($game['card_b']);
    $isHigher = $priceB > $priceA;
    $isLower = $priceB < $priceA;
    $isTie = abs($priceB - $priceA) < 0.001;

    $won = false;
    if (!$isTie) {
        $won = ($direction === 'higher' && $isHigher) || ($direction === 'lower' && $isLower);
    }

    $revealedB = hlCardToClient($game['card_b'], true);

    if (!$won) {
        unset($_SESSION['hl_game']);

        $stmt = $pdo->prepare('SELECT user_coins FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $coins = round((float) ($stmt->fetch()['user_coins'] ?? 0), 2);

        echo json_encode([
            'success' => true,
            'won' => false,
            'coins' => $coins,
            'revealedB' => $revealedB,
            'priceA' => $priceA,
            'priceB' => $priceB,
            'message' => $isTie ? 'Equal value — you lose this round.' : 'Wrong guess — bet lost.',
            'game' => null,
        ]);
        return;
    }

    $streak = (int) ($game['streak'] ?? 0) + 1;
    if ($streak >= hlMaxStreak()) {
        $bet = (float) $game['bet'];
        $multiplier = hlMultiplierForStreak($streak);
        $payout = round($bet * $multiplier, 2);

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('UPDATE users SET user_coins = user_coins + ? WHERE id = ?');
            $stmt->execute([$payout, $userId]);
            require_once __DIR__ . '/leaderboard.php';
            recordUserWin($pdo, $userId, $payout);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            echo json_encode(['success' => false, 'message' => 'Payout failed']);
            return;
        }

        unset($_SESSION['hl_game']);

        $stmt = $pdo->prepare('SELECT user_coins FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $coins = round((float) ($stmt->fetch()['user_coins'] ?? 0), 2);

        echo json_encode([
            'success' => true,
            'won' => true,
            'autoCashOut' => true,
            'coins' => $coins,
            'payout' => $payout,
            'multiplier' => $multiplier,
            'streak' => $streak,
            'revealedB' => $revealedB,
            'priceA' => $priceA,
            'priceB' => $priceB,
            'message' => 'Max streak reached — auto cashed out!',
            'game' => null,
        ]);
        return;
    }

    $pool = getHlCardPool($pdo);
    $newCardB = pickHlRandomCard($pool, (string) ($game['card_b']['id'] ?? ''), $priceB);
    if (!$newCardB) {
        echo json_encode(['success' => false, 'message' => 'Could not deal next card']);
        return;
    }

    $_SESSION['hl_game'] = [
        'active' => true,
        'bet' => (float) $game['bet'],
        'streak' => $streak,
        'card_a' => $game['card_b'],
        'card_b' => $newCardB,
    ];

    $stmt = $pdo->prepare('SELECT user_coins FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $coins = round((float) ($stmt->fetch()['user_coins'] ?? 0), 2);

    echo json_encode([
        'success' => true,
        'won' => true,
        'coins' => $coins,
        'streak' => $streak,
        'multiplier' => hlMultiplierForStreak($streak),
        'potentialWin' => round((float) $game['bet'] * hlMultiplierForStreak($streak), 2),
        'revealedB' => $revealedB,
        'priceA' => $priceA,
        'priceB' => $priceB,
        'message' => 'Correct!',
        'game' => hlGameToClient($_SESSION['hl_game']),
    ]);
}

function cashOutHl(PDO $pdo): void
{
    $userId = requireHlLogin();
    if ($userId === null) {
        return;
    }

    $game = $_SESSION['hl_game'] ?? null;
    if (!$game || empty($game['active'])) {
        echo json_encode(['success' => false, 'message' => 'No active game']);
        return;
    }

    $streak = (int) ($game['streak'] ?? 0);
    if ($streak <= 0) {
        echo json_encode(['success' => false, 'message' => 'Win at least one round before cashing out']);
        return;
    }

    $bet = (float) $game['bet'];
    $multiplier = hlMultiplierForStreak($streak);
    $payout = round($bet * $multiplier, 2);

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('UPDATE users SET user_coins = user_coins + ? WHERE id = ?');
        $stmt->execute([$payout, $userId]);
        require_once __DIR__ . '/leaderboard.php';
        recordUserWin($pdo, $userId, $payout);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'message' => 'Cash out failed']);
        return;
    }

    unset($_SESSION['hl_game']);

    $stmt = $pdo->prepare('SELECT user_coins FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $coins = round((float) ($stmt->fetch()['user_coins'] ?? 0), 2);

    echo json_encode([
        'success' => true,
        'coins' => $coins,
        'payout' => $payout,
        'multiplier' => $multiplier,
        'streak' => $streak,
        'message' => 'Cashed out successfully!',
        'game' => null,
    ]);
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (
    $origin !== ''
    && (
        $origin === 'http://localhost:5173'
        || strpos($origin, 'http://localhost') === 0
        || strpos($origin, 'http://127.0.0.1') === 0
    )
) {
    header("Access-Control-Allow-Origin: $origin");
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

session_start();
require 'db.php';
require_once __DIR__ . '/crates.php';

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'getState':
        getHlState($pdo);
        break;
    case 'start':
        startHlGame($pdo);
        break;
    case 'guess':
        guessHl($pdo);
        break;
    case 'cashout':
        cashOutHl($pdo);
        break;
    default:
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
        break;
}
