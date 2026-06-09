<?php

function bootstrapProgressionSchema(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }

    require_once __DIR__ . '/leaderboard.php';
    ensureLeaderboardColumns($pdo);
    ensureProgressionColumns($pdo);
    ensureRaffleTables($pdo);

    $stmt = $pdo->query('SHOW COLUMNS FROM users');
    $cols = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'Field');
    if (!in_array('wheel_tickets', $cols, true)) {
        $pdo->exec('ALTER TABLE users ADD COLUMN wheel_tickets INT NOT NULL DEFAULT 0');
    }

    $ready = true;
}

function ensureProgressionColumns(PDO $pdo): void
{
    $stmt = $pdo->query('SHOW COLUMNS FROM users');
    $columns = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'Field');

    $additions = [
        'user_level' => 'INT NOT NULL DEFAULT 1',
        'win_count' => 'INT NOT NULL DEFAULT 0',
        'upgrader_wins' => 'INT NOT NULL DEFAULT 0',
        'battles_won' => 'INT NOT NULL DEFAULT 0',
        'raffle_wager_carry' => 'DECIMAL(10,2) NOT NULL DEFAULT 0',
    ];

    foreach ($additions as $col => $definition) {
        if (!in_array($col, $columns, true)) {
            $pdo->exec("ALTER TABLE users ADD COLUMN {$col} {$definition}");
        }
    }
}

function ensureRaffleTables(PDO $pdo): void
{
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS raffles (
            id INT AUTO_INCREMENT PRIMARY KEY,
            hour_key VARCHAR(13) NOT NULL,
            prize_type ENUM('coins','wheel_ticket') NOT NULL,
            prize_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
            winner_user_id INT NULL,
            drawn_at DATETIME NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_raffle_hour (hour_key),
            KEY idx_raffle_drawn (drawn_at),
            CONSTRAINT fk_raffle_winner FOREIGN KEY (winner_user_id) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS raffle_entries (
            id INT AUTO_INCREMENT PRIMARY KEY,
            raffle_id INT NOT NULL,
            user_id INT NOT NULL,
            tickets INT NOT NULL DEFAULT 0,
            UNIQUE KEY uq_raffle_user (raffle_id, user_id),
            KEY idx_raffle_entries_user (user_id),
            CONSTRAINT fk_entry_raffle FOREIGN KEY (raffle_id) REFERENCES raffles(id) ON DELETE CASCADE,
            CONSTRAINT fk_entry_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
}

function levelWagerIncrement(int $targetLevel): float
{
    if ($targetLevel < 2) {
        return 0.0;
    }

    return round(500 * pow(1.5, $targetLevel - 2), 2);
}

function cumulativeWagerForLevel(int $level): float
{
    if ($level <= 1) {
        return 0.0;
    }

    $sum = 0.0;
    for ($i = 2; $i <= $level; $i++) {
        $sum += levelWagerIncrement($i);
    }

    return round($sum, 2);
}

function levelTitle(int $level): string
{
    $titles = [
        1 => 'Beginner Trainer',
        2 => 'Rookie Trainer',
        3 => 'Ace Trainer',
        4 => 'Veteran Trainer',
        5 => 'Elite Trainer',
        6 => 'Gym Leader',
        7 => 'Champion',
        8 => 'Master Trainer',
        9 => 'Grand Master',
        10 => 'Legend',
    ];

    if (isset($titles[$level])) {
        return $titles[$level];
    }

    return 'Level ' . $level . ' Trainer';
}

function requirementPool(): array
{
    return [
        [
            'id' => 'biggest_win',
            'base' => 200,
            'scale' => 1.15,
            'label' => 'Grootste enkele winst',
            'icon' => 'fa-trophy',
        ],
        [
            'id' => 'win_count',
            'base' => 3,
            'scale' => 1.25,
            'label' => 'Totaal aantal wins',
            'icon' => 'fa-star',
        ],
        [
            'id' => 'inventory_worth',
            'base' => 250,
            'scale' => 1.2,
            'label' => 'Inventaris waarde',
            'icon' => 'fa-layer-group',
        ],
        [
            'id' => 'upgrader_wins',
            'base' => 2,
            'scale' => 1.2,
            'label' => 'Upgrader overwinningen',
            'icon' => 'fa-arrow-up',
        ],
        [
            'id' => 'battles_won',
            'base' => 1,
            'scale' => 1.3,
            'label' => 'Battles gewonnen',
            'icon' => 'fa-bolt',
        ],
    ];
}

function getMaxCardPrice(PDO $pdo): float
{
    $row = $pdo->query('
        SELECT MAX(price) AS max_price
        FROM battle_crate_items
        WHERE price IS NOT NULL AND price > 0
    ')->fetch(PDO::FETCH_ASSOC);

    return round(max(0, (float) ($row['max_price'] ?? 0)), 2);
}

function getInventoryWorth(PDO $pdo, int $userId): float
{
    if ($userId <= 0) {
        return 0.0;
    }

    require_once __DIR__ . '/leaderboard.php';

    $priceSql = getCardPriceLookupSql();
    $stmt = $pdo->prepare("
        SELECT ROUND(COALESCE(SUM(uc.card_amount * COALESCE(cp.price, 0)), 0), 2) AS value
        FROM user_cards uc
        LEFT JOIN ({$priceSql}) cp ON cp.card_id = uc.card_id
        WHERE uc.user_id = ?
    ");
    $stmt->execute([$userId]);

    return round((float) ($stmt->fetchColumn() ?: 0), 2);
}

function requirementValueForLevel(array $template, int $targetLevel, float $maxCardPrice): float
{
    $power = max(0, $targetLevel - 2);
    $raw = $template['base'] * pow($template['scale'], $power);

    if ($template['id'] === 'biggest_win') {
        return round(min($raw, $maxCardPrice), 2);
    }

    if (in_array($template['id'], ['win_count', 'upgrader_wins', 'battles_won'], true)) {
        return (float) max(1, (int) floor($raw));
    }

    return round($raw, 2);
}

function getExtraRequirementsForLevel(int $targetLevel, float $maxCardPrice): array
{
    $pool = requirementPool();
    $count = count($pool);

    $idx1 = ($targetLevel * 2) % $count;
    $idx2 = ($targetLevel * 2 + 3) % $count;
    if ($idx2 === $idx1) {
        $idx2 = ($idx1 + 1) % $count;
    }

    $requirements = [];
    foreach ([$idx1, $idx2] as $idx) {
        $template = $pool[$idx];
        $requirements[] = [
            'type' => $template['id'],
            'label' => $template['label'],
            'icon' => $template['icon'],
            'required' => requirementValueForLevel($template, $targetLevel, $maxCardPrice),
        ];
    }

    return $requirements;
}

function getUserProgressValues(PDO $pdo, array $userRow): array
{
    $userId = (int) ($userRow['id'] ?? 0);

    return [
        'total_wagered' => round((float) ($userRow['total_wagered'] ?? 0), 2),
        'biggest_win' => round((float) ($userRow['biggest_win'] ?? 0), 2),
        'win_count' => (int) ($userRow['win_count'] ?? 0),
        'upgrader_wins' => (int) ($userRow['upgrader_wins'] ?? 0),
        'battles_won' => (int) ($userRow['battles_won'] ?? 0),
        'inventory_worth' => getInventoryWorth($pdo, $userId),
    ];
}

function meetsLevelRequirements(array $progress, int $targetLevel, float $maxCardPrice): bool
{
    if ($progress['total_wagered'] < cumulativeWagerForLevel($targetLevel)) {
        return false;
    }

    foreach (getExtraRequirementsForLevel($targetLevel, $maxCardPrice) as $req) {
        $current = $progress[$req['type']] ?? 0;
        if ($current < $req['required']) {
            return false;
        }
    }

    return true;
}

function fetchProgressionUserRow(PDO $pdo, int $userId): ?array
{
    $stmt = $pdo->prepare('
        SELECT id, username, user_level, total_wagered, biggest_win,
               win_count, upgrader_wins, battles_won, raffle_wager_carry
        FROM users
        WHERE id = ?
    ');
    $stmt->execute([$userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return $row ?: null;
}

function checkAndApplyLevelUp(PDO $pdo, int $userId): int
{
    if ($userId <= 0) {
        return 1;
    }

    $user = fetchProgressionUserRow($pdo, $userId);
    if (!$user) {
        return 1;
    }

    $maxCardPrice = getMaxCardPrice($pdo);
    $level = (int) $user['user_level'];
    $leveled = 0;

    while (true) {
        $nextLevel = $level + 1;
        $progress = getUserProgressValues($pdo, $user);

        if (!meetsLevelRequirements($progress, $nextLevel, $maxCardPrice)) {
            break;
        }

        $stmt = $pdo->prepare('UPDATE users SET user_level = ? WHERE id = ?');
        $stmt->execute([$nextLevel, $userId]);
        $user['user_level'] = $nextLevel;
        $level = $nextLevel;
        $leveled++;
    }

    return $leveled;
}

function buildRequirementStatus(array $progress, int $targetLevel, float $maxCardPrice): array
{
    $wagerRequired = cumulativeWagerForLevel($targetLevel);
    $wagerCurrent = $progress['total_wagered'];

    $items = [
        [
            'type' => 'total_wagered',
            'label' => 'XP (ingezet)',
            'icon' => 'fa-dice',
            'required' => $wagerRequired,
            'current' => $wagerCurrent,
            'met' => $wagerCurrent >= $wagerRequired,
        ],
    ];

    foreach (getExtraRequirementsForLevel($targetLevel, $maxCardPrice) as $req) {
        $current = $progress[$req['type']] ?? 0;
        $items[] = [
            'type' => $req['type'],
            'label' => $req['label'],
            'icon' => $req['icon'],
            'required' => $req['required'],
            'current' => $current,
            'met' => $current >= $req['required'],
        ];
    }

    return $items;
}

function getLevelStateData(PDO $pdo, int $userId): ?array
{
    $user = fetchProgressionUserRow($pdo, $userId);
    if (!$user) {
        return null;
    }

    checkAndApplyLevelUp($pdo, $userId);
    $user = fetchProgressionUserRow($pdo, $userId);

    $level = (int) $user['user_level'];
    $nextLevel = $level + 1;
    $maxCardPrice = getMaxCardPrice($pdo);
    $progress = getUserProgressValues($pdo, $user);
    $requirements = buildRequirementStatus($progress, $nextLevel, $maxCardPrice);

    $wagerRequired = cumulativeWagerForLevel($nextLevel);
    $wagerCurrent = $progress['total_wagered'];
    $xpProgress = $wagerRequired > 0
        ? min(100, round(($wagerCurrent / $wagerRequired) * 100, 1))
        : 100;

    $allMet = true;
    foreach ($requirements as $req) {
        if (!$req['met']) {
            $allMet = false;
            break;
        }
    }

    return [
        'level' => $level,
        'title' => levelTitle($level),
        'nextLevel' => $nextLevel,
        'nextTitle' => levelTitle($nextLevel),
        'xp' => $wagerCurrent,
        'xpRequired' => $wagerRequired,
        'xpProgress' => $xpProgress,
        'levelIncrement' => levelWagerIncrement($nextLevel),
        'requirements' => $requirements,
        'canLevelUp' => $allMet,
        'maxCardPrice' => $maxCardPrice,
    ];
}

function currentRaffleHourKey(): string
{
    return date('Y-m-d-H');
}

function generateRafflePrize(): array
{
    if (random_int(1, 100) <= 50) {
        return [
            'prize_type' => 'wheel_ticket',
            'prize_amount' => 1,
        ];
    }

    return [
        'prize_type' => 'coins',
        'prize_amount' => (float) random_int(25, 100),
    ];
}

function ensureRaffleForHour(PDO $pdo, string $hourKey): int
{
    $stmt = $pdo->prepare('SELECT id FROM raffles WHERE hour_key = ?');
    $stmt->execute([$hourKey]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($existing) {
        return (int) $existing['id'];
    }

    $prize = generateRafflePrize();
    $stmt = $pdo->prepare('
        INSERT INTO raffles (hour_key, prize_type, prize_amount)
        VALUES (?, ?, ?)
    ');
    $stmt->execute([$hourKey, $prize['prize_type'], $prize['prize_amount']]);

    return (int) $pdo->lastInsertId();
}

function grantRafflePrize(PDO $pdo, int $userId, string $prizeType, float $amount): void
{
    if ($userId <= 0 || $amount <= 0) {
        return;
    }

    if ($prizeType === 'coins') {
        $stmt = $pdo->prepare('UPDATE users SET user_coins = user_coins + ? WHERE id = ?');
        $stmt->execute([$amount, $userId]);
        return;
    }

    if ($prizeType === 'wheel_ticket') {
        $stmt = $pdo->prepare('UPDATE users SET wheel_tickets = wheel_tickets + ? WHERE id = ?');
        $stmt->execute([(int) $amount, $userId]);
    }
}

function drawRaffleWinner(PDO $pdo, int $raffleId): ?array
{
    $stmt = $pdo->prepare('
        SELECT user_id, tickets
        FROM raffle_entries
        WHERE raffle_id = ? AND tickets > 0
    ');
    $stmt->execute([$raffleId]);
    $entries = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (!$entries) {
        return null;
    }

    $totalTickets = 0;
    foreach ($entries as $entry) {
        $totalTickets += (int) $entry['tickets'];
    }

    if ($totalTickets <= 0) {
        return null;
    }

    $pick = random_int(1, $totalTickets);
    $running = 0;

    foreach ($entries as $entry) {
        $running += (int) $entry['tickets'];
        if ($pick <= $running) {
            return [
                'user_id' => (int) $entry['user_id'],
                'tickets' => (int) $entry['tickets'],
                'total_pool' => $totalTickets,
            ];
        }
    }

    return null;
}

function processPendingRaffleDraws(PDO $pdo): array
{
    $currentHour = currentRaffleHourKey();
    $stmt = $pdo->prepare('
        SELECT id, hour_key, prize_type, prize_amount
        FROM raffles
        WHERE winner_user_id IS NULL AND hour_key < ?
        ORDER BY hour_key ASC
    ');
    $stmt->execute([$currentHour]);
    $pending = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $results = [];

    foreach ($pending as $raffle) {
        $winner = drawRaffleWinner($pdo, (int) $raffle['id']);

        if (!$winner) {
            $mark = $pdo->prepare('UPDATE raffles SET drawn_at = NOW() WHERE id = ?');
            $mark->execute([(int) $raffle['id']]);
            continue;
        }

        grantRafflePrize(
            $pdo,
            $winner['user_id'],
            (string) $raffle['prize_type'],
            (float) $raffle['prize_amount']
        );

        $stmt = $pdo->prepare('
            UPDATE raffles
            SET winner_user_id = ?, drawn_at = NOW()
            WHERE id = ?
        ');
        $stmt->execute([$winner['user_id'], (int) $raffle['id']]);

        $userStmt = $pdo->prepare('SELECT username FROM users WHERE id = ?');
        $userStmt->execute([$winner['user_id']]);

        $results[] = [
            'hourKey' => $raffle['hour_key'],
            'winnerId' => $winner['user_id'],
            'winnerName' => (string) ($userStmt->fetchColumn() ?: 'Trainer'),
            'prizeType' => $raffle['prize_type'],
            'prizeAmount' => round((float) $raffle['prize_amount'], 2),
            'winnerTickets' => $winner['tickets'],
            'totalTickets' => $winner['total_pool'],
        ];
    }

    return $results;
}

function addRaffleTickets(PDO $pdo, int $userId, float $wagerAmount): int
{
    $wagerAmount = round(max(0, $wagerAmount), 2);
    if ($userId <= 0 || $wagerAmount <= 0) {
        return 0;
    }

    $stmt = $pdo->prepare('SELECT raffle_wager_carry FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $carry = round((float) ($stmt->fetchColumn() ?: 0), 2);

    $pool = $carry + $wagerAmount;
    $tickets = (int) floor($pool / 10);
    $newCarry = round($pool - ($tickets * 10), 2);

    $stmt = $pdo->prepare('UPDATE users SET raffle_wager_carry = ? WHERE id = ?');
    $stmt->execute([$newCarry, $userId]);

    if ($tickets <= 0) {
        return 0;
    }

    $raffleId = ensureRaffleForHour($pdo, currentRaffleHourKey());

    $stmt = $pdo->prepare('
        INSERT INTO raffle_entries (raffle_id, user_id, tickets)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE tickets = tickets + VALUES(tickets)
    ');
    $stmt->execute([$raffleId, $userId, $tickets]);

    return $tickets;
}

function rafflePrizeLabel(string $type, float $amount): string
{
    if ($type === 'wheel_ticket') {
        return (int) $amount . '× Wheel ticket';
    }

    return number_format($amount, 0, ',', '.') . ' PokéCoins';
}

function secondsUntilNextRaffleHour(): int
{
    $next = strtotime(date('Y-m-d H:00:00', strtotime('+1 hour')));
    return max(0, $next - time());
}

function getRaffleStateData(PDO $pdo, ?int $userId = null): array
{
    processPendingRaffleDraws($pdo);

    $hourKey = currentRaffleHourKey();
    $raffleId = ensureRaffleForHour($pdo, $hourKey);

    $stmt = $pdo->prepare('
        SELECT id, hour_key, prize_type, prize_amount, winner_user_id, drawn_at
        FROM raffles
        WHERE id = ?
    ');
    $stmt->execute([$raffleId]);
    $raffle = $stmt->fetch(PDO::FETCH_ASSOC);

    $poolStmt = $pdo->prepare('
        SELECT COALESCE(SUM(tickets), 0) AS total, COUNT(*) AS entrants
        FROM raffle_entries
        WHERE raffle_id = ?
    ');
    $poolStmt->execute([$raffleId]);
    $pool = $poolStmt->fetch(PDO::FETCH_ASSOC);

    $myTickets = 0;
    $myChance = 0.0;
    $totalTickets = (int) ($pool['total'] ?? 0);

    if ($userId && $userId > 0) {
        $stmt = $pdo->prepare('
            SELECT tickets FROM raffle_entries
            WHERE raffle_id = ? AND user_id = ?
        ');
        $stmt->execute([$raffleId, $userId]);
        $myTickets = (int) ($stmt->fetchColumn() ?: 0);
        if ($totalTickets > 0 && $myTickets > 0) {
            $myChance = round(($myTickets / $totalTickets) * 100, 2);
        }
    }

    $historyStmt = $pdo->query('
        SELECT r.hour_key, r.prize_type, r.prize_amount, r.drawn_at,
               u.id AS winner_id, u.username AS winner_name,
               COALESCE(re.tickets, 0) AS winner_tickets,
               (SELECT COALESCE(SUM(tickets), 0) FROM raffle_entries WHERE raffle_id = r.id) AS total_tickets
        FROM raffles r
        LEFT JOIN users u ON u.id = r.winner_user_id
        LEFT JOIN raffle_entries re ON re.raffle_id = r.id AND re.user_id = r.winner_user_id
        WHERE r.winner_user_id IS NOT NULL
        ORDER BY r.drawn_at DESC
        LIMIT 10
    ');
    $history = [];

    foreach ($historyStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $history[] = [
            'hourKey' => $row['hour_key'],
            'winnerId' => (int) $row['winner_id'],
            'winnerName' => (string) $row['winner_name'],
            'prizeType' => $row['prize_type'],
            'prizeAmount' => round((float) $row['prize_amount'], 2),
            'prizeLabel' => rafflePrizeLabel((string) $row['prize_type'], (float) $row['prize_amount']),
            'winnerTickets' => (int) $row['winner_tickets'],
            'totalTickets' => (int) $row['total_tickets'],
            'drawnAt' => $row['drawn_at'],
        ];
    }

    return [
        'hourKey' => $hourKey,
        'endsInSeconds' => secondsUntilNextRaffleHour(),
        'prizeType' => $raffle['prize_type'],
        'prizeAmount' => round((float) $raffle['prize_amount'], 2),
        'prizeLabel' => rafflePrizeLabel((string) $raffle['prize_type'], (float) $raffle['prize_amount']),
        'totalTickets' => $totalTickets,
        'entrants' => (int) ($pool['entrants'] ?? 0),
        'myTickets' => $myTickets,
        'myChancePercent' => $myChance,
        'ticketRate' => '1 ticket per 10 ingezette coins',
        'history' => $history,
    ];
}

function progressionOnWager(PDO $pdo, int $userId, float $amount): void
{
    addRaffleTickets($pdo, $userId, $amount);
    checkAndApplyLevelUp($pdo, $userId);
}

function progressionOnWin(PDO $pdo, int $userId): void
{
    if ($userId <= 0) {
        return;
    }

    $stmt = $pdo->prepare('UPDATE users SET win_count = win_count + 1 WHERE id = ?');
    $stmt->execute([$userId]);
    checkAndApplyLevelUp($pdo, $userId);
}

function progressionOnUpgraderWin(PDO $pdo, int $userId): void
{
    if ($userId <= 0) {
        return;
    }

    $stmt = $pdo->prepare('UPDATE users SET upgrader_wins = upgrader_wins + 1 WHERE id = ?');
    $stmt->execute([$userId]);
    checkAndApplyLevelUp($pdo, $userId);
}

function progressionOnBattleWin(PDO $pdo, int $userId): void
{
    if ($userId <= 0) {
        return;
    }

    $stmt = $pdo->prepare('UPDATE users SET battles_won = battles_won + 1 WHERE id = ?');
    $stmt->execute([$userId]);
    checkAndApplyLevelUp($pdo, $userId);
}

function getLevelState(PDO $pdo): void
{
    $userId = (int) ($_GET['id'] ?? 0);
    if ($userId <= 0) {
        echo json_encode(['success' => false, 'message' => 'Missing user id']);
        return;
    }

    $state = getLevelStateData($pdo, $userId);
    if (!$state) {
        echo json_encode(['success' => false, 'message' => 'User not found']);
        return;
    }

    echo json_encode(['success' => true, 'level' => $state]);
}

function getRaffleState(PDO $pdo): void
{
    $userId = null;
    if (isset($_SESSION['user_id'])) {
        $userId = (int) $_SESSION['user_id'];
    }

    $requestedId = (int) ($_GET['userId'] ?? 0);
    if ($requestedId > 0) {
        $userId = $requestedId;
    }

    echo json_encode([
        'success' => true,
        'raffle' => getRaffleStateData($pdo, $userId),
    ]);
}

function runProgressionApi(): void
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

    try {
        bootstrapProgressionSchema($pdo);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Database setup failed']);
        exit;
    }

    $action = $_GET['action'] ?? '';

    switch ($action) {
        case 'getLevel':
            getLevelState($pdo);
            break;
        case 'getRaffle':
            getRaffleState($pdo);
            break;
        default:
            echo json_encode(['success' => false, 'message' => 'Invalid action']);
            break;
    }
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === realpath(__FILE__)) {
    runProgressionApi();
}
