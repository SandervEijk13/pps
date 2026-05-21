<?php
header("Content-Type: application/json");
if (isset($_SERVER['HTTP_ORIGIN']) && in_array($_SERVER['HTTP_ORIGIN'], ['http://localhost:5173', 'http://127.0.0.1:5173'], true)) {
    header("Access-Control-Allow-Origin: " . $_SERVER['HTTP_ORIGIN']);
}
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Credentials: true");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS')
    exit;

session_start();
require "db.php";

$raw = file_get_contents("php://input");
$data = json_decode($raw, true);

if (!is_array($data)) {
    echo json_encode([
        "success" => false,
        "message" => "Invalid JSON body",
        "raw" => $raw
    ]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (empty($_SESSION['user_id'])) {
        echo json_encode([
            "success" => false,
            "loggedIn" => false
        ]);
        exit;
    }

    $stmt = $pdo->prepare("SELECT id, email, user_coins FROM users WHERE id = ?");
    $stmt->execute([(int) $_SESSION['user_id']]);
    $user = $stmt->fetch();

    echo json_encode([
        "success" => (bool) $user,
        "loggedIn" => (bool) $user,
        "user" => $user
    ]);
    exit;
}

if (($data['action'] ?? '') === 'setCoins') {
    if (empty($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(["success" => false, "message" => "Not logged in"]);
        exit;
    }

    $coins = (int) ($data['coins'] ?? 0);
    $stmt = $pdo->prepare("UPDATE users SET user_coins = ? WHERE id = ?");
    $stmt->execute([$coins, (int) $_SESSION['user_id']]);

    echo json_encode([
        "success" => true,
        "coins" => $coins
    ]);
    exit;
}

$email = $data['email'] ?? '';
$password = $data['password'] ?? '';

if (!$email || !$password) {
    echo json_encode([
        "success" => false,
        "message" => "Missing fields"
    ]);
    exit;
}

// find user
$stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user) {
    echo json_encode([
        "success" => false,
        "message" => "User not found"
    ]);
    exit;
}

// verify password
if (!password_verify($password, $user['password'])) {
    echo json_encode([
        "success" => false,
        "message" => "Wrong password"
    ]);
    exit;
}

// success login
session_regenerate_id(true);
$_SESSION['user_id'] = (int) $user['id'];

echo json_encode([
    "success" => true,
    "message" => "Login successful",
    "user" => [
        "id" => $user['id'],
        "email" => $user['email']
    ]
]);