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
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Credentials: true");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

session_start();

require "db.php";

$raw = file_get_contents("php://input");

$data = json_decode($raw, true);

if (!is_array($data)) {

    echo json_encode([
        "success" => false,
        "message" => "Invalid JSON body"
    ]);

    exit;
}

$username = trim($data['username'] ?? '');

$password = $data['password'] ?? '';

if (empty($username) || empty($password)) {

    echo json_encode([
        "success" => false,
        "message" => "Missing fields"
    ]);

    exit;
}

// FIND USER
$stmt = $pdo->prepare(
    "SELECT * FROM users WHERE username = ?"
);

$stmt->execute([$username]);

$user = $stmt->fetch();

if (!$user) {

    echo json_encode([
        "success" => false,
        "message" => "User not found"
    ]);

    exit;
}

// VERIFY PASSWORD
if (!password_verify($password, $user['password'])) {

    echo json_encode([
        "success" => false,
        "message" => "Wrong password"
    ]);

    exit;
}

// SUCCESS
session_regenerate_id(true);

$_SESSION['user_id'] = (int) $user['id'];

echo json_encode([
    "success" => true,
    "message" => "Login successful",
    "user" => [
        "id" => $user['id'],
        "username" => $user['username'],
        "email" => $user['email']
    ]
]);