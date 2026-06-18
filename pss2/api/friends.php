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
require_once 'db.php';
require_once __DIR__ . '/friends_lib.php';
require_once __DIR__ . '/user_activity_lib.php';

ensureFriendTables($pdo);

$action = $_GET['action'] ?? 'list';
$method = $_SERVER['REQUEST_METHOD'];

switch ($action) {
    case 'list':
        listFriends($pdo);
        break;
    case 'incoming':
        listIncoming($pdo);
        break;
    case 'outgoing':
        listOutgoing($pdo);
        break;
    case 'send':
        if ($method !== 'POST') {
            methodNotAllowed();
        }
        sendRequest($pdo);
        break;
    case 'accept':
        if ($method !== 'POST') {
            methodNotAllowed();
        }
        acceptRequest($pdo);
        break;
    case 'decline':
        if ($method !== 'POST') {
            methodNotAllowed();
        }
        declineRequest($pdo);
        break;
    case 'remove':
        if ($method !== 'POST') {
            methodNotAllowed();
        }
        removeFriend($pdo);
        break;
    default:
        echo json_encode(['success' => false, 'message' => 'Unknown action']);
}

function methodNotAllowed(): void
{
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

function requireLogin(PDO $pdo): ?int
{
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(['success' => false, 'message' => 'Not logged in']);
        return null;
    }

    $userId = (int) $_SESSION['user_id'];
    touchUserActivity($pdo, $userId);

    return $userId;
}

function lookupUserByUsername(PDO $pdo, string $username): ?array
{
    $stmt = $pdo->prepare('SELECT id, username FROM users WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function otherUserId(array $row, int $myId): int
{
    $low = (int) $row['user_id'];
    $high = (int) $row['friend_user_id'];
    return $low === $myId ? $high : $low;
}

function listFriends(PDO $pdo): void
{
    $userId = requireLogin($pdo);
    if ($userId === null) {
        return;
    }

    $stmt = $pdo->prepare("
        SELECT uf.*, u.id AS other_id, u.username AS other_username, u.last_active_at
        FROM user_friends uf
        JOIN users u ON u.id = CASE
            WHEN uf.user_id = ? THEN uf.friend_user_id
            ELSE uf.user_id
        END
        WHERE uf.status = 'accepted'
          AND (uf.user_id = ? OR uf.friend_user_id = ?)
        ORDER BY u.username ASC
    ");
    $stmt->execute([$userId, $userId, $userId]);

    $friends = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $base = attachPresenceToUserRow($row);
        $friends[] = [
            'id' => $base['id'],
            'username' => $base['username'],
            'since' => $row['updated_at'] ?? $row['created_at'],
            'presence' => $base['presence'],
            'lastActiveAt' => $base['lastActiveAt'],
        ];
    }

    echo json_encode(['success' => true, 'friends' => $friends]);
}

function listIncoming(PDO $pdo): void
{
    $userId = requireLogin($pdo);
    if ($userId === null) {
        return;
    }

    $stmt = $pdo->prepare("
        SELECT uf.*, u.username AS from_username
        FROM user_friends uf
        JOIN users u ON u.id = uf.requested_by
        WHERE uf.status = 'pending'
          AND uf.requested_by <> ?
          AND (uf.user_id = ? OR uf.friend_user_id = ?)
        ORDER BY uf.created_at DESC
    ");
    $stmt->execute([$userId, $userId, $userId]);

    $requests = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $requests[] = [
            'id' => (int) $row['id'],
            'userId' => (int) $row['requested_by'],
            'username' => (string) $row['from_username'],
            'createdAt' => $row['created_at'],
        ];
    }

    echo json_encode(['success' => true, 'requests' => $requests]);
}

function listOutgoing(PDO $pdo): void
{
    $userId = requireLogin($pdo);
    if ($userId === null) {
        return;
    }

    $stmt = $pdo->prepare("
        SELECT uf.*, u.username AS to_username
        FROM user_friends uf
        JOIN users u ON u.id = CASE
            WHEN uf.user_id = ? THEN uf.friend_user_id
            ELSE uf.user_id
        END
        WHERE uf.status = 'pending'
          AND uf.requested_by = ?
        ORDER BY uf.created_at DESC
    ");
    $stmt->execute([$userId, $userId]);

    $requests = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $requests[] = [
            'id' => (int) $row['id'],
            'userId' => otherUserId($row, $userId),
            'username' => (string) $row['to_username'],
            'createdAt' => $row['created_at'],
        ];
    }

    echo json_encode(['success' => true, 'requests' => $requests]);
}

function sendRequest(PDO $pdo): void
{
    $userId = requireLogin($pdo);
    if ($userId === null) {
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $username = trim((string) ($input['username'] ?? ''));
    $targetId = (int) ($input['userId'] ?? 0);

    if ($targetId <= 0 && $username !== '') {
        $user = lookupUserByUsername($pdo, $username);
        if (!$user) {
            echo json_encode(['success' => false, 'message' => 'Gebruiker niet gevonden']);
            return;
        }
        $targetId = (int) $user['id'];
    }

    if ($targetId <= 0) {
        echo json_encode(['success' => false, 'message' => 'Gebruiker ontbreekt']);
        return;
    }

    if ($targetId === $userId) {
        echo json_encode(['success' => false, 'message' => 'Je kunt jezelf niet toevoegen']);
        return;
    }

    $stmt = $pdo->prepare('SELECT id FROM users WHERE id = ?');
    $stmt->execute([$targetId]);
    if (!$stmt->fetch()) {
        echo json_encode(['success' => false, 'message' => 'Gebruiker niet gevonden']);
        return;
    }

    $existing = fetchFriendRow($pdo, $userId, $targetId);
    if ($existing) {
        if ($existing['status'] === 'accepted') {
            echo json_encode(['success' => false, 'message' => 'Jullie zijn al vrienden']);
            return;
        }
        if ((int) $existing['requested_by'] === $userId) {
            echo json_encode(['success' => false, 'message' => 'Uitnodiging al verstuurd']);
            return;
        }
        echo json_encode(['success' => false, 'message' => 'Deze speler heeft jou al uitgenodigd']);
        return;
    }

    [$low, $high] = normalizeFriendPair($userId, $targetId);
    $stmt = $pdo->prepare('
        INSERT INTO user_friends (user_id, friend_user_id, status, requested_by)
        VALUES (?, ?, \'pending\', ?)
    ');
    $stmt->execute([$low, $high, $userId]);

    echo json_encode(['success' => true, 'message' => 'Vriendschapsverzoek verstuurd']);
}

function acceptRequest(PDO $pdo): void
{
    $userId = requireLogin($pdo);
    if ($userId === null) {
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $fromUserId = (int) ($input['userId'] ?? 0);
    if ($fromUserId <= 0) {
        echo json_encode(['success' => false, 'message' => 'Gebruiker ontbreekt']);
        return;
    }

    $row = fetchFriendRow($pdo, $userId, $fromUserId);
    if (!$row || $row['status'] !== 'pending') {
        echo json_encode(['success' => false, 'message' => 'Geen open verzoek gevonden']);
        return;
    }

    if ((int) $row['requested_by'] === $userId) {
        echo json_encode(['success' => false, 'message' => 'Je kunt je eigen verzoek niet accepteren']);
        return;
    }

    $stmt = $pdo->prepare("UPDATE user_friends SET status = 'accepted' WHERE id = ?");
    $stmt->execute([(int) $row['id']]);

    echo json_encode(['success' => true, 'message' => 'Vriend toegevoegd']);
}

function declineRequest(PDO $pdo): void
{
    $userId = requireLogin($pdo);
    if ($userId === null) {
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $fromUserId = (int) ($input['userId'] ?? 0);
    if ($fromUserId <= 0) {
        echo json_encode(['success' => false, 'message' => 'Gebruiker ontbreekt']);
        return;
    }

    $row = fetchFriendRow($pdo, $userId, $fromUserId);
    if (!$row || $row['status'] !== 'pending') {
        echo json_encode(['success' => false, 'message' => 'Geen open verzoek gevonden']);
        return;
    }

    $stmt = $pdo->prepare('DELETE FROM user_friends WHERE id = ?');
    $stmt->execute([(int) $row['id']]);

    echo json_encode(['success' => true, 'message' => 'Verzoek geweigerd']);
}

function removeFriend(PDO $pdo): void
{
    $userId = requireLogin($pdo);
    if ($userId === null) {
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $friendId = (int) ($input['userId'] ?? 0);
    if ($friendId <= 0) {
        echo json_encode(['success' => false, 'message' => 'Gebruiker ontbreekt']);
        return;
    }

    $row = fetchFriendRow($pdo, $userId, $friendId);
    if (!$row) {
        echo json_encode(['success' => false, 'message' => 'Vriendschap niet gevonden']);
        return;
    }

    $stmt = $pdo->prepare('DELETE FROM user_friends WHERE id = ?');
    $stmt->execute([(int) $row['id']]);

    echo json_encode(['success' => true, 'message' => 'Vriend verwijderd']);
}
