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
require 'db.php';

header('Content-Type: application/json');

$action = $_GET['action'] ?? '';

// Special case: GET action with user_id parameter - public access for viewing favorites
if ($action === 'get' && isset($_GET['user_id'])) {
    $targetUserId = $_GET['user_id'];

    $stmt = $pdo->prepare("
        SELECT card_id, created_at
        FROM favorites
        WHERE user_id = ?
        ORDER BY created_at DESC
    ");

    $stmt->execute([$targetUserId]);

    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    exit;
}

// For all other operations, require login
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);

    echo json_encode([
        'success' => false,
        'message' => 'Not logged in'
    ]);

    exit;
}

$userId = $_SESSION['user_id'];
$data = json_decode(file_get_contents('php://input'), true);

switch ($action) {

    case 'get':
        // Get current user's own favorites (when no user_id parameter is provided)
        $stmt = $pdo->prepare("
            SELECT card_id, created_at
            FROM favorites
            WHERE user_id = ?
            ORDER BY created_at DESC
        ");

        $stmt->execute([$userId]);

        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
        break;

    case 'add':
        $cardId = $data['cardId'] ?? '';

        // Check if card already exists in favorites
        $checkStmt = $pdo->prepare("
            SELECT COUNT(*)
            FROM favorites
            WHERE user_id = ? AND card_id = ?
        ");
        $checkStmt->execute([$userId, $cardId]);
        $exists = $checkStmt->fetchColumn();

        if ($exists) {
            echo json_encode([
                'success' => false,
                'message' => 'Card already in favorites'
            ]);
            exit;
        }

        $stmt = $pdo->prepare("
            SELECT COUNT(*)
            FROM favorites
            WHERE user_id = ?
        ");

        $stmt->execute([$userId]);
        $count = $stmt->fetchColumn();

        if ($count >= 5) {
            echo json_encode([
                'success' => false,
                'message' => 'Maximum 5 favorites'
            ]);
            exit;
        }

        $stmt = $pdo->prepare("
            INSERT INTO favorites
            (user_id, card_id)
            VALUES (?, ?)
        ");

        $stmt->execute([$userId, $cardId]);

        echo json_encode([
            'success' => true,
            'message' => 'Card added to favorites'
        ]);
        break;

    case 'remove':
        $cardId = $data['cardId'] ?? '';

        $stmt = $pdo->prepare("
            SELECT id
            FROM favorites
            WHERE user_id = ?
            AND card_id = ?
            ORDER BY id
            LIMIT 1
        ");

        $stmt->execute([$userId, $cardId]);
        $favoriteId = $stmt->fetchColumn();

        if ($favoriteId) {
            $delete = $pdo->prepare("
                DELETE FROM favorites
                WHERE id = ?
            ");

            $delete->execute([$favoriteId]);
        }

        echo json_encode([
            'success' => true,
            'message' => 'Card removed from favorites'
        ]);
        break;

    default:
        http_response_code(400);

        echo json_encode([
            'success' => false,
            'message' => 'Invalid action'
        ]);
}