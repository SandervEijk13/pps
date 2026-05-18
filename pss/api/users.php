<?php

header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json");

require "db.php";

$action = $_GET['action'] ?? '';

switch ($action) {

    case 'getCoins':
        getCoins($pdo);
        break;
    case 'removeCoins':
        removeCoins($pdo);
        break;
    // more cases for more actions!

    default:
        echo json_encode([
            "success" => false,
            "message" => "Invalid action"
        ]);
        break;
}

function getCoins($pdo)
{
    $id = $_GET['id'] ?? 0;

    $stmt = $pdo->prepare("
        SELECT user_coins
        FROM users
        WHERE id = ?
    ");

    $stmt->execute([$id]);

    $result = $stmt->fetch();

    if ($result) {

        echo json_encode([
            "success" => true,
            "coins" => $result['user_coins']
        ]);

    } else {

        echo json_encode([
            "success" => false,
            "message" => "User not found"
        ]);

    }
}

function removeCoins($pdo)
{
    $input = json_decode(file_get_contents("php://input"), true);

    $id = $input['id'] ?? 0;
    $amount = $input['amount'] ?? 0;

    if (!$id || $amount <= 0) {
        echo json_encode([
            "success" => false,
            "message" => "Invalid data"
        ]);
        return;
    }

    // subtract directly in SQL (BEST way)
    $stmt = $pdo->prepare("
        UPDATE users
        SET user_coins = user_coins - ?
        WHERE id = ?
    ");

    $stmt->execute([$amount, $id]);

    // fetch updated value
    $stmt = $pdo->prepare("
        SELECT user_coins
        FROM users
        WHERE id = ?
    ");

    $stmt->execute([$id]);
    $result = $stmt->fetch();

    echo json_encode([
        "success" => true,
        "coins" => $result['user_coins']
    ]);
}