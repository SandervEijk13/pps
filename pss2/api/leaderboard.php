<?php

function ensureLeaderboardColumns(PDO $pdo): void
{
    $stmt = $pdo->query('SHOW COLUMNS FROM users');
    $columns = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'Field');

    if (!in_array('total_wagered', $columns, true)) {
        $pdo->exec('ALTER TABLE users ADD COLUMN total_wagered DECIMAL(14,2) NOT NULL DEFAULT 0');
    }
    if (!in_array('biggest_win', $columns, true)) {
        $pdo->exec('ALTER TABLE users ADD COLUMN biggest_win DECIMAL(14,2) NOT NULL DEFAULT 0');
    }
}

function recordUserWager(PDO $pdo, int $userId, float $amount, int $coinsPerTicket = 10): void
{
    $amount = round(max(0, $amount), 2);
    if ($userId <= 0 || $amount <= 0) {
        return;
    }

    $stmt = $pdo->prepare('UPDATE users SET total_wagered = total_wagered + ? WHERE id = ?');
    $stmt->execute([$amount, $userId]);

    require_once __DIR__ . '/progression.php';
    progressionOnWager($pdo, $userId, $amount, $coinsPerTicket);
}

function recordUserWin(PDO $pdo, int $userId, float $amount): void
{
    $amount = round(max(0, $amount), 2);
    if ($userId <= 0 || $amount <= 0) {
        return;
    }

    $stmt = $pdo->prepare('
        UPDATE users
        SET biggest_win = GREATEST(biggest_win, ?)
        WHERE id = ?
    ');
    $stmt->execute([$amount, $userId]);

    require_once __DIR__ . '/progression.php';
    progressionOnWin($pdo, $userId);
}

function rewardValueFromPayload(array $reward): float
{
    $type = (string) ($reward['type'] ?? '');

    if ($type === 'coins') {
        return round((float) ($reward['amount'] ?? 0), 2);
    }

    if ($type === 'card' || $type === 'card_premium') {
        $card = $reward['card'] ?? [];
        return round(max(0, (float) ($card['price'] ?? 0)), 2);
    }

    if ($type === 'shop_pack' || $type === 'pack') {
        $pack = $reward['pack'] ?? $reward;
        return round(max(0, (float) ($pack['price'] ?? 0)), 2);
    }

    if ($type === 'tickets') {
        return round(max(0, (int) ($reward['amount'] ?? 1)) * 50, 2);
    }

    return 0.0;
}

function getCardPriceLookupSql(): string
{
    return "
        SELECT card_id, MAX(price) AS price
        FROM battle_crate_items
        WHERE price IS NOT NULL AND price > 0
        GROUP BY card_id
    ";
}

function fetchLeaderboard(PDO $pdo, string $type, int $limit = 50): array
{
    ensureLeaderboardColumns($pdo);
    $limit = max(1, min(100, $limit));

    switch ($type) {
        case 'coins':
            $sql = "
                SELECT id, username, ROUND(user_coins, 2) AS value
                FROM users
                ORDER BY user_coins DESC, id ASC
                LIMIT {$limit}
            ";
            break;

        case 'wagered':
            $sql = "
                SELECT id, username, ROUND(total_wagered, 2) AS value
                FROM users
                WHERE total_wagered > 0
                ORDER BY total_wagered DESC, id ASC
                LIMIT {$limit}
            ";
            break;

        case 'biggest_win':
            $sql = "
                SELECT id, username, ROUND(biggest_win, 2) AS value
                FROM users
                WHERE biggest_win > 0
                ORDER BY biggest_win DESC, id ASC
                LIMIT {$limit}
            ";
            break;

        case 'inventory':
            $priceSql = getCardPriceLookupSql();
            $sql = "
                SELECT u.id, u.username,
                    ROUND(COALESCE(SUM(uc.card_amount * COALESCE(cp.price, 0)), 0), 2) AS value
                FROM users u
                LEFT JOIN user_cards uc ON uc.user_id = u.id
                LEFT JOIN ({$priceSql}) cp ON cp.card_id = uc.card_id
                GROUP BY u.id, u.username
                HAVING value > 0
                ORDER BY value DESC, u.id ASC
                LIMIT {$limit}
            ";
            break;

        case 'level':
            $sql = "
                SELECT id, username, COALESCE(user_level, 1) AS value
                FROM users
                WHERE COALESCE(user_level, 1) > 0
                ORDER BY user_level DESC, total_wagered DESC, id ASC
                LIMIT {$limit}
            ";
            break;

        default:
            return [];
    }

    $rows = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);
    $entries = [];
    $rank = 1;

    foreach ($rows as $row) {
        $entries[] = [
            'rank' => $rank++,
            'userId' => (int) $row['id'],
            'username' => (string) ($row['username'] ?? 'Trainer'),
            'value' => round((float) $row['value'], 2),
        ];
    }

    return $entries;
}

function fetchMyLeaderboardRank(PDO $pdo, int $userId, string $type): ?array
{
    if ($userId <= 0) {
        return null;
    }

    ensureLeaderboardColumns($pdo);

    switch ($type) {
        case 'coins':
            $stmt = $pdo->prepare('SELECT ROUND(user_coins, 2) AS value FROM users WHERE id = ?');
            $stmt->execute([$userId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) {
                return null;
            }
            $value = (float) $row['value'];
            $rankStmt = $pdo->prepare('
                SELECT COUNT(*) + 1 AS rank_pos
                FROM users
                WHERE user_coins > ? OR (user_coins = ? AND id < ?)
            ');
            $rankStmt->execute([$value, $value, $userId]);
            break;

        case 'wagered':
            $stmt = $pdo->prepare('SELECT ROUND(total_wagered, 2) AS value FROM users WHERE id = ?');
            $stmt->execute([$userId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) {
                return null;
            }
            $value = (float) $row['value'];
            $rankStmt = $pdo->prepare('
                SELECT COUNT(*) + 1 AS rank_pos
                FROM users
                WHERE total_wagered > ? OR (total_wagered = ? AND id < ?)
            ');
            $rankStmt->execute([$value, $value, $userId]);
            break;

        case 'biggest_win':
            $stmt = $pdo->prepare('SELECT ROUND(biggest_win, 2) AS value FROM users WHERE id = ?');
            $stmt->execute([$userId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) {
                return null;
            }
            $value = (float) $row['value'];
            $rankStmt = $pdo->prepare('
                SELECT COUNT(*) + 1 AS rank_pos
                FROM users
                WHERE biggest_win > ? OR (biggest_win = ? AND id < ?)
            ');
            $rankStmt->execute([$value, $value, $userId]);
            break;

        case 'inventory':
            $priceSql = getCardPriceLookupSql();
            $stmt = $pdo->prepare("
                SELECT ROUND(COALESCE(SUM(uc.card_amount * COALESCE(cp.price, 0)), 0), 2) AS value
                FROM user_cards uc
                LEFT JOIN ({$priceSql}) cp ON cp.card_id = uc.card_id
                WHERE uc.user_id = ?
            ");
            $stmt->execute([$userId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) {
                return null;
            }
            $value = (float) $row['value'];
            $rankStmt = $pdo->prepare("
                SELECT COUNT(*) + 1 AS rank_pos
                FROM (
                    SELECT u.id,
                        COALESCE(SUM(uc.card_amount * COALESCE(cp.price, 0)), 0) AS inv_value
                    FROM users u
                    LEFT JOIN user_cards uc ON uc.user_id = u.id
                    LEFT JOIN ({$priceSql}) cp ON cp.card_id = uc.card_id
                    GROUP BY u.id
                ) ranked
                WHERE inv_value > ? OR (inv_value = ? AND id < ?)
            ");
            $rankStmt->execute([$value, $value, $userId]);
            break;

        case 'level':
            $stmt = $pdo->prepare('SELECT COALESCE(user_level, 1) AS value FROM users WHERE id = ?');
            $stmt->execute([$userId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) {
                return null;
            }
            $value = (int) $row['value'];
            $rankStmt = $pdo->prepare('
                SELECT COUNT(*) + 1 AS rank_pos
                FROM users
                WHERE COALESCE(user_level, 1) > ?
                   OR (COALESCE(user_level, 1) = ? AND total_wagered > (SELECT total_wagered FROM users WHERE id = ?))
                   OR (COALESCE(user_level, 1) = ? AND total_wagered = (SELECT total_wagered FROM users WHERE id = ?) AND id < ?)
            ');
            $rankStmt->execute([$value, $value, $userId, $value, $userId, $userId]);
            break;

        default:
            return null;
    }

    $rankRow = $rankStmt->fetch(PDO::FETCH_ASSOC);

    return [
        'rank' => (int) ($rankRow['rank_pos'] ?? 0),
        'value' => round($value, 2),
    ];
}

function leaderboardTypeMeta(): array
{
    return [
        'coins' => [
            'id' => 'coins',
            'label' => 'Coins',
            'description' => 'Highest coin balance',
            'icon' => 'fa-coins',
        ],
        'inventory' => [
            'id' => 'inventory',
            'label' => 'Inventory worth',
            'description' => 'Total value of owned cards',
            'icon' => 'fa-layer-group',
        ],
        'biggest_win' => [
            'id' => 'biggest_win',
            'label' => 'Biggest win',
            'description' => 'Largest single win recorded',
            'icon' => 'fa-trophy',
        ],
        'wagered' => [
            'id' => 'wagered',
            'label' => 'Total wagered',
            'description' => 'Coins spent on spins, bets & packs',
            'icon' => 'fa-dice',
        ],
        'level' => [
            'id' => 'level',
            'label' => 'Highest level',
            'description' => 'Trainer level from XP and achievements',
            'icon' => 'fa-ranking-star',
        ],
    ];
}

function getLeaderboard(PDO $pdo): void
{
    $type = strtolower(trim((string) ($_GET['type'] ?? 'coins')));
    $meta = leaderboardTypeMeta();

    if (!isset($meta[$type])) {
        echo json_encode(['success' => false, 'message' => 'Invalid leaderboard type']);
        return;
    }

    $limit = (int) ($_GET['limit'] ?? 50);
    $entries = fetchLeaderboard($pdo, $type, $limit);

    $myRank = null;
    if (isset($_SESSION['user_id'])) {
        $myRank = fetchMyLeaderboardRank($pdo, (int) $_SESSION['user_id'], $type);
    }

    echo json_encode([
        'success' => true,
        'type' => $type,
        'meta' => $meta[$type],
        'types' => array_values($meta),
        'entries' => $entries,
        'myRank' => $myRank,
    ]);
}

function runLeaderboardApi(): void
{
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
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Credentials: true');
    header('Content-Type: application/json; charset=utf-8');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        exit(0);
    }

    session_start();
    require __DIR__ . '/db.php';

    $action = $_GET['action'] ?? '';

    try {
        ensureLeaderboardColumns($pdo);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Database setup failed']);
        exit;
    }

    switch ($action) {
        case 'get':
            getLeaderboard($pdo);
            break;
        default:
            echo json_encode(['success' => false, 'message' => 'Invalid action']);
            break;
    }
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === realpath(__FILE__)) {
    runLeaderboardApi();
}
