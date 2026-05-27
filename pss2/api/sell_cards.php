<?php

// ---------------- CORS ----------------
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json");
// ---------------- APP ----------------

session_start();
require 'db.php';

// must be logged in
if (!isset($_SESSION['user_id'])) {
    echo json_encode([
        "success" => false,
        "message" => "Not logged in"
    ]);
    exit;
}

$data = json_decode(file_get_contents("php://input"), true);

$cardId = $data['cardId'] ?? null;
$userId = $_SESSION['user_id'];

if (!$cardId) {
    echo json_encode([
        "success" => false,
        "message" => "No card ID provided"
    ]);
    exit;
}

// check ownership
$stmt = $pdo->prepare("
    SELECT card_amount
    FROM user_cards
    WHERE user_id = ? AND card_id = ?
");

$stmt->execute([$userId, $cardId]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$row || $row['card_amount'] <= 0) {
    echo json_encode([
        "success" => false,
        "message" => "You don't own this card"
    ]);
    exit;
}

// decrease amount
$stmt = $pdo->prepare("
    UPDATE user_cards
    SET card_amount = card_amount - 1
    WHERE user_id = ? AND card_id = ?
");

$stmt->execute([$userId, $cardId]);

// remove row if 0
$stmt = $pdo->prepare("
    DELETE FROM user_cards
    WHERE user_id = ? AND card_id = ? AND card_amount <= 0
");

$stmt->execute([$userId, $cardId]);

echo json_encode([
    "success" => true,
    "message" => "Card sold"
]);