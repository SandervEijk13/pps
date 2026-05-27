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

$data = json_decode(file_get_contents("php://input"), true);

$cardId = $data['cardId'] ?? null;
$sellerId = $data['sellerId'] ?? null;
$buyerId = $_SESSION['user_id'];

if (!$cardId || !$sellerId) {
    echo json_encode([
        "success" => false,
        "message" => "Missing data"
    ]);
    exit;
}

/* ---------------------------
   BLOCK BUYING OWN CARD
----------------------------*/
if ($buyerId == $sellerId) {
    echo json_encode([
        "success" => false,
        "message" => "You cannot buy your own card"
    ]);
    exit;
}

/* ---------------------------
   GET MARKET LISTING
----------------------------*/
$stmt = $pdo->prepare("
    SELECT *
    FROM marketplace
    WHERE user_id = ? AND card_id = ?
    LIMIT 1
");

$stmt->execute([$sellerId, $cardId]);
$listing = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$listing) {
    echo json_encode([
        "success" => false,
        "message" => "Listing not found"
    ]);
    exit;
}

/* ---------------------------
   PRICE
----------------------------*/
$price = $listing['market_price']; // make sure marketplace table has a price column

/* ---------------------------
   CHECK BUYER user_coins
----------------------------*/
$stmt = $pdo->prepare("
    SELECT user_coins
    FROM users
    WHERE id = ?
");

$stmt->execute([$buyerId]);
$buyer = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$buyer || $buyer['user_coins'] < $price) {
    echo json_encode([
        "success" => false,
        "message" => "Not enough balance"
    ]);
    exit;
}

/* ---------------------------
   START TRANSACTION
----------------------------*/
$pdo->beginTransaction();

try {

    /* ---------------------------
       REMOVE MONEY FROM BUYER
    ----------------------------*/
    $stmt = $pdo->prepare("
        UPDATE users
        SET user_coins = user_coins - ?
        WHERE id = ?
    ");

    $stmt->execute([$price, $buyerId]);

    /* ---------------------------
       GIVE MONEY TO SELLER
    ----------------------------*/
    $stmt = $pdo->prepare("
        UPDATE users
        SET user_coins = user_coins + ?
        WHERE id = ?
    ");

    $stmt->execute([$price, $sellerId]);

    /* ---------------------------
       DELETE ONLY THIS LISTING
    ----------------------------*/
    $stmt = $pdo->prepare("
        DELETE FROM marketplace
        WHERE id = ?
    ");

    $stmt->execute([$listing['id']]);

    /* ---------------------------
       ADD CARD TO BUYER
    ----------------------------*/
    $stmt = $pdo->prepare("
        SELECT card_amount
        FROM user_cards
        WHERE user_id = ? AND card_id = ?
    ");

    $stmt->execute([$buyerId, $cardId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row) {

        $stmt = $pdo->prepare("
            UPDATE user_cards
            SET card_amount = card_amount + 1
            WHERE user_id = ? AND card_id = ?
        ");

        $stmt->execute([$buyerId, $cardId]);

    } else {

        $stmt = $pdo->prepare("
            INSERT INTO user_cards (user_id, card_id, card_amount)
            VALUES (?, ?, 1)
        ");

        $stmt->execute([$buyerId, $cardId]);
    }

    $pdo->commit();

    echo json_encode([
        "success" => true,
        "message" => "Card purchased successfully"
    ]);

} catch (Exception $e) {

    $pdo->rollBack();

    echo json_encode([
        "success" => false,
        "message" => "Purchase failed"
    ]);
}