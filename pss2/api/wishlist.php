<?php

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin === 'http://localhost:5173' || strpos($origin, 'http://localhost') === 0) {
    header("Access-Control-Allow-Origin: $origin");
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

session_start();
require_once __DIR__ . '/db.php';

function ensureWishlistTable(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_wishlist (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            card_id VARCHAR(128) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_user_wishlist (user_id, card_id),
            KEY idx_wishlist_user (user_id, created_at),
            CONSTRAINT fk_wishlist_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $ready = true;
}

ensureWishlistTable($pdo);

$action = $_GET['action'] ?? '';

if ($action === 'get' && isset($_GET['user_id'])) {
    $targetUserId = (int) $_GET['user_id'];
    $stmt = $pdo->prepare('
        SELECT card_id, created_at
        FROM user_wishlist
        WHERE user_id = ?
        ORDER BY created_at DESC
    ');
    $stmt->execute([$targetUserId]);
    echo json_encode([
        'success' => true,
        'items' => $stmt->fetchAll(PDO::FETCH_ASSOC),
    ]);
    exit;
}

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

$userId = (int) $_SESSION['user_id'];
$data = json_decode(file_get_contents('php://input'), true) ?: [];

switch ($action) {
    case 'get':
        $stmt = $pdo->prepare('
            SELECT card_id, created_at
            FROM user_wishlist
            WHERE user_id = ?
            ORDER BY created_at DESC
        ');
        $stmt->execute([$userId]);
        echo json_encode([
            'success' => true,
            'items' => $stmt->fetchAll(PDO::FETCH_ASSOC),
        ]);
        break;

    case 'add':
        $cardId = trim((string) ($data['cardId'] ?? ''));
        if ($cardId === '') {
            echo json_encode(['success' => false, 'message' => 'Missing card id']);
            break;
        }

        $check = $pdo->prepare('SELECT COUNT(*) FROM user_wishlist WHERE user_id = ? AND card_id = ?');
        $check->execute([$userId, $cardId]);
        if ((int) $check->fetchColumn() > 0) {
            echo json_encode(['success' => false, 'message' => 'Card already on wishlist']);
            break;
        }

        $countStmt = $pdo->prepare('SELECT COUNT(*) FROM user_wishlist WHERE user_id = ?');
        $countStmt->execute([$userId]);
        if ((int) $countStmt->fetchColumn() >= 50) {
            echo json_encode(['success' => false, 'message' => 'Wishlist limit reached (50 cards)']);
            break;
        }

        $stmt = $pdo->prepare('INSERT INTO user_wishlist (user_id, card_id) VALUES (?, ?)');
        $stmt->execute([$userId, $cardId]);
        echo json_encode(['success' => true, 'message' => 'Added to wishlist']);
        break;

    case 'remove':
        $cardId = trim((string) ($data['cardId'] ?? ''));
        if ($cardId === '') {
            echo json_encode(['success' => false, 'message' => 'Missing card id']);
            break;
        }

        $stmt = $pdo->prepare('DELETE FROM user_wishlist WHERE user_id = ? AND card_id = ?');
        $stmt->execute([$userId, $cardId]);
        echo json_encode(['success' => true, 'message' => 'Removed from wishlist']);
        break;

    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
}
