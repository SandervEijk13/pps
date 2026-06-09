<?php

function upgraderMinBet(): float
{
    return 10.0;
}

function upgraderMaxBet(): float
{
    return 500.0;
}

function upgraderMinWinChance(): float
{
    return 0.02;
}

function upgraderMaxWinChance(): float
{
    return 0.75;
}

function upgraderHouseEdge(): float
{
    return 0.9;
}

function upgraderCardPrice(array $card): float
{
    return round(max(0, (float) ($card['price'] ?? 0)), 2);
}

function readUpgraderJsonBody(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function ensureUpgraderTables(PDO $pdo): void
{
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS upgrader_plays (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            bet_amount DECIMAL(12,2) NOT NULL,
            target_card_id VARCHAR(64) NOT NULL,
            target_price DECIMAL(12,2) NOT NULL,
            win_chance DECIMAL(8,6) NOT NULL,
            won TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_user_time (user_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
}

function requireUpgraderLogin(): ?int
{
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(['success' => false, 'message' => 'Not logged in']);
        return null;
    }
    return (int) $_SESSION['user_id'];
}

function getUpgradeCardPool(PDO $pdo): array
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
                if (!isset($byId[$id]) || upgraderCardPrice($card) > upgraderCardPrice($byId[$id])) {
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
        ['id' => 'sv1-200', 'name' => 'Meowscarada ex', 'image' => 'https://assets.tcgdex.net/en/sv1/200/high.webp', 'rarity' => 'rare', 'price' => 45],
        ['id' => 'sv1-201', 'name' => 'Gardevoir ex', 'image' => 'https://assets.tcgdex.net/en/sv1/201/high.webp', 'rarity' => 'rare', 'price' => 120],
    ];
}

function findPoolCardById(array $pool, string $cardId): ?array
{
    foreach ($pool as $card) {
        if ((string) ($card['id'] ?? '') === $cardId) {
            return $card;
        }
    }
    return null;
}

function calculateUpgradeWinChance(float $bet, float $targetPrice): float
{
    if ($bet <= 0 || $targetPrice <= $bet) {
        return 0.0;
    }

    $fair = $bet / $targetPrice;
    $chance = $fair * upgraderHouseEdge();

    return max(
        upgraderMinWinChance(),
        min(upgraderMaxWinChance(), round($chance, 6))
    );
}

function filterUpgradeTargets(array $pool, float $bet): array
{
    $minPrice = $bet * 1.05;
    $maxPrice = max($minPrice * 2, $bet * 80);

    $targets = array_values(array_filter($pool, function ($card) use ($minPrice, $maxPrice) {
        $price = upgraderCardPrice($card);
        return $price >= $minPrice && $price <= $maxPrice;
    }));

    usort($targets, fn($a, $b) => upgraderCardPrice($a) <=> upgraderCardPrice($b));

    return array_slice($targets, 0, 48);
}

function cardToClient(array $card, ?float $winChance = null): array
{
    $price = upgraderCardPrice($card);
    $row = [
        'id' => $card['id'],
        'name' => $card['name'] ?? 'Card',
        'image' => $card['image'] ?? '',
        'rarity' => $card['rarityLabel'] ?? $card['rarity'] ?? '',
        'setName' => (string) ($card['setName'] ?? $card['set_name'] ?? ''),
        'price' => $price,
        'priceLabel' => number_format($price, $price == floor($price) ? 0 : 2, '.', '') . ' coins',
    ];
    if ($winChance !== null) {
        $row['winChance'] = round($winChance * 100, 2);
        $row['winChanceLabel'] = number_format($winChance * 100, 1, '.', '') . '%';
    }
    return $row;
}

function buildUpgradeWheelSegments(float $winChance): array
{
    $winPct = round($winChance * 100, 1);
    $lossPct = round(100 - $winPct, 1);

    return [
        [
            'id' => 0,
            'label' => 'WIN',
            'short' => $winPct . '%',
            'color' => '#166534',
            'type' => 'win',
            'weight' => (int) max(1, round($winChance * 10000)),
        ],
        [
            'id' => 1,
            'label' => 'LOSS',
            'short' => $lossPct . '%',
            'color' => '#7f1d1d',
            'type' => 'loss',
            'weight' => (int) max(1, round((1 - $winChance) * 10000)),
        ],
    ];
}

function grantUpgradeCard(PDO $pdo, int $userId, string $cardId): int
{
    $cardId = trim($cardId);
    if ($cardId === '') {
        throw new InvalidArgumentException('Missing card id');
    }

    $stmt = $pdo->prepare('SELECT card_amount FROM user_cards WHERE user_id = ? AND card_id = ?');
    $stmt->execute([$userId, $cardId]);
    $row = $stmt->fetch();

    if ($row) {
        $stmt = $pdo->prepare('UPDATE user_cards SET card_amount = card_amount + 1 WHERE user_id = ? AND card_id = ?');
        $stmt->execute([$userId, $cardId]);
        return (int) $row['card_amount'] + 1;
    }

    $stmt = $pdo->prepare('INSERT INTO user_cards (user_id, card_id, card_amount) VALUES (?, ?, 1)');
    $stmt->execute([$userId, $cardId]);

    return 1;
}

function getUpgraderState(PDO $pdo): void
{
    $userId = requireUpgraderLogin();
    if ($userId === null) {
        return;
    }

    $bet = round((float) ($_GET['bet'] ?? 50), 2);
    if ($bet < upgraderMinBet()) {
        $bet = upgraderMinBet();
    }

    $stmt = $pdo->prepare('SELECT user_coins FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user) {
        echo json_encode(['success' => false, 'message' => 'User not found']);
        return;
    }

    $coins = round((float) $user['user_coins'], 2);
    $maxBet = min(upgraderMaxBet(), $coins);
    if ($bet > $maxBet && $maxBet >= upgraderMinBet()) {
        $bet = $maxBet;
    }

    $pool = getUpgradeCardPool($pdo);
    $targets = filterUpgradeTargets($pool, $bet);

    $targetCards = array_map(function ($card) use ($bet) {
        $chance = calculateUpgradeWinChance($bet, upgraderCardPrice($card));
        return cardToClient($card, $chance);
    }, $targets);

    $selectedId = trim((string) ($_GET['targetId'] ?? ''));
    $segments = [];
    $selected = null;

    if ($selectedId !== '') {
        $card = findPoolCardById($pool, $selectedId);
        if ($card) {
            $price = upgraderCardPrice($card);
            if ($price > $bet) {
                $chance = calculateUpgradeWinChance($bet, $price);
                $selected = cardToClient($card, $chance);
                $segments = buildUpgradeWheelSegments($chance);
            }
        }
    }

    echo json_encode([
        'success' => true,
        'coins' => $coins,
        'bet' => $bet,
        'minBet' => upgraderMinBet(),
        'maxBet' => max(upgraderMinBet(), $maxBet),
        'targets' => $targetCards,
        'selectedTarget' => $selected,
        'segments' => $segments,
    ]);
}

function playUpgrade(PDO $pdo): void
{
    $userId = requireUpgraderLogin();
    if ($userId === null) {
        return;
    }

    $input = readUpgraderJsonBody();
    $bet = round((float) ($input['bet'] ?? 0), 2);
    $targetId = trim((string) ($input['targetId'] ?? ''));

    if ($bet < upgraderMinBet()) {
        echo json_encode(['success' => false, 'message' => 'Minimum bet is ' . upgraderMinBet() . ' coins']);
        return;
    }

    if ($targetId === '') {
        echo json_encode(['success' => false, 'message' => 'Select a target card']);
        return;
    }

    $pool = getUpgradeCardPool($pdo);
    $targetCard = findPoolCardById($pool, $targetId);

    if (!$targetCard) {
        echo json_encode(['success' => false, 'message' => 'Invalid target card']);
        return;
    }

    $targetPrice = upgraderCardPrice($targetCard);
    if ($targetPrice <= $bet) {
        echo json_encode(['success' => false, 'message' => 'Target must be worth more than your bet']);
        return;
    }

    $allowed = filterUpgradeTargets($pool, $bet);
    $allowedIds = array_map(fn($c) => (string) ($c['id'] ?? ''), $allowed);
    if (!in_array($targetId, $allowedIds, true)) {
        echo json_encode(['success' => false, 'message' => 'Target not available for this bet']);
        return;
    }

    $winChance = calculateUpgradeWinChance($bet, $targetPrice);

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT user_coins FROM users WHERE id = ? FOR UPDATE');
        $stmt->execute([$userId]);
        $user = $stmt->fetch();

        if (!$user) {
            $pdo->rollBack();
            echo json_encode(['success' => false, 'message' => 'User not found']);
            return;
        }

        $balance = (float) $user['user_coins'];
        if ($balance < $bet) {
            $pdo->rollBack();
            echo json_encode(['success' => false, 'message' => 'Not enough coins', 'coins' => round($balance, 2)]);
            return;
        }

        $stmt = $pdo->prepare('UPDATE users SET user_coins = user_coins - ? WHERE id = ?');
        $stmt->execute([$bet, $userId]);
        recordUserWager($pdo, $userId, $bet);

        $roll = random_int(1, 10000);
        $won = $roll <= (int) round($winChance * 10000);

        $cardAmount = 0;
        if ($won) {
            $cardAmount = grantUpgradeCard($pdo, $userId, $targetId);
            recordUserWin($pdo, $userId, $targetPrice);
            require_once __DIR__ . '/progression.php';
            progressionOnUpgraderWin($pdo, $userId);
        }

        $stmt = $pdo->prepare('
            INSERT INTO upgrader_plays (user_id, bet_amount, target_card_id, target_price, win_chance, won)
            VALUES (?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $userId,
            $bet,
            $targetId,
            $targetPrice,
            $winChance,
            $won ? 1 : 0,
        ]);

        $stmt = $pdo->prepare('SELECT user_coins FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $updated = $stmt->fetch();

        $pdo->commit();

        $segmentIndex = $won ? 0 : 1;
        $segments = buildUpgradeWheelSegments($winChance);

        $reward = null;
        if ($won) {
            $reward = [
                'type' => 'card',
                'cardId' => $targetId,
                'amount' => $cardAmount,
            ];
        }

        echo json_encode([
            'success' => true,
            'won' => $won,
            'segmentIndex' => $segmentIndex,
            'segments' => $segments,
            'winChance' => round($winChance * 100, 2),
            'bet' => $bet,
            'coins' => round((float) ($updated['user_coins'] ?? 0), 2),
            'target' => cardToClient($targetCard, $winChance),
            'reward' => $reward,
            'cardGranted' => $won && $cardAmount > 0,
            'message' => $won
                ? sprintf(
                    '%s is toegevoegd aan je collectie!',
                    $targetCard['name'] ?? 'De kaart'
                )
                : sprintf('Upgrade mislukt. %s coins verloren.', number_format($bet, 2, '.', '')),
        ]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        echo json_encode(['success' => false, 'message' => 'Upgrade failed']);
    }
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
require_once __DIR__ . '/leaderboard.php';

$action = $_GET['action'] ?? '';

try {
    ensureUpgraderTables($pdo);
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Database setup failed']);
    exit;
}

switch ($action) {
    case 'getState':
        getUpgraderState($pdo);
        break;
    case 'upgrade':
        playUpgrade($pdo);
        break;
    default:
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
        break;
}
