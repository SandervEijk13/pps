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
require_once 'db.php';
require_once __DIR__ . '/user_activity_lib.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

$userId = (int) $_SESSION['user_id'];
touchUserActivity($pdo, $userId);

$stmt = $pdo->prepare('
    SELECT uc.card_id, SUM(uc.card_amount) AS qty,
           COALESCE(MAX(bci.price), 0) AS unit_price
    FROM user_cards uc
    LEFT JOIN battle_crate_items bci ON bci.card_id = uc.card_id
    WHERE uc.user_id = ? AND uc.card_amount > 0
    GROUP BY uc.card_id
');
$stmt->execute([$userId]);

$uniqueCards = 0;
$totalCopies = 0;
$estimatedCoins = 0.0;

foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
    $qty = (int) ($row['qty'] ?? 0);
    if ($qty <= 0) {
        continue;
    }

    $price = (float) ($row['unit_price'] ?? 0);
    if ($price <= 0) {
        $price = 0.5;
    }

    $uniqueCards++;
    $totalCopies += $qty;
    $estimatedCoins += $price * 0.8 * $qty;
}

echo json_encode([
    'success' => true,
    'stats' => [
        'uniqueCards' => $uniqueCards,
        'totalCopies' => $totalCopies,
        'estimatedCoins' => round($estimatedCoins, 2),
    ],
]);
