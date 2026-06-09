<?php

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin === 'http://localhost:5173' || strpos($origin, 'http://localhost') === 0) {
    header("Access-Control-Allow-Origin: $origin");
}
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

session_start();
require "db.php";
require_once __DIR__ . '/leaderboard.php';

$action = $_GET['action'] ?? '';

switch ($action) {

    case 'getCoins':
        getCoins($pdo);
        break;
    case 'removeCoins':
        removeCoins($pdo);
        break;
    case 'addCoins':
        addCoins($pdo);
        break;
    case 'instaSell':
        instaSell($pdo);
        break;
    case 'getProfile':
        getProfile($pdo);
        break;

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
            "coins" => round((float) $result['user_coins'], 2)
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
    if (!isset($_SESSION['user_id'])) {
        echo json_encode([
            "success" => false,
            "message" => "Not logged in"
        ]);
        return;
    }

    $input = json_decode(file_get_contents("php://input"), true) ?: [];
    $amount = round((float) ($input['amount'] ?? 0), 2);
    $userId = (int) $_SESSION['user_id'];

    if ($amount <= 0) {
        echo json_encode([
            "success" => false,
            "message" => "Invalid data"
        ]);
        return;
    }

    $stmt = $pdo->prepare("SELECT user_coins FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $row = $stmt->fetch();

    if (!$row) {
        echo json_encode([
            "success" => false,
            "message" => "User not found"
        ]);
        return;
    }

    $balance = (float) $row['user_coins'];
    if ($balance < $amount) {
        echo json_encode([
            "success" => false,
            "message" => "Not enough coins",
            "coins" => round($balance, 2)
        ]);
        return;
    }

    $stmt = $pdo->prepare("
        UPDATE users
        SET user_coins = user_coins - ?
        WHERE id = ?
    ");
    $stmt->execute([$amount, $userId]);
    recordUserWager($pdo, $userId, $amount);

    $stmt = $pdo->prepare("SELECT user_coins FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $result = $stmt->fetch();

    echo json_encode([
        "success" => true,
        "coins" => round((float) ($result['user_coins'] ?? 0), 2)
    ]);
}

function addCoins($pdo)
{
    $input = json_decode(file_get_contents("php://input"), true) ?: [];

    $id = (int) ($input['id'] ?? ($_SESSION['user_id'] ?? 0));
    $amount = (int) ($input['amount'] ?? 0);

    if (!$id || $amount <= 0) {
        echo json_encode([
            "success" => false,
            "message" => "Invalid data"
        ]);
        return;
    }

    $stmt = $pdo->prepare("
        UPDATE users
        SET user_coins = user_coins + ?
        WHERE id = ?
    ");
    $stmt->execute([$amount, $id]);

    $stmt = $pdo->prepare("SELECT user_coins FROM users WHERE id = ?");
    $stmt->execute([$id]);
    $result = $stmt->fetch();

    echo json_encode([
        "success" => true,
        "coinsAdded" => $amount,
        "coins" => $result['user_coins'] ?? 0
    ]);
}

/**
 * Direct verkopen na pack pull: kaartwaarde - 20% (= 80%) als coins.
 */
function instaSell($pdo)
{
    if (!isset($_SESSION['user_id'])) {
        echo json_encode([
            "success" => false,
            "message" => "Not logged in"
        ]);
        return;
    }

    $input = json_decode(file_get_contents("php://input"), true) ?: [];
    $cardValue = (float) ($input['cardValue'] ?? 0);

    if ($cardValue <= 0) {
        echo json_encode([
            "success" => false,
            "message" => "Invalid card value"
        ]);
        return;
    }

    $userId = (int) $_SESSION['user_id'];
    $coinsAdded = round($cardValue * 0.8, 2);

    if ($coinsAdded <= 0) {
        echo json_encode([
            "success" => false,
            "message" => "Sell value too low"
        ]);
        return;
    }

    $stmt = $pdo->prepare("
        UPDATE users
        SET user_coins = user_coins + ?
        WHERE id = ?
    ");
    $stmt->execute([$coinsAdded, $userId]);

    $stmt = $pdo->prepare("SELECT user_coins FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $result = $stmt->fetch();

    echo json_encode([
        "success" => true,
        "coinsAdded" => $coinsAdded,
        "coins" => round((float) ($result['user_coins'] ?? 0), 2),
        "message" => "Card sold instantly"
    ]);
}

function getProfile($pdo)
{
    $id = $_GET['id'] ?? 0;

    if (!$id) {
        echo json_encode([
            "success" => false,
            "message" => "Missing user id"
        ]);
        return;
    }

    $stmt = $pdo->prepare("
        SELECT
            id,
            username,
            user_coins
        FROM users
        WHERE id = ?
    ");

    $stmt->execute([$id]);

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {

        echo json_encode([
            "success" => false,
            "message" => "User not found"
        ]);

        return;
    }

    echo json_encode([
        "success" => true,
        "user" => [
            "id" => $user["id"],
            "username" => $user["username"],
            "coins" => round((float) $user["user_coins"], 2)
        ]
    ]);
}