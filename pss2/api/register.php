<?php
header("Content-Type: application/json");

// CORS
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

// Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

// Prevent PHP HTML errors breaking JSON
ini_set('display_errors', 0);
error_reporting(0);

require "db.php";

// Read JSON input safely
$raw = file_get_contents("php://input");
$data = json_decode($raw, true);

if (!is_array($data)) {
    echo json_encode([
        "success" => false,
        "message" => "Invalid JSON input"
    ]);
    exit;
}

$email = $data['email'] ?? '';
$password = $data['password'] ?? '';
$coins = 100;

// Validate input
if (empty($email) || empty($password)) {
    echo json_encode([
        "success" => false,
        "message" => "Missing fields"
    ]);
    exit;
}

try {
    // Check if user exists
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$email]);

    if ($stmt->fetch()) {
        echo json_encode([
            "success" => false,
            "message" => "Email already exists"
        ]);
        exit;
    }

    // Hash password
    $hash = password_hash($password, PASSWORD_BCRYPT);

    // Insert user
    $stmt = $pdo->prepare("
        INSERT INTO users ( email, password, user_coins, created_at)
        VALUES (?, ?, ?, NOW())
    ");

    $stmt->execute([$email, $hash, $coins]);

    echo json_encode([
        "success" => true,
        "message" => "User created"
    ]);
    exit;

} catch (Throwable $e) {
    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Server error during registration",
        "debug" => $e->getMessage()
    ]);
    exit;
}