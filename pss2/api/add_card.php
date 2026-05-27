<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

session_start();
require 'db.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode([
        "success" => false,
        "message" => "Not logged in"
    ]);
    exit;
}

$data = json_decode(file_get_contents("php://input"), true) ?: [];
$cardId = $data['cardId'] ?? null;
$userId = (int) $_SESSION['user_id'];

if (!$cardId) {
    echo json_encode([
        "success" => false,
        "message" => "Missing cardId"
    ]);
    exit;
}

try {
    $stmt = $pdo->prepare("
        SELECT card_amount
        FROM user_cards
        WHERE user_id = ? AND card_id = ?
    ");
    $stmt->execute([$userId, $cardId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row) {
        $stmt = $pdo->prepare("
            UPDATE user_cards
            SET card_amount = card_amount + 1
            WHERE user_id = ? AND card_id = ?
        ");
        $stmt->execute([$userId, $cardId]);
        $newAmount = (int) $row['card_amount'] + 1;
    } else {
        $stmt = $pdo->prepare("
            INSERT INTO user_cards (user_id, card_id, card_amount)
            VALUES (?, ?, 1)
        ");
        $stmt->execute([$userId, $cardId]);
        $newAmount = 1;
    }

    echo json_encode([
        "success" => true,
        "cardId" => $cardId,
        "amount" => $newAmount
    ]);
} catch (PDOException $e) {
    echo json_encode([
        "success" => false,
        "message" => "DB error"
    ]);
}

