<?php
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json");

include 'db.php';
session_start();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if (!isset($_SESSION['user_id'])) {
    echo json_encode([]);
    exit;
}

$user_id = $_SESSION['user_id'];

try {
    $stmt = $pdo->prepare("
        SELECT card_id, card_amount
        FROM user_cards
        WHERE user_id = :user_id
    ");

    $stmt->execute([
        ':user_id' => $user_id
    ]);

    $cards = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($cards);

} catch (PDOException $e) {
    echo json_encode([]);
}