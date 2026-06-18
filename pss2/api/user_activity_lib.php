<?php

function ensureUserActivityColumn(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }

    $stmt = $pdo->query('SHOW COLUMNS FROM users');
    $columns = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'Field');

    if (!in_array('last_active_at', $columns, true)) {
        $pdo->exec('ALTER TABLE users ADD COLUMN last_active_at DATETIME NULL DEFAULT NULL');
        $pdo->exec('ALTER TABLE users ADD INDEX idx_users_last_active (last_active_at)');
    }

    $ready = true;
}

function touchUserActivity(PDO $pdo, int $userId): void
{
    if ($userId <= 0) {
        return;
    }

    ensureUserActivityColumn($pdo);

    if (session_status() === PHP_SESSION_ACTIVE) {
        $now = time();
        $lastTouch = (int) ($_SESSION['activity_touch_at'] ?? 0);
        if ($lastTouch > 0 && ($now - $lastTouch) < 90) {
            return;
        }
        $_SESSION['activity_touch_at'] = $now;
    }

    $stmt = $pdo->prepare('UPDATE users SET last_active_at = NOW() WHERE id = ?');
    $stmt->execute([$userId]);
}

function formatPresenceStatus(?string $lastActiveAt): array
{
    if (!$lastActiveAt) {
        return [
            'status' => 'offline',
            'label' => 'Not active yet',
            'lastActiveAt' => null,
        ];
    }

    $timestamp = strtotime($lastActiveAt);
    if ($timestamp === false) {
        return [
            'status' => 'offline',
            'label' => 'Unknown',
            'lastActiveAt' => null,
        ];
    }

    $diff = max(0, time() - $timestamp);

    if ($diff < 300) {
        return [
            'status' => 'online',
            'label' => 'Online',
            'lastActiveAt' => $lastActiveAt,
        ];
    }

    if ($diff < 3600) {
        $mins = max(1, (int) floor($diff / 60));
        return [
            'status' => 'recent',
            'label' => "Active {$mins} min ago",
            'lastActiveAt' => $lastActiveAt,
        ];
    }

    if ($diff < 86400) {
        $hours = max(1, (int) floor($diff / 3600));
        return [
            'status' => 'away',
            'label' => "Active {$hours} hr ago",
            'lastActiveAt' => $lastActiveAt,
        ];
    }

    if ($diff < 604800) {
        $days = max(1, (int) floor($diff / 86400));
        return [
            'status' => 'offline',
            'label' => "Active {$days} day" . ($days === 1 ? '' : 's') . ' ago',
            'lastActiveAt' => $lastActiveAt,
        ];
    }

    return [
        'status' => 'offline',
        'label' => 'Offline for a while',
        'lastActiveAt' => $lastActiveAt,
    ];
}

function attachPresenceToUserRow(array $row): array
{
    $presence = formatPresenceStatus($row['last_active_at'] ?? null);

    return [
        'id' => (int) ($row['other_id'] ?? $row['userId'] ?? $row['id'] ?? 0),
        'username' => (string) ($row['username'] ?? $row['other_username'] ?? $row['from_username'] ?? $row['to_username'] ?? ''),
        'presence' => $presence,
        'lastActiveAt' => $presence['lastActiveAt'],
    ];
}
