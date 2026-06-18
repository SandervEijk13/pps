<?php

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin === 'http://localhost:5173' || strpos($origin, 'http://localhost') === 0) {
    header("Access-Control-Allow-Origin: $origin");
}
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

session_start();
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/friends_lib.php';
require_once __DIR__ . '/trades.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

$userId = (int) $_SESSION['user_id'];
$action = $_GET['action'] ?? 'summary';

if ($action !== 'summary') {
    echo json_encode(['success' => false, 'message' => 'Unknown action']);
    exit;
}

ensureFriendTables($pdo);
ensureTradeTables($pdo);

$incomingTrades = [];
$tradeStmt = $pdo->prepare("
    SELECT t.id, t.initiator_id, u.username AS from_username, t.created_at
    FROM trades t
    INNER JOIN users u ON u.id = t.initiator_id
    WHERE t.receiver_id = ?
      AND t.status = 'pending'
    ORDER BY t.created_at DESC
    LIMIT 10
");
$tradeStmt->execute([$userId]);
foreach ($tradeStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
    $incomingTrades[] = [
        'id' => (int) $row['id'],
        'fromUserId' => (int) $row['initiator_id'],
        'fromUsername' => (string) $row['from_username'],
        'createdAt' => $row['created_at'],
        'type' => 'trade',
    ];
}

$incomingFriends = [];
$friendStmt = $pdo->prepare("
    SELECT uf.requested_by AS user_id, u.username, uf.created_at
    FROM user_friends uf
    INNER JOIN users u ON u.id = uf.requested_by
    WHERE uf.status = 'pending'
      AND uf.requested_by <> ?
      AND (uf.user_id = ? OR uf.friend_user_id = ?)
    ORDER BY uf.created_at DESC
    LIMIT 10
");
$friendStmt->execute([$userId, $userId, $userId]);
foreach ($friendStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
    $incomingFriends[] = [
        'userId' => (int) $row['user_id'],
        'username' => (string) $row['username'],
        'createdAt' => $row['created_at'],
        'type' => 'friend',
    ];
}

$tradeCount = count($incomingTrades);
$friendCount = count($incomingFriends);

echo json_encode([
    'success' => true,
    'counts' => [
        'trades' => $tradeCount,
        'friends' => $friendCount,
        'total' => $tradeCount + $friendCount,
    ],
    'trades' => $incomingTrades,
    'friendRequests' => $incomingFriends,
]);
