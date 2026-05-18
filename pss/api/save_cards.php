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

try {

    // DEBUG SESSION
    if (!isset($_SESSION['user_id'])) {
        echo json_encode([
            'status' => 'error',
            'message' => 'Session missing',
            'session' => $_SESSION
        ]);
        exit;
    }

    // GET RAW BODY
    $raw = file_get_contents("php://input");

    // DEBUG RAW INPUT
    if (!$raw) {
        echo json_encode([
            'status' => 'error',
            'message' => 'No raw input'
        ]);
        exit;
    }

    $data = json_decode($raw);

    // DEBUG JSON
    if (!$data) {
        echo json_encode([
            'status' => 'error',
            'message' => 'Invalid JSON',
            'raw' => $raw
        ]);
        exit;
    }

    $user_id = $_SESSION['user_id'];

    if (!isset($data->cardId)) {
        echo json_encode([
            'status' => 'error',
            'message' => 'Invalid or missing card_id'
        ]);
        exit;
    }

    $card_id = (string) $data->cardId;

    $sql = "
        INSERT INTO user_cards (user_id, card_id, card_amount)
        VALUES (:user_id, :card_id, 1)
        ON DUPLICATE KEY UPDATE
        card_amount = card_amount + 1
    ";

    $stmt = $pdo->prepare($sql);

    $success = $stmt->execute([
        ':user_id' => $user_id,
        ':card_id' => $card_id
    ]);

    echo json_encode([
        'status' => 'success',
        'success' => $success,
        'received' => $data
    ]);
} catch (PDOException $e) {

    echo json_encode([
        'status' => 'db_error',
        'message' => $e->getMessage()
    ]);
} catch (Exception $e) {

    echo json_encode([
        'status' => 'general_error',
        'message' => $e->getMessage()
    ]);
}
