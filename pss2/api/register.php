<?php

header("Content-Type: application/json");

if (
    isset($_SERVER['HTTP_ORIGIN']) &&
    in_array($_SERVER['HTTP_ORIGIN'], [
        'http://localhost:5173',
        'http://127.0.0.1:5173'
    ], true)
) {
    header("Access-Control-Allow-Origin: " . $_SERVER['HTTP_ORIGIN']);
}

header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Credentials: true");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

ini_set('display_errors', 0);
error_reporting(0);

require "db.php";

$raw = file_get_contents("php://input");

$data = json_decode($raw, true);

if (!is_array($data)) {

    echo json_encode([
        "success" => false,
        "message" => "Invalid JSON input"
    ]);

    exit;
}

$username = trim($data['username'] ?? '');

$email = trim($data['email'] ?? '');

$password = $data['password'] ?? '';

$coins = 100;

if (
    empty($username) ||
    empty($email) ||
    empty($password)
) {

    echo json_encode([
        "success" => false,
        "message" => "Missing fields"
    ]);

    exit;
}

try {

    // USERNAME EXISTS
    $stmt = $pdo->prepare(
        "SELECT id FROM users WHERE username = ?"
    );

    $stmt->execute([$username]);

    if ($stmt->fetch()) {

        echo json_encode([
            "success" => false,
            "message" => "Username already exists"
        ]);

        exit;
    }

    // EMAIL EXISTS
    $stmt = $pdo->prepare(
        "SELECT id FROM users WHERE email = ?"
    );

    $stmt->execute([$email]);

    if ($stmt->fetch()) {

        echo json_encode([
            "success" => false,
            "message" => "Email already exists"
        ]);

        exit;
    }

    // HASH PASSWORD
    $hash = password_hash($password, PASSWORD_BCRYPT);

    // INSERT USER
    $stmt = $pdo->prepare("
        INSERT INTO users
        (username, email, password, user_coins, created_at)
        VALUES (?, ?, ?, ?, NOW())
    ");

    $stmt->execute([
        $username,
        $email,
        $hash,
        $coins
    ]);

    echo json_encode([
        "success" => true,
        "message" => "User created"
    ]);

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Server error during registration",
        "debug" => $e->getMessage()
    ]);
}