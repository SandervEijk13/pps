<?php

function ensureProfileFeatureTables(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_period_metrics (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            period_type ENUM('daily','weekly') NOT NULL,
            period_key VARCHAR(16) NOT NULL,
            baseline_total_cards INT NOT NULL DEFAULT 0,
            baseline_unique_cards INT NOT NULL DEFAULT 0,
            baseline_battles_won INT NOT NULL DEFAULT 0,
            baseline_completed_trades INT NOT NULL DEFAULT 0,
            baseline_total_wagered DECIMAL(14,2) NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_period_metrics (user_id, period_type, period_key),
            CONSTRAINT fk_period_metrics_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_quest_claims (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            period_type ENUM('daily','weekly') NOT NULL,
            period_key VARCHAR(16) NOT NULL,
            quest_key VARCHAR(64) NOT NULL,
            reward_coins DECIMAL(10,2) NOT NULL DEFAULT 0,
            claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_quest_claim (user_id, period_type, period_key, quest_key),
            CONSTRAINT fk_quest_claim_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_milestone_claims (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            milestone_key VARCHAR(64) NOT NULL,
            reward_coins DECIMAL(10,2) NOT NULL DEFAULT 0,
            claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_milestone_claim (user_id, milestone_key),
            CONSTRAINT fk_milestone_claim_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $ready = true;
}

function getCurrentUserMetrics(PDO $pdo, int $userId): array
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
    $trades = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

    return [
        'total_cards' => (int) ($cards['total_cards'] ?? 0),
        'unique_cards' => (int) ($cards['unique_cards'] ?? 0),
        'battles_won' => (int) ($user['battles_won'] ?? 0),
        'total_wagered' => (float) ($user['total_wagered'] ?? 0),
        'completed_trades' => (int) ($trades['completed_trades'] ?? 0),
    ];
}

function buildPeriodKey(string $periodType): string
{
    $now = new DateTimeImmutable('now');
    if ($periodType === 'daily') {
        return $now->format('Y-m-d');
    }
    return $now->format('o-\WW');
}

function getOrCreatePeriodBaseline(PDO $pdo, int $userId, string $periodType, string $periodKey, array $metrics): array
{
    $stmt = $pdo->prepare("
        SELECT *
        FROM user_period_metrics
        WHERE user_id = ? AND period_type = ? AND period_key = ?
        LIMIT 1
    ");
    $stmt->execute([$userId, $periodType, $periodKey]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row) {
        return $row;
    }

    $stmt = $pdo->prepare("
        INSERT INTO user_period_metrics (
            user_id, period_type, period_key,
            baseline_total_cards, baseline_unique_cards, baseline_battles_won,
            baseline_completed_trades, baseline_total_wagered
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $userId,
        $periodType,
        $periodKey,
        $metrics['total_cards'],
        $metrics['unique_cards'],
        $metrics['battles_won'],
        $metrics['completed_trades'],
        round($metrics['total_wagered'], 2),
    ]);

    $stmt->execute([$userId, $periodType, $periodKey]);
    return $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
}

function questDefinitions(): array
{
    return [
        'daily' => [
            ['key' => 'daily_unique_cards_3', 'label' => 'Collect 3 unique cards', 'metric' => 'unique_cards', 'target' => 3, 'reward' => 25],
            ['key' => 'daily_battles_1', 'label' => 'Win 1 battle', 'metric' => 'battles_won', 'target' => 1, 'reward' => 20],
            ['key' => 'daily_trade_1', 'label' => 'Complete 1 trade', 'metric' => 'completed_trades', 'target' => 1, 'reward' => 20],
            ['key' => 'daily_wager_200', 'label' => 'Wager 200 coins', 'metric' => 'total_wagered', 'target' => 200, 'reward' => 30],
        ],
        'weekly' => [
            ['key' => 'weekly_unique_cards_15', 'label' => 'Collect 15 unique cards', 'metric' => 'unique_cards', 'target' => 15, 'reward' => 120],
            ['key' => 'weekly_battles_8', 'label' => 'Win 8 battles', 'metric' => 'battles_won', 'target' => 8, 'reward' => 100],
            ['key' => 'weekly_trade_5', 'label' => 'Complete 5 trades', 'metric' => 'completed_trades', 'target' => 5, 'reward' => 110],
            ['key' => 'weekly_wager_1500', 'label' => 'Wager 1500 coins', 'metric' => 'total_wagered', 'target' => 1500, 'reward' => 150],
        ],
    ];
}

function milestoneDefinitions(): array
{
    return [
        ['key' => 'milestone_unique_25', 'label' => '25 unique cards', 'metric' => 'unique_cards', 'target' => 25, 'reward' => 60],
        ['key' => 'milestone_unique_50', 'label' => '50 unique cards', 'metric' => 'unique_cards', 'target' => 50, 'reward' => 120],
        ['key' => 'milestone_unique_100', 'label' => '100 unique cards', 'metric' => 'unique_cards', 'target' => 100, 'reward' => 250],
        ['key' => 'milestone_total_250', 'label' => '250 total cards', 'metric' => 'total_cards', 'target' => 250, 'reward' => 150],
        ['key' => 'milestone_total_500', 'label' => '500 total cards', 'metric' => 'total_cards', 'target' => 500, 'reward' => 320],
    ];
}

function buildQuestPayload(PDO $pdo, int $userId, string $periodType, array $metrics): array
{
    $periodKey = buildPeriodKey($periodType);
    $baseline = getOrCreatePeriodBaseline($pdo, $userId, $periodType, $periodKey, $metrics);
    $definitions = questDefinitions()[$periodType] ?? [];

    $stmt = $pdo->prepare("
        SELECT quest_key
        FROM user_quest_claims
        WHERE user_id = ? AND period_type = ? AND period_key = ?
    ");
    $stmt->execute([$userId, $periodType, $periodKey]);
    $claimed = array_flip(array_map('strval', $stmt->fetchAll(PDO::FETCH_COLUMN) ?: []));

    $list = [];
    foreach ($definitions as $def) {
        $metric = $def['metric'];
        $baselineValue = (float) ($baseline['baseline_' . $metric] ?? 0);
        $currentValue = (float) ($metrics[$metric] ?? 0);
        $progress = max(0, $currentValue - $baselineValue);
        $target = (float) $def['target'];
        $completed = $progress >= $target;
        $isClaimed = isset($claimed[$def['key']]);

        $list[] = [
            'key' => $def['key'],
            'label' => $def['label'],
            'progress' => round($progress, 2),
            'target' => $target,
            'reward' => (float) $def['reward'],
            'completed' => $completed,
            'claimed' => $isClaimed,
        ];
    }

    return ['periodKey' => $periodKey, 'quests' => $list];
}

function buildMilestonePayload(PDO $pdo, int $userId, array $metrics): array
{
    $defs = milestoneDefinitions();
    $stmt = $pdo->prepare("SELECT milestone_key FROM user_milestone_claims WHERE user_id = ?");
    $stmt->execute([$userId]);
    $claimed = array_flip(array_map('strval', $stmt->fetchAll(PDO::FETCH_COLUMN) ?: []));

    $list = [];
    foreach ($defs as $def) {
        $value = (float) ($metrics[$def['metric']] ?? 0);
        $list[] = [
            'key' => $def['key'],
            'label' => $def['label'],
            'metric' => $def['metric'],
            'current' => round($value, 2),
            'target' => (float) $def['target'],
            'reward' => (float) $def['reward'],
            'completed' => $value >= (float) $def['target'],
            'claimed' => isset($claimed[$def['key']]),
        ];
    }

    return $list;
}

function computeTradeReputation(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare("
        SELECT status, COUNT(*) AS c
        FROM trades
        WHERE initiator_id = ? OR receiver_id = ?
        GROUP BY status
    ");
    $stmt->execute([$userId, $userId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $counts = ['completed' => 0, 'declined' => 0, 'cancelled' => 0, 'pending' => 0, 'negotiating' => 0];
    foreach ($rows as $row) {
        $status = (string) ($row['status'] ?? '');
        if (isset($counts[$status])) {
            $counts[$status] = (int) $row['c'];
        }
    }

    $score = 50 + ($counts['completed'] * 4) - ($counts['declined'] * 2) - ($counts['cancelled'] * 3);
    $score = max(0, min(100, $score));
    $tier = $score >= 85 ? 'Trusted' : ($score >= 65 ? 'Reliable' : ($score >= 40 ? 'Neutral' : 'Risky'));

    return [
        'score' => $score,
        'tier' => $tier,
        'completed' => $counts['completed'],
        'declined' => $counts['declined'],
        'cancelled' => $counts['cancelled'],
        'active' => $counts['pending'] + $counts['negotiating'],
    ];
}
