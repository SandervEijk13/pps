<?php

header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json");


require_once 'db.php';

session_start();

// ---------------- AUTH ----------------

if (!isset($_SESSION['user_id'])) {

    echo json_encode([
        'success' => false,
        'error' => 'Not logged in'
    ]);

    exit;
}

$userId = (int) $_SESSION['user_id'];

// ---------------- FETCH COLLECTION ----------------

try {

    $stmt = $pdo->prepare("
        SELECT 
            card_id
        FROM user_cards
        WHERE user_id = ?
    ");

    $stmt->execute([$userId]);

    $cards = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'data' => $cards
    ]);

} catch (PDOException $e) {

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'error' => 'Database error',
        'details' => $e->getMessage()
    ]);
}
?>