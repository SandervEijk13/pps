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
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/achievements_lib.php';

ensureAchievementTables($pdo);

$action = $_GET['action'] ?? 'get';

if ($action === 'setActiveTitle') {
    setActiveTitle($pdo);
    exit;
}

getAchievements($pdo);

function getAchievements(PDO $pdo): void
{
    $profileId = (int) ($_GET['id'] ?? 0);
    if ($profileId <= 0) {
        $profileId = (int) ($_SESSION['user_id'] ?? 0);
    }

    if ($profileId <= 0) {
        echo json_encode(['success' => false, 'message' => 'Missing user id']);
        return;
    }

    $stmt = $pdo->prepare('SELECT id FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$profileId]);
    if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
        echo json_encode(['success' => false, 'message' => 'User not found']);
        return;
    }

    $payload = getUserAchievementsPayload($pdo, $profileId);
    echo json_encode([
        'success' => true,
        'activeTitleKey' => $payload['activeTitleKey'],
        'achievements' => $payload['achievements'],
    ]);
}

function setActiveTitle(PDO $pdo): void
{
    $userId = (int) ($_SESSION['user_id'] ?? 0);
    if ($userId <= 0) {
        echo json_encode(['success' => false, 'message' => 'Not logged in']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $titleKey = trim((string) ($input['titleKey'] ?? ''));
    if ($titleKey === '') {
        echo json_encode(['success' => false, 'message' => 'Missing title key']);
        return;
    }

    unlockEligibleAchievements($pdo, $userId);

    $stmt = $pdo->prepare("
        SELECT id
        FROM user_achievements
        WHERE user_id = ? AND achievement_key = ?
        LIMIT 1
    ");
    $stmt->execute([$userId, $titleKey]);
    if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
        echo json_encode(['success' => false, 'message' => 'Title not unlocked']);
        return;
    }

    $stmt = $pdo->prepare("UPDATE users SET active_title_key = ? WHERE id = ?");
    $stmt->execute([$titleKey, $userId]);

    $payload = getUserAchievementsPayload($pdo, $userId);
    echo json_encode([
        'success' => true,
        'activeTitleKey' => $payload['activeTitleKey'],
        'achievements' => $payload['achievements'],
    ]);
}