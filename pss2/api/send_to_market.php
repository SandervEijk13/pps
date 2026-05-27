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
    echo json_encode(["success" => false, "message" => "Not logged in"]);
    exit;
}

$data = json_decode(file_get_contents("php://input"), true);
$cardId = $data['cardId'] ?? null;
$userId = $_SESSION['user_id'];

if (!$cardId) {
    echo json_encode(["success" => false, "message" => "No card"]);
    exit;
}

/* CHECK OWNERSHIP */
$stmt = $pdo->prepare("
    SELECT card_amount
    FROM user_cards
    WHERE user_id = ? AND card_id = ?
");

$stmt->execute([$userId, $cardId]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$row || $row['card_amount'] <= 0) {
    echo json_encode(["success" => false, "message" => "You don't own this card"]);
    exit;
}

/* REMOVE 1 FROM INVENTORY */
$stmt = $pdo->prepare("
    UPDATE user_cards
    SET card_amount = card_amount - 1
    WHERE user_id = ? AND card_id = ?
");
$stmt->execute([$userId, $cardId]);

/* CLEAN UP */
$stmt = $pdo->prepare("
    DELETE FROM user_cards
    WHERE user_id = ? AND card_id = ? AND card_amount <= 0
");
$stmt->execute([$userId, $cardId]);

/* ADD TO MARKETPLACE */
$stmt = $pdo->prepare("
    INSERT INTO marketplace (user_id, card_id)
    VALUES (?, ?)
");
$stmt->execute([$userId, $cardId]);

echo json_encode(["success" => true]);