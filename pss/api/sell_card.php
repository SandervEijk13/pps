<?php
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json");

include 'db.php';
session_start();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if (!isset($_SESSION['user_id'])) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Not logged in'
    ]);
    exit;
}

$raw = file_get_contents("php://input");
$data = json_decode($raw);

if (!$data || !isset($data->cardId)) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Invalid request'
    ]);
    exit;
}

$user_id = $_SESSION['user_id'];
$card_id = (string) $data->cardId;

try {

    // 1. check ownership
    $stmt = $pdo->prepare("
        SELECT card_amount
        FROM user_cards
        WHERE user_id = :user_id AND card_id = :card_id
    ");

    $stmt->execute([
        ':user_id' => $user_id,
        ':card_id' => $card_id
    ]);

    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row || $row['card_amount'] <= 0) {
        echo json_encode([
            'status' => 'error',
            'message' => 'No card to sell'
        ]);
        exit;
    }

    // 💰 price per card (you can replace this later with real pricing)
    $sellValue = 5;

    // 2. decrease card amount
    $stmt = $pdo->prepare("
        UPDATE user_cards
        SET card_amount = card_amount - 1
        WHERE user_id = :user_id AND card_id = :card_id
    ");

    $stmt->execute([
        ':user_id' => $user_id,
        ':card_id' => $card_id
    ]);

    // 3. add balance
    $stmt = $pdo->prepare("
        UPDATE users
        SET balance = balance + :value
        WHERE id = :user_id
    ");

    $stmt->execute([
        ':value' => $sellValue,
        ':user_id' => $user_id
    ]);

    echo json_encode([
        'status' => 'success',
        'sold_for' => $sellValue
    ]);

} catch (PDOException $e) {
    echo json_encode([
        'status' => 'db_error',
        'message' => $e->getMessage()
    ]);
}