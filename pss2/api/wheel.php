<?php

function wheelSpinCostCoins(): float
{
    return 50.0;
}

function wheelSpinCostTickets(): int
{
    return 1;
}

function wheelTruncateLabel(string $text, int $max = 22): string
{
    if (function_exists('mb_strlen') && mb_strlen($text) > $max) {
        return rtrim(mb_substr($text, 0, $max - 1)) . '…';
    }
    if (strlen($text) > $max) {
        return rtrim(substr($text, 0, $max - 1)) . '…';
    }
    return $text;
}

function wheelFormatPrice(float $price): string
{
    $rounded = round($price, 2);
    return abs($rounded - round($rounded)) < 0.001
        ? (string) (int) round($rounded)
        : number_format($rounded, 2, '.', '');
}

function wheelColorForCardPrice(float $price): string
{
    if ($price >= 200) {
        return '#881337';
    }
    if ($price >= 50) {
        return '#713f12';
    }
    if ($price >= 25) {
        return '#3730a3';
    }
    if ($price >= 10) {
        return '#134e4a';
    }
    return '#334155';
}

function wheelCardColorByIndex(int $index): string
{
    $palette = ['#1e293b', '#273449', '#334155', '#3d4f66'];
    return $palette[$index % count($palette)];
}

function wheelMaxShopPackSegments(): int
{
    return 3;
}

function pickWheelShopPacks(array $packs, int $max, string $seed): array
{
    if ($max <= 0 || $packs === []) {
        return [];
    }
    if (count($packs) <= $max) {
        return array_values($packs);
    }

    $indexed = array_values($packs);
    usort($indexed, function ($a, $b) use ($seed) {
        $ka = md5($seed . '|' . ($a['id'] ?? '') . '|' . ($a['name'] ?? ''));
        $kb = md5($seed . '|' . ($b['id'] ?? '') . '|' . ($b['name'] ?? ''));
        return strcmp($ka, $kb);
    });

    return array_slice($indexed, 0, $max);
}

function wheelCatalogVersion(PDO $pdo): string
{
    $pool = getWheelCardPool($pdo);
    $packs = getShopPacks($pdo);
    $ids = array_map(fn($c) => $c['id'] ?? '', array_slice($pool, 0, 5));
    $packIds = array_map(fn($p) => $p['id'] ?? '', array_slice($packs, 0, 5));
    return md5(
        'wheel-palette-v2|' . count($pool) . '|' . count($packs) . '|' . wheelMaxShopPackSegments()
        . '|' . implode(',', $ids) . '|' . implode(',', $packIds)
    );
}

function getResolvedWheelSegments(PDO $pdo): array
{
    $version = wheelCatalogVersion($pdo);
    if (
        isset($_SESSION['wheel_segments'], $_SESSION['wheel_segments_version'])
        && $_SESSION['wheel_segments_version'] === $version
        && is_array($_SESSION['wheel_segments'])
    ) {
        return $_SESSION['wheel_segments'];
    }

    $segments = buildWheelSegmentsFromCatalog($pdo);
    $_SESSION['wheel_segments'] = $segments;
    $_SESSION['wheel_segments_version'] = $version;

    return $segments;
}

function buildWheelSegmentsFromCatalog(PDO $pdo): array
{
    $pool = getWheelCardPool($pdo);
    $packs = getShopPacks($pdo);
    $segments = [];
    $nextId = 0;

    $add = function (array $seg) use (&$segments, &$nextId) {
        $seg['id'] = $nextId++;
        $segments[] = $seg;
    };

    $add([
        'label' => 'No prize',
        'short' => '—',
        'color' => '#27272a',
        'weight' => 7,
        'type' => 'nothing',
    ]);

    foreach ([15, 60, 100] as $amount) {
        $add([
            'label' => "{$amount} coins",
            'short' => (string) $amount,
            'color' => $amount >= 100 ? '#52525b' : ($amount >= 60 ? '#404040' : '#3f3f46'),
            'weight' => $amount >= 100 ? 4 : 9,
            'type' => 'coins',
            'amount' => (float) $amount,
            'priceValue' => (float) $amount,
            'prizeKind' => 'coins',
        ]);
    }

    $add([
        'label' => '1 ticket',
        'short' => '1',
        'color' => '#312e81',
        'weight' => 5,
        'type' => 'tickets',
        'amount' => 1,
        'prizeKind' => 'ticket',
    ]);

    $cardPool = array_values(array_filter($pool, function ($card) {
        $p = cardPriceValue($card);
        return $p >= 1 && $p <= 75;
    }));
    usort($cardPool, fn($a, $b) => cardPriceValue($a) <=> cardPriceValue($b));

    $cardWeight = count($cardPool) > 0 ? max(1, (int) floor(30 / count($cardPool))) : 3;

    foreach ($cardPool as $cardIndex => $card) {
        $price = cardPriceValue($card);
        $add([
            'label' => wheelTruncateLabel((string) ($card['name'] ?? 'Card')),
            'short' => wheelFormatPrice($price),
            'color' => $price >= 50
                ? wheelColorForCardPrice($price)
                : wheelCardColorByIndex($cardIndex),
            'weight' => $cardWeight,
            'type' => 'card_fixed',
            'card' => $card,
            'priceValue' => $price,
            'image' => $card['image'] ?? null,
            'prizeKind' => 'card',
            'bigWin' => $price >= 50,
        ]);
    }

    $wheelPacks = pickWheelShopPacks(
        $packs,
        wheelMaxShopPackSegments(),
        wheelCatalogVersion($pdo) . '-packs'
    );

    foreach ($wheelPacks as $pack) {
        $price = round((float) ($pack['price'] ?? 0), 2);
        $name = (string) ($pack['name'] ?? 'Shop pack');
        $add([
            'label' => wheelTruncateLabel($name),
            'short' => $price > 0 ? wheelFormatPrice($price) : 'Pack',
            'color' => '#44403c',
            'weight' => 5,
            'type' => 'shop_pack_fixed',
            'pack' => $pack,
            'priceValue' => $price,
            'image' => $pack['photo'] ?? null,
            'prizeKind' => 'pack',
            'bigWin' => true,
        ]);
    }

    $megaCard = pickCardByPriceRange($pool, 200, 350, true);
    $megaPrice = cardPriceValue($megaCard);
    $add([
        'label' => wheelTruncateLabel((string) ($megaCard['name'] ?? 'Mega card')),
        'short' => wheelFormatPrice($megaPrice),
        'color' => '#881337',
        'weight' => 2,
        'type' => 'card_fixed',
        'card' => $megaCard,
        'priceValue' => $megaPrice,
        'image' => $megaCard['image'] ?? null,
        'prizeKind' => 'mega',
        'bigWin' => true,
    ]);

    return $segments;
}

function ensureWheelTables(PDO $pdo): void
{
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS wheel_spins (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            segment_id INT NOT NULL,
            payment_type VARCHAR(16) NOT NULL,
            reward_type VARCHAR(24) NOT NULL,
            reward_json TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_user_time (user_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
}

function ensureWheelUserColumns(PDO $pdo): void
{
    $stmt = $pdo->query('SHOW COLUMNS FROM users');
    $cols = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'Field');

    if (!in_array('wheel_tickets', $cols, true)) {
        $pdo->exec('ALTER TABLE users ADD COLUMN wheel_tickets INT NOT NULL DEFAULT 0');
    }
}

function requireWheelLogin(): ?int
{
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(['success' => false, 'message' => 'Not logged in']);
        return null;
    }
    return (int) $_SESSION['user_id'];
}

function readWheelJsonBody(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function segmentsForClient(PDO $pdo): array
{
    return array_map(function ($seg) {
        return [
            'id' => $seg['id'],
            'label' => $seg['label'],
            'short' => $seg['short'],
            'color' => $seg['color'],
            'image' => $seg['image'] ?? null,
            'priceValue' => $seg['priceValue'] ?? null,
            'prizeKind' => $seg['prizeKind'] ?? $seg['type'],
            'bigWin' => !empty($seg['bigWin']),
        ];
    }, getResolvedWheelSegments($pdo));
}

function pickWeightedSegment(PDO $pdo): array
{
    $segments = getResolvedWheelSegments($pdo);
    $total = array_sum(array_column($segments, 'weight'));
    $roll = random_int(1, max(1, $total));
    $acc = 0;
    foreach ($segments as $seg) {
        $acc += $seg['weight'];
        if ($roll <= $acc) {
            return $seg;
        }
    }
    return $segments[0];
}

function findSegmentWheelIndex(array $segments, array $segment): int
{
    foreach ($segments as $idx => $seg) {
        if ((int) $seg['id'] === (int) $segment['id']) {
            return $idx;
        }
    }
    return (int) ($segment['id'] ?? 0);
}

function getWheelCardPool(PDO $pdo): array
{
    try {
        $crates = fetchAllCrates($pdo);
        foreach ($crates as $crate) {
            if (($crate['id'] ?? '') === 'basic' && !empty($crate['items'])) {
                return $crate['items'];
            }
        }
        foreach ($crates as $crate) {
            if (!empty($crate['items'])) {
                return $crate['items'];
            }
        }
    } catch (Throwable $e) {
        // fallback below
    }

    return [
        ['id' => 'sv1-001', 'name' => 'Sprigatito', 'image' => 'https://assets.tcgdex.net/en/sv1/001/high.webp', 'rarity' => 'common', 'price' => 0.15],
        ['id' => 'sv1-015', 'name' => 'Floragato', 'image' => 'https://assets.tcgdex.net/en/sv1/015/high.webp', 'rarity' => 'uncommon', 'price' => 0.35],
        ['id' => 'sv1-200', 'name' => 'Meowscarada ex', 'image' => 'https://assets.tcgdex.net/en/sv1/200/high.webp', 'rarity' => 'rare', 'price' => 8.5],
    ];
}

function cardPriceValue(array $card): float
{
    return round(max(0, (float) ($card['price'] ?? 0)), 2);
}

function pickCardByPriceRange(array $pool, float $min, float $max, bool $preferHigh = false): array
{
    $filtered = array_values(array_filter($pool, function ($card) use ($min, $max) {
        $p = cardPriceValue($card);
        return $p >= $min && $p <= $max;
    }));

    if (!$filtered && $pool) {
        $sorted = $pool;
        usort($sorted, fn($a, $b) => cardPriceValue($a) <=> cardPriceValue($b));
        if ($preferHigh) {
            $target = ($min + $max) / 2;
            $best = $sorted[0];
            foreach ($sorted as $card) {
                if (abs(cardPriceValue($card) - $target) < abs(cardPriceValue($best) - $target)) {
                    $best = $card;
                }
            }
            $filtered = [$best];
        } else {
            $filtered = [$sorted[0]];
        }
    }

    if ($preferHigh) {
        usort($filtered, fn($a, $b) => cardPriceValue($b) <=> cardPriceValue($a));
    }

    return $filtered[random_int(0, count($filtered) - 1)];
}

function pickCoinsInRange(float $min, float $max): float
{
    $min = round($min, 2);
    $max = round($max, 2);
    if ($max <= $min) {
        return $min;
    }
    return round($min + (random_int(0, (int) (($max - $min) * 100)) / 100), 2);
}

function getShopPacks(PDO $pdo): array
{
    try {
        $stmt = $pdo->query('SELECT id, price, photo, name FROM packs ORDER BY price ASC');
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return is_array($rows) ? $rows : [];
    } catch (Throwable $e) {
        return [];
    }
}

function cardRewardPayload(array $card): array
{
    $price = cardPriceValue($card);
    return [
        'type' => 'card',
        'card' => [
            'id' => $card['id'],
            'name' => $card['name'],
            'image' => $card['image'] ?? '',
            'rarity' => $card['rarityLabel'] ?? $card['rarity'] ?? '',
            'price' => $price,
        ],
        'message' => sprintf(
            'You won %s (≈%.2f coins value)!',
            $card['name'] ?? 'a card',
            $price
        ),
    ];
}

function grantCard(PDO $pdo, int $userId, array $card): void
{
    $cardId = $card['id'] ?? null;
    if (!$cardId) {
        return;
    }

    $stmt = $pdo->prepare('SELECT card_amount FROM user_cards WHERE user_id = ? AND card_id = ?');
    $stmt->execute([$userId, $cardId]);
    $row = $stmt->fetch();

    if ($row) {
        $stmt = $pdo->prepare('UPDATE user_cards SET card_amount = card_amount + 1 WHERE user_id = ? AND card_id = ?');
        $stmt->execute([$userId, $cardId]);
    } else {
        $stmt = $pdo->prepare('INSERT INTO user_cards (user_id, card_id, card_amount) VALUES (?, ?, 1)');
        $stmt->execute([$userId, $cardId]);
    }
}

function grantSpecificShopPack(PDO $pdo, int $userId, array $pick): array
{
    $setId = (string) ($pick['id'] ?? 'sv1');
    $setName = (string) ($pick['name'] ?? 'Shop pack');

    $stmt = $pdo->query('SHOW COLUMNS FROM user_packs');
    $columns = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'Field');

    $insertColumns = ['user_id'];
    $insertValues = [$userId];
    $placeholders = ['?'];

    if (in_array('pack_uuid', $columns, true)) {
        $insertColumns[] = 'pack_uuid';
        $insertValues[] = uniqid('wheel_', true);
        $placeholders[] = '?';
    }
    if (in_array('set_id', $columns, true)) {
        $insertColumns[] = 'set_id';
        $insertValues[] = $setId;
        $placeholders[] = '?';
    }
    if (in_array('tcgdex_set_id', $columns, true)) {
        $insertColumns[] = 'tcgdex_set_id';
        $insertValues[] = $setId;
        $placeholders[] = '?';
    }
    if (in_array('set_name', $columns, true)) {
        $insertColumns[] = 'set_name';
        $insertValues[] = $setName;
        $placeholders[] = '?';
    }

    $stmt = $pdo->prepare('
        INSERT INTO user_packs (' . implode(', ', $insertColumns) . ')
        VALUES (' . implode(', ', $placeholders) . ')
    ');
    $stmt->execute($insertValues);

    return [
        'type' => 'pack',
        'pack' => [
            'setId' => $setId,
            'name' => $setName,
            'image' => $pick['photo'] ?? null,
            'shopPrice' => round((float) ($pick['price'] ?? 0), 2),
        ],
        'message' => "Shop pack \"{$setName}\" added to your inventory!",
        'bigWin' => true,
    ];
}

function grantShopPack(PDO $pdo, int $userId, bool $preferExpensive = false): array
{
    $packs = getShopPacks($pdo);
    if (!$packs) {
        $packs = [['id' => 'sv1', 'name' => 'Bonus pack', 'photo' => null, 'price' => 0]];
    }

    if ($preferExpensive) {
        usort($packs, fn($a, $b) => (float) ($b['price'] ?? 0) <=> (float) ($a['price'] ?? 0));
        $pick = $packs[0];
    } else {
        $pick = $packs[random_int(0, count($packs) - 1)];
    }

    return grantSpecificShopPack($pdo, $userId, $pick);
}

function applySegmentReward(PDO $pdo, int $userId, array $segment, array $cardPool): array
{
    $type = $segment['type'];

    if ($type === 'nothing') {
        return ['type' => 'nothing', 'message' => 'No prize this time.'];
    }

    if ($type === 'coins') {
        $amount = round((float) ($segment['amount'] ?? 0), 2);
        $stmt = $pdo->prepare('UPDATE users SET user_coins = user_coins + ? WHERE id = ?');
        $stmt->execute([$amount, $userId]);
        return ['type' => 'coins', 'amount' => $amount, 'message' => "+{$amount} coins"];
    }

    if ($type === 'coins_range') {
        $amount = pickCoinsInRange(
            (float) ($segment['min'] ?? 5),
            (float) ($segment['max'] ?? 100)
        );
        $stmt = $pdo->prepare('UPDATE users SET user_coins = user_coins + ? WHERE id = ?');
        $stmt->execute([$amount, $userId]);
        return ['type' => 'coins', 'amount' => $amount, 'message' => "+{$amount} coins"];
    }

    if ($type === 'tickets') {
        $amount = (int) ($segment['amount'] ?? 1);
        $stmt = $pdo->prepare('UPDATE users SET wheel_tickets = wheel_tickets + ? WHERE id = ?');
        $stmt->execute([$amount, $userId]);
        return ['type' => 'tickets', 'amount' => $amount, 'message' => "+{$amount} ticket(s)"];
    }

    if ($type === 'card_fixed') {
        $card = $segment['card'] ?? pickCardByPriceRange($cardPool, 1, 75, false);
        grantCard($pdo, $userId, $card);
        $reward = cardRewardPayload($card);
        if (!empty($segment['bigWin']) || cardPriceValue($card) >= 200) {
            $reward['type'] = cardPriceValue($card) >= 200 ? 'card_premium' : 'card';
            $reward['bigWin'] = true;
            if (cardPriceValue($card) >= 200) {
                $reward['message'] = sprintf(
                    'MEGA WIN! %s (%s coins value)!',
                    $card['name'] ?? 'Card',
                    wheelFormatPrice(cardPriceValue($card))
                );
            }
        }
        return $reward;
    }

    if ($type === 'shop_pack_fixed') {
        $pack = $segment['pack'] ?? null;
        if (!is_array($pack)) {
            return grantShopPack($pdo, $userId, false);
        }
        return grantSpecificShopPack($pdo, $userId, $pack);
    }

    return ['type' => 'nothing', 'message' => 'No prize'];
}

function getWheelState(PDO $pdo): void
{
    $userId = requireWheelLogin();
    if ($userId === null) {
        return;
    }

    $stmt = $pdo->prepare('SELECT user_coins, wheel_tickets FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user) {
        echo json_encode(['success' => false, 'message' => 'User not found']);
        return;
    }

    echo json_encode([
        'success' => true,
        'segments' => segmentsForClient($pdo),
        'coins' => round((float) $user['user_coins'], 2),
        'tickets' => (int) $user['wheel_tickets'],
        'spinCostCoins' => wheelSpinCostCoins(),
        'spinCostTickets' => wheelSpinCostTickets(),
    ]);
}

function spinWheel(PDO $pdo): void
{
    $userId = requireWheelLogin();
    if ($userId === null) {
        return;
    }

    $input = readWheelJsonBody();
    $payment = strtolower(trim((string) ($input['payment'] ?? 'coins')));

    if (!in_array($payment, ['coins', 'ticket'], true)) {
        echo json_encode(['success' => false, 'message' => 'Invalid payment type']);
        return;
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT user_coins, wheel_tickets FROM users WHERE id = ? FOR UPDATE');
        $stmt->execute([$userId]);
        $user = $stmt->fetch();

        if (!$user) {
            $pdo->rollBack();
            echo json_encode(['success' => false, 'message' => 'User not found']);
            return;
        }

        if ($payment === 'ticket') {
            if ((int) $user['wheel_tickets'] < wheelSpinCostTickets()) {
                $pdo->rollBack();
                echo json_encode(['success' => false, 'message' => 'Not enough tickets']);
                return;
            }
            $stmt = $pdo->prepare('UPDATE users SET wheel_tickets = wheel_tickets - ? WHERE id = ?');
            $stmt->execute([wheelSpinCostTickets(), $userId]);
        } else {
            $balance = (float) $user['user_coins'];
            if ($balance < wheelSpinCostCoins()) {
                $pdo->rollBack();
                echo json_encode(['success' => false, 'message' => 'Not enough coins', 'coins' => round($balance, 2)]);
                return;
            }
            $stmt = $pdo->prepare('UPDATE users SET user_coins = user_coins - ? WHERE id = ?');
            $stmt->execute([wheelSpinCostCoins(), $userId]);
        }

        $wheelSegments = getResolvedWheelSegments($pdo);
        $segment = pickWeightedSegment($pdo);
        $wheelIndex = findSegmentWheelIndex($wheelSegments, $segment);
        $cardPool = getWheelCardPool($pdo);
        $reward = applySegmentReward($pdo, $userId, $segment, $cardPool);

        recordUserWager($pdo, $userId, wheelSpinCostCoins());

        $winValue = rewardValueFromPayload($reward);
        if ($winValue > 0) {
            recordUserWin($pdo, $userId, $winValue);
        }

        $stmt = $pdo->prepare('
            INSERT INTO wheel_spins (user_id, segment_id, payment_type, reward_type, reward_json)
            VALUES (?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $userId,
            $segment['id'],
            $payment,
            $reward['type'],
            json_encode($reward),
        ]);

        $stmt = $pdo->prepare('SELECT user_coins, wheel_tickets FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $updated = $stmt->fetch();

        $pdo->commit();

        $bigWin = !empty($segment['bigWin']) || !empty($reward['bigWin'])
            || ($reward['type'] === 'coins' && ($reward['amount'] ?? 0) >= 75)
            || $reward['type'] === 'card_premium'
            || ($reward['type'] === 'card' && cardPriceValue($reward['card'] ?? []) >= 50);

        echo json_encode([
            'success' => true,
            'segmentIndex' => $wheelIndex,
            'segment' => [
                'id' => $segment['id'],
                'label' => $segment['label'],
                'color' => $segment['color'],
            ],
            'reward' => $reward,
            'coins' => round((float) ($updated['user_coins'] ?? 0), 2),
            'tickets' => (int) ($updated['wheel_tickets'] ?? 0),
            'spinCostCoins' => wheelSpinCostCoins(),
            'spinCostTickets' => wheelSpinCostTickets(),
            'bigWin' => $bigWin,
        ]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        echo json_encode(['success' => false, 'message' => 'Spin failed']);
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
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

session_start();
require 'db.php';
require_once __DIR__ . '/crates.php';
require_once __DIR__ . '/leaderboard.php';

$action = $_GET['action'] ?? '';

try {
    ensureWheelTables($pdo);
    ensureWheelUserColumns($pdo);
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Database setup failed']);
    exit;
}

switch ($action) {
    case 'getState':
        getWheelState($pdo);
        break;
    case 'spin':
        spinWheel($pdo);
        break;
    default:
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
        break;
}
