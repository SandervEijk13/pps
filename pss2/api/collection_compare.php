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

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

$viewerId = (int) $_SESSION['user_id'];
$targetId = (int) ($_GET['userId'] ?? $_GET['id'] ?? 0);

if ($targetId <= 0) {
    echo json_encode(['success' => false, 'message' => 'Missing user id']);
    exit;
}

if ($targetId === $viewerId) {
    echo json_encode(['success' => false, 'message' => 'Cannot compare with yourself']);
    exit;
}

$userStmt = $pdo->prepare('SELECT id, username FROM users WHERE id = ? LIMIT 1');
$userStmt->execute([$targetId]);
$targetUser = $userStmt->fetch(PDO::FETCH_ASSOC);
if (!$targetUser) {
    echo json_encode(['success' => false, 'message' => 'User not found']);
    exit;
}

function fetchUniqueCardIds(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare('
        SELECT DISTINCT card_id
        FROM user_cards
        WHERE user_id = ? AND card_amount > 0
    ');
    $stmt->execute([$userId]);
    $ids = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $id = (string) ($row['card_id'] ?? '');
        if ($id !== '') {
            $ids[$id] = true;
        }
    }
    return $ids;
}

$viewerCards = fetchUniqueCardIds($pdo, $viewerId);
$targetCards = fetchUniqueCardIds($pdo, $targetId);

$shared = 0;
$viewerOnly = 0;
$targetOnly = 0;

foreach ($viewerCards as $cardId => $_) {
    if (isset($targetCards[$cardId])) {
        $shared++;
    } else {
        $viewerOnly++;
    }
}

foreach ($targetCards as $cardId => $_) {
    if (!isset($viewerCards[$cardId])) {
        $targetOnly++;
    }
}

echo json_encode([
    'success' => true,
    'target' => [
        'id' => (int) $targetUser['id'],
        'username' => (string) $targetUser['username'],
    ],
    'comparison' => [
        'shared' => $shared,
        'viewerOnly' => $viewerOnly,
        'targetOnly' => $targetOnly,
        'viewerTotal' => count($viewerCards),
        'targetTotal' => count($targetCards),
    ],
]);
