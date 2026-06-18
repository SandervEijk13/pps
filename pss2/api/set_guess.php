<?php

function sgMinBet(): float
{
    return 10.0;
}

function sgMaxBet(): float
{
    return 500.0;
}

function sgMultiplierIncrement(): float
{
    return 0.15;
}

function sgMaxStreak(): int
{
    return 50;
}

function sgOptionCount(): int
{
    return 4;
}

function readSgJsonBody(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function requireSgLogin(): ?int
{
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(['success' => false, 'message' => 'Not logged in']);
        return null;
    }
    return (int) $_SESSION['user_id'];
}

function sgPrettySetName(string $setId): string
{
    $id = trim($setId);
    if ($id === '') {
        return 'Unknown set';
    }
    return strtoupper(preg_replace('/(\d+)/', ' $1', $id));
}

function getSgCardPool(PDO $pdo): array
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
                if (!isset($byId[$id])) {
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
        ['id' => 'sv1-015', 'name' => 'Floragato', 'image' => 'https://assets.tcgdex.net/en/sv1/015/high.webp', 'setName' => 'Scarlet & Violet'],
        ['id' => 'sv1-050', 'name' => 'Ninetales', 'image' => 'https://assets.tcgdex.net/en/sv1/050/high.webp', 'setName' => 'Scarlet & Violet'],
        ['id' => 'swsh1-020', 'name' => 'Rillaboom', 'image' => 'https://assets.tcgdex.net/en/swsh1/020/high.webp', 'setName' => 'Sword & Shield'],
        ['id' => 'sm1-012', 'name' => 'Rowlet', 'image' => 'https://assets.tcgdex.net/en/sm1/012/high.webp', 'setName' => 'Sun & Moon'],
        ['id' => 'xy1-030', 'name' => 'Frogadier', 'image' => 'https://assets.tcgdex.net/en/xy1/030/high.webp', 'setName' => 'XY'],
        ['id' => 'base1-004', 'name' => 'Charmander', 'image' => 'https://assets.tcgdex.net/en/base1/004/high.webp', 'setName' => 'Base Set'],
    ];
}

function sgCardToClient(array $card, bool $revealSet = false): array
{
    $setId = deriveSetIdFromCardId((string) ($card['id'] ?? ''));
    $setName = trim((string) ($card['setName'] ?? $card['set_name'] ?? ''));
    if ($setName === '') {
        $setName = sgPrettySetName($setId);
    }

    $row = [
        'id' => (string) ($card['id'] ?? ''),
        'name' => (string) ($card['name'] ?? 'Card'),
        'image' => (string) ($card['image'] ?? ''),
    ];

    if ($revealSet) {
        $row['setId'] = $setId;
        $row['setName'] = $setName;
    }

    return $row;
}

function buildSgSetCatalog(array $pool): array
{
    $catalog = [];
    foreach ($pool as $card) {
        $setId = deriveSetIdFromCardId((string) ($card['id'] ?? ''));
        if ($setId === '' || isset($catalog[$setId])) {
            continue;
        }
        $setName = trim((string) ($card['setName'] ?? $card['set_name'] ?? ''));
        $catalog[$setId] = [
            'id' => $setId,
            'name' => $setName !== '' ? $setName : sgPrettySetName($setId),
        ];
    }

    return array_values($catalog);
}

function sgSetOptionToClient(array $set): array
{
    return [
        'id' => (string) ($set['id'] ?? ''),
        'name' => (string) ($set['name'] ?? sgPrettySetName((string) ($set['id'] ?? ''))),
    ];
}

function pickSgRandomCard(array $pool, ?string $excludeId = null): ?array
{
    $candidates = array_values(array_filter($pool, function ($card) use ($excludeId) {
        $id = (string) ($card['id'] ?? '');
        return $id !== '' && ($excludeId === null || $id !== $excludeId);
    }));

    if ($candidates === []) {
        return $pool[array_rand($pool)] ?? null;
    }

    return $candidates[array_rand($candidates)];
}

function pickSgOptions(array $catalog, string $correctSetId): array
{
    $correct = null;
    foreach ($catalog as $set) {
        if ((string) $set['id'] === $correctSetId) {
            $correct = $set;
            break;
        }
    }

    if ($correct === null) {
        $correct = ['id' => $correctSetId, 'name' => sgPrettySetName($correctSetId)];
    }

    $others = array_values(array_filter($catalog, fn($set) => (string) $set['id'] !== $correctSetId));
    shuffle($others);

    $targetCount = min(sgOptionCount(), max(2, count($catalog)));
    $options = [$correct];
    foreach (array_slice($others, 0, $targetCount - 1) as $set) {
        $options[] = $set;
    }

    shuffle($options);
    return array_map('sgSetOptionToClient', $options);
}

function dealSgRound(array $pool, array $catalog, ?string $excludeCardId = null): ?array
{
    $card = pickSgRandomCard($pool, $excludeCardId);
    if (!$card) {
        return null;
    }

    $setId = deriveSetIdFromCardId((string) ($card['id'] ?? ''));
    if ($setId === '') {
        return null;
    }

    $options = pickSgOptions($catalog, $setId);
    if (count($options) < 2) {
        return null;
    }

    return [
        'card' => $card,
        'correctSetId' => $setId,
        'options' => $options,
    ];
}

function sgMultiplierForStreak(int $streak): float
{
    if ($streak <= 0) {
        return 1.0;
    }
    return round(1.0 + $streak * sgMultiplierIncrement(), 2);
}

function sgGameToClient(?array $game): ?array
{
    if (!$game || empty($game['active'])) {
        return null;
    }

    $streak = (int) ($game['streak'] ?? 0);
    $bet = round((float) ($game['bet'] ?? 0), 2);

    return [
        'bet' => $bet,
        'streak' => $streak,
        'multiplier' => sgMultiplierForStreak($streak),
        'canCashOut' => $streak > 0,
        'potentialWin' => round($bet * sgMultiplierForStreak($streak), 2),
        'card' => sgCardToClient($game['card'] ?? [], false),
        'options' => array_map('sgSetOptionToClient', $game['options'] ?? []),
    ];
}

function getSgState(PDO $pdo): void
{
    $userId = requireSgLogin();
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
    $maxBet = min(sgMaxBet(), $coins);
    $game = $_SESSION['sg_game'] ?? null;

    echo json_encode([
        'success' => true,
        'coins' => $coins,
        'minBet' => sgMinBet(),
        'maxBet' => max(sgMinBet(), $maxBet),
        'multiplierIncrement' => sgMultiplierIncrement(),
        'game' => sgGameToClient(is_array($game) ? $game : null),
    ]);
}

function startSgGame(PDO $pdo): void
{
    $userId = requireSgLogin();
    if ($userId === null) {
        return;
    }

    if (!empty($_SESSION['sg_game']['active'])) {
        echo json_encode(['success' => false, 'message' => 'Finish or cash out your current game first']);
        return;
    }

    $input = readSgJsonBody();
    $bet = round((float) ($input['bet'] ?? 0), 2);

    if ($bet < sgMinBet()) {
        echo json_encode(['success' => false, 'message' => 'Minimum bet is ' . sgMinBet() . ' coins']);
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

    if ($bet > sgMaxBet()) {
        echo json_encode(['success' => false, 'message' => 'Maximum bet is ' . sgMaxBet() . ' coins']);
        return;
    }

    $pool = getSgCardPool($pdo);
    $catalog = buildSgSetCatalog($pool);
    if (count($catalog) < 2) {
        echo json_encode(['success' => false, 'message' => 'Not enough sets available for this game']);
        return;
    }

    $round = dealSgRound($pool, $catalog);
    if (!$round) {
        echo json_encode(['success' => false, 'message' => 'Could not start round']);
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

        $_SESSION['sg_game'] = [
            'active' => true,
            'bet' => $bet,
            'streak' => 0,
            'card' => $round['card'],
            'correct_set_id' => $round['correctSetId'],
            'options' => $round['options'],
        ];

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        unset($_SESSION['sg_game']);
        echo json_encode(['success' => false, 'message' => 'Could not start game']);
        return;
    }

    $stmt = $pdo->prepare('SELECT user_coins FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $newCoins = round((float) ($stmt->fetch()['user_coins'] ?? 0), 2);

    echo json_encode([
        'success' => true,
        'coins' => $newCoins,
        'game' => sgGameToClient($_SESSION['sg_game']),
    ]);
}

function guessSg(PDO $pdo): void
{
    $userId = requireSgLogin();
    if ($userId === null) {
        return;
    }

    $game = $_SESSION['sg_game'] ?? null;
    if (!$game || empty($game['active'])) {
        echo json_encode(['success' => false, 'message' => 'No active game']);
        return;
    }

    $input = readSgJsonBody();
    $pickedSetId = trim((string) ($input['setId'] ?? ''));
    if ($pickedSetId === '') {
        echo json_encode(['success' => false, 'message' => 'Pick a set']);
        return;
    }

    $correctSetId = (string) ($game['correct_set_id'] ?? '');
    $won = strcasecmp($pickedSetId, $correctSetId) === 0;
    $correctSetName = sgPrettySetName($correctSetId);
    foreach ($game['options'] ?? [] as $option) {
        if ((string) ($option['id'] ?? '') === $correctSetId) {
            $correctSetName = (string) ($option['name'] ?? $correctSetName);
            break;
        }
    }

    if (!$won) {
        unset($_SESSION['sg_game']);

        $stmt = $pdo->prepare('SELECT user_coins FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $coins = round((float) ($stmt->fetch()['user_coins'] ?? 0), 2);

        echo json_encode([
            'success' => true,
            'won' => false,
            'coins' => $coins,
            'correctSetId' => $correctSetId,
            'correctSetName' => $correctSetName,
            'card' => sgCardToClient($game['card'] ?? [], true),
            'message' => "Fout — het was {$correctSetName}.",
            'game' => null,
        ]);
        return;
    }

    $streak = (int) ($game['streak'] ?? 0) + 1;
    $storyProgress = bumpUserStoryStatWithFeedback($pdo, $userId, 'set_guess_correct', 1);

    if ($streak >= sgMaxStreak()) {
        $bet = (float) $game['bet'];
        $multiplier = sgMultiplierForStreak($streak);
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

        unset($_SESSION['sg_game']);

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
            'correctSetId' => $correctSetId,
            'correctSetName' => $correctSetName,
            'card' => sgCardToClient($game['card'] ?? [], true),
            'message' => 'Max streak reached — auto cashed out!',
            'storyProgress' => $storyProgress,
            'game' => null,
        ]);
        return;
    }

    $pool = getSgCardPool($pdo);
    $catalog = buildSgSetCatalog($pool);
    $round = dealSgRound($pool, $catalog, (string) ($game['card']['id'] ?? ''));
    if (!$round) {
        echo json_encode(['success' => false, 'message' => 'Could not deal next round']);
        return;
    }

    $_SESSION['sg_game'] = [
        'active' => true,
        'bet' => (float) $game['bet'],
        'streak' => $streak,
        'card' => $round['card'],
        'correct_set_id' => $round['correctSetId'],
        'options' => $round['options'],
    ];

    $stmt = $pdo->prepare('SELECT user_coins FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $coins = round((float) ($stmt->fetch()['user_coins'] ?? 0), 2);

    echo json_encode([
        'success' => true,
        'won' => true,
        'coins' => $coins,
        'streak' => $streak,
        'multiplier' => sgMultiplierForStreak($streak),
        'potentialWin' => round((float) $game['bet'] * sgMultiplierForStreak($streak), 2),
        'correctSetId' => $correctSetId,
        'correctSetName' => $correctSetName,
        'card' => sgCardToClient($game['card'] ?? [], true),
        'message' => 'Correct guess!',
        'storyProgress' => $storyProgress,
        'game' => sgGameToClient($_SESSION['sg_game']),
    ]);
}

function cashOutSg(PDO $pdo): void
{
    $userId = requireSgLogin();
    if ($userId === null) {
        return;
    }

    $game = $_SESSION['sg_game'] ?? null;
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
    $multiplier = sgMultiplierForStreak($streak);
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

    unset($_SESSION['sg_game']);

    $stmt = $pdo->prepare('SELECT user_coins FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $coins = round((float) ($stmt->fetch()['user_coins'] ?? 0), 2);

    echo json_encode([
        'success' => true,
        'coins' => $coins,
        'payout' => $payout,
        'multiplier' => $multiplier,
        'streak' => $streak,
        'message' => 'Uitbetaald!',
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
require_once __DIR__ . '/trades.php';
require_once __DIR__ . '/storybook_lib.php';

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'getState':
        getSgState($pdo);
        break;
    case 'start':
        startSgGame($pdo);
        break;
    case 'guess':
        guessSg($pdo);
        break;
    case 'cashout':
        cashOutSg($pdo);
        break;
    default:
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
        break;
}
