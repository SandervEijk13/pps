<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");

/* HANDLE PREFLIGHT */
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

session_start();

require 'db.php';

/* ENABLE PDO ERRORS */
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

/* CHECK LOGIN */
if (!isset($_SESSION['user_id'])) {

    echo json_encode([
        "success" => false,
        "message" => "Not logged in"
    ]);

    exit;
}

/* GET JSON DATA */
$data = json_decode(file_get_contents("php://input"), true);

/* GET VALUES */
$cardId = $data['cardId'] ?? null;

$price = isset($data['cardprice'])
    ? floatval($data['cardprice'])
    : 0;

$userId = $_SESSION['user_id'];

/* VALIDATE CARD */
if (!$cardId) {

    echo json_encode([
        "success" => false,
        "message" => "No card selected"
    ]);

    exit;
}

try {

    /* START TRANSACTION */
    $pdo->beginTransaction();

    /* CHECK OWNERSHIP */
    $stmt = $pdo->prepare("
        SELECT card_amount
        FROM user_cards
        WHERE user_id = ?
        AND card_id = ?
        FOR UPDATE
    ");

    $stmt->execute([
        $userId,
        $cardId
    ]);

    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    /* USER DOES NOT OWN CARD */
    if (!$row || $row['card_amount'] <= 0) {

        $pdo->rollBack();

        echo json_encode([
            "success" => false,
            "message" => "You don't own this card"
        ]);

        exit;
    }

    /* REMOVE 1 CARD FROM INVENTORY */
    $stmt = $pdo->prepare("
        UPDATE user_cards
        SET card_amount = card_amount - 1
        WHERE user_id = ?
        AND card_id = ?
        AND card_amount > 0
    ");

    $stmt->execute([
        $userId,
        $cardId
    ]);

    /* DELETE EMPTY INVENTORY ROW */
    $stmt = $pdo->prepare("
        DELETE FROM user_cards
        WHERE user_id = ?
        AND card_id = ?
        AND card_amount <= 0
    ");

    $stmt->execute([
        $userId,
        $cardId
    ]);

    /* ADD CARD TO MARKETPLACE */
    $stmt = $pdo->prepare("
        INSERT INTO marketplace (
            user_id,
            card_id,
            market_price
        )
        VALUES (?, ?, ?)
    ");

    $stmt->execute([
        $userId,
        $cardId,
        $price
    ]);

    /* SUCCESS */
    $pdo->commit();

    echo json_encode([
        "success" => true,
        "message" => "Card listed on marketplace"
    ]);

} catch (Exception $e) {

    /* ROLLBACK ON ERROR */
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    echo json_encode([
        "success" => false,
        "message" => $e->getMessage()
    ]);
}