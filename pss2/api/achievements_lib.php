<?php

function ensureAchievementTables(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_achievements (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            achievement_key VARCHAR(64) NOT NULL,
            unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_user_achievement (user_id, achievement_key),
            KEY idx_user_achievement_user (user_id, unlocked_at),
            CONSTRAINT fk_user_achievement_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $stmt = $pdo->query('SHOW COLUMNS FROM users');
    $columns = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'Field');
    if (!in_array('active_title_key', $columns, true)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN active_title_key VARCHAR(64) NULL DEFAULT NULL");
    }

    $ready = true;
}

function achievementDefinitions(): array
{
    return [
        [
            'key' => 'collector_100',
            'name' => 'Card Hoarder',
            'title' => 'Card Hoarder',
            'icon' => 'fa-layer-group',
            'description' => 'Collect 100 cards in total.',
            'check' => static fn(array $m): bool => $m['total_cards'] >= 100,
        ],
        [
            'key' => 'unique_50',
            'name' => 'Set Builder',
            'title' => 'Set Builder',
            'icon' => 'fa-shapes',
            'description' => 'Collect 50 unique cards.',
            'check' => static fn(array $m): bool => $m['unique_cards'] >= 50,
        ],
        [
            'key' => 'trade_master_5',
            'name' => 'Trade Master',
            'title' => 'Trade Master',
            'icon' => 'fa-right-left',
            'description' => 'Complete 5 trades.',
            'check' => static fn(array $m): bool => $m['completed_trades'] >= 5,
        ],
        [
            'key' => 'arena_10',
            'name' => 'Arena Fighter',
            'title' => 'Arena Fighter',
            'icon' => 'fa-bolt',
            'description' => 'Win 10 battles.',
            'check' => static fn(array $m): bool => $m['battles_won'] >= 10,
        ],
        [
            'key' => 'high_roller_1000',
            'name' => 'High Roller',
            'title' => 'High Roller',
            'icon' => 'fa-coins',
            'description' => 'Wager 1,000 coins.',
            'check' => static fn(array $m): bool => $m['total_wagered'] >= 1000,
        ],
        [
            'key' => 'level_10',
            'name' => 'Elite Trainer',
            'title' => 'Elite Trainer',
            'icon' => 'fa-crown',
            'description' => 'Reach trainer level 10.',
            'check' => static fn(array $m): bool => $m['level'] >= 10,
        ],
    ];
}

function fetchAchievementMetrics(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare("
        SELECT
            COALESCE(SUM(card_amount), 0) AS total_cards,
            COUNT(DISTINCT card_id) AS unique_cards
        FROM user_cards
        WHERE user_id = ?
    ");
    $stmt->execute([$userId]);
    $cards = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

    $stmt = $pdo->prepare("
        SELECT
            COALESCE(user_level, 1) AS user_level,
            COALESCE(battles_won, 0) AS battles_won,
            COALESCE(total_wagered, 0) AS total_wagered
        FROM users
        WHERE id = ?
        LIMIT 1
    ");
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

    $stmt = $pdo->prepare("
        SELECT COUNT(*) AS completed_trades
        FROM trades
        WHERE status = 'completed'
          AND (initiator_id = ? OR receiver_id = ?)
    ");
    $stmt->execute([$userId, $userId]);
    $tradeRow = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

    return [
        'total_cards' => (int) ($cards['total_cards'] ?? 0),
        'unique_cards' => (int) ($cards['unique_cards'] ?? 0),
        'level' => (int) ($user['user_level'] ?? 1),
        'battles_won' => (int) ($user['battles_won'] ?? 0),
        'total_wagered' => (float) ($user['total_wagered'] ?? 0),
        'completed_trades' => (int) ($tradeRow['completed_trades'] ?? 0),
    ];
}

function unlockEligibleAchievements(PDO $pdo, int $userId): void
{
    $definitions = achievementDefinitions();
    $metrics = fetchAchievementMetrics($pdo, $userId);

    foreach ($definitions as $achievement) {
        $check = $achievement['check'];
        if (!$check($metrics)) {
            continue;
        }

        $stmt = $pdo->prepare("
            INSERT IGNORE INTO user_achievements (user_id, achievement_key)
            VALUES (?, ?)
        ");
        $stmt->execute([$userId, $achievement['key']]);
    }
}

function getUserAchievementsPayload(PDO $pdo, int $userId): array
{
    unlockEligibleAchievements($pdo, $userId);
    $definitions = achievementDefinitions();
    $definitionByKey = [];
    foreach ($definitions as $definition) {
        $definitionByKey[$definition['key']] = $definition;
    }

    $stmt = $pdo->prepare("
        SELECT ua.achievement_key, ua.unlocked_at, u.active_title_key
        FROM user_achievements ua
        JOIN users u ON u.id = ua.user_id
        WHERE ua.user_id = ?
        ORDER BY ua.unlocked_at DESC
    ");
    $stmt->execute([$userId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $activeTitleKey = null;
    $achievements = [];
    foreach ($rows as $row) {
        $key = (string) ($row['achievement_key'] ?? '');
        if (!isset($definitionByKey[$key])) {
            continue;
        }
        $def = $definitionByKey[$key];
        $activeTitleKey = $activeTitleKey ?? ($row['active_title_key'] ?? null);
        $achievements[] = [
            'key' => $def['key'],
            'name' => $def['name'],
            'title' => $def['title'],
            'icon' => $def['icon'],
            'description' => $def['description'],
            'unlockedAt' => $row['unlocked_at'],
            'isActive' => ($row['active_title_key'] ?? null) === $def['key'],
        ];
    }

    if ($activeTitleKey === null && !empty($achievements)) {
        $activeTitleKey = $achievements[0]['key'];
        $stmt = $pdo->prepare("UPDATE users SET active_title_key = ? WHERE id = ?");
        $stmt->execute([$activeTitleKey, $userId]);
        foreach ($achievements as &$achievement) {
            $achievement['isActive'] = $achievement['key'] === $activeTitleKey;
        }
        unset($achievement);
    }

    return [
        'activeTitleKey' => $activeTitleKey,
        'achievements' => $achievements,
    ];
}
