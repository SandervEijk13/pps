<?php

function ensureFriendTables(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_friends (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            friend_user_id INT NOT NULL,
            status ENUM('pending','accepted') NOT NULL DEFAULT 'pending',
            requested_by INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_user_friend_pair (user_id, friend_user_id),
            INDEX idx_friends_user (user_id, status),
            INDEX idx_friends_friend (friend_user_id, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $ready = true;
}

function normalizeFriendPair(int $a, int $b): array
{
    return $a < $b ? [$a, $b] : [$b, $a];
}

function fetchFriendRow(PDO $pdo, int $userId, int $friendId): ?array
{
    [$low, $high] = normalizeFriendPair($userId, $friendId);
    $stmt = $pdo->prepare('
        SELECT *
        FROM user_friends
        WHERE user_id = ? AND friend_user_id = ?
        LIMIT 1
    ');
    $stmt->execute([$low, $high]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function formatFriendUser(array $user, string $relation = 'friend'): array
{
    return [
        'id' => (int) $user['id'],
        'username' => (string) $user['username'],
        'relation' => $relation,
    ];
}
