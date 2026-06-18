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
require_once __DIR__ . '/profile_features_lib.php';

ensureProfileFeatureTables($pdo);

$action = $_GET['action'] ?? 'dashboard';
switch ($action) {
    case 'claimQuest':
        claimQuest($pdo);
        break;
    case 'claimMilestone':
        claimMilestone($pdo);
        break;
    case 'dashboard':
    default:
        getDashboard($pdo);
        break;
}

function getDashboard(PDO $pdo): void
{
    $profileId = (int) ($_GET['id'] ?? 0);
    if ($profileId <= 0) {
        $profileId = (int) ($_SESSION['user_id'] ?? 0);
    }
    if ($profileId <= 0) {
        echo json_encode(['success' => false, 'message' => 'Missing user id']);
        return;
    }

    $metrics = getCurrentUserMetrics($pdo, $profileId);
    $daily = buildQuestPayload($pdo, $profileId, 'daily', $metrics);
    $weekly = buildQuestPayload($pdo, $profileId, 'weekly', $metrics);
    $milestones = buildMilestonePayload($pdo, $profileId, $metrics);
    $rep = computeTradeReputation($pdo, $profileId);

    echo json_encode([
        'success' => true,
        'isOwnProfile' => isset($_SESSION['user_id']) && (int) $_SESSION['user_id'] === $profileId,
        'tradeReputation' => $rep,
        'quests' => [
            'daily' => $daily,
            'weekly' => $weekly,
        ],
        'collectionMilestones' => $milestones,
    ]);
}

function claimQuest(PDO $pdo): void
{
    $userId = (int) ($_SESSION['user_id'] ?? 0);
    if ($userId <= 0) {
        echo json_encode(['success' => false, 'message' => 'Not logged in']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $periodType = (string) ($input['periodType'] ?? '');
    $questKey = (string) ($input['questKey'] ?? '');
    if (!in_array($periodType, ['daily', 'weekly'], true) || $questKey === '') {
        echo json_encode(['success' => false, 'message' => 'Invalid quest claim']);
        return;
    }

    $metrics = getCurrentUserMetrics($pdo, $userId);
    $period = buildQuestPayload($pdo, $userId, $periodType, $metrics);
    $quest = null;
    foreach ($period['quests'] as $q) {
        if ($q['key'] === $questKey) {
            $quest = $q;
            break;
        }
    }

    if (!$quest) {
        echo json_encode(['success' => false, 'message' => 'Quest not found']);
        return;
    }
    if (!$quest['completed']) {
        echo json_encode(['success' => false, 'message' => 'Quest is not completed yet']);
        return;
    }
    if ($quest['claimed']) {
        echo json_encode(['success' => false, 'message' => 'Quest already claimed']);
        return;
    }

    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare("
            INSERT INTO user_quest_claims (user_id, period_type, period_key, quest_key, reward_coins)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([$userId, $periodType, $period['periodKey'], $questKey, $quest['reward']]);

        $stmt = $pdo->prepare("UPDATE users SET user_coins = user_coins + ? WHERE id = ?");
        $stmt->execute([$quest['reward'], $userId]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        echo json_encode(['success' => false, 'message' => 'Could not claim quest reward']);
        return;
    }

    echo json_encode(['success' => true, 'coinsAdded' => $quest['reward']]);
}

function claimMilestone(PDO $pdo): void
{
    $userId = (int) ($_SESSION['user_id'] ?? 0);
    if ($userId <= 0) {
        echo json_encode(['success' => false, 'message' => 'Not logged in']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $milestoneKey = (string) ($input['milestoneKey'] ?? '');
    if ($milestoneKey === '') {
        echo json_encode(['success' => false, 'message' => 'Missing milestone']);
        return;
    }

    $metrics = getCurrentUserMetrics($pdo, $userId);
    $milestones = buildMilestonePayload($pdo, $userId, $metrics);
    $target = null;
    foreach ($milestones as $m) {
        if ($m['key'] === $milestoneKey) {
            $target = $m;
            break;
        }
    }

    if (!$target) {
        echo json_encode(['success' => false, 'message' => 'Milestone not found']);
        return;
    }
    if (!$target['completed']) {
        echo json_encode(['success' => false, 'message' => 'Milestone not completed']);
        return;
    }
    if ($target['claimed']) {
        echo json_encode(['success' => false, 'message' => 'Milestone already claimed']);
        return;
    }

    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare("
            INSERT INTO user_milestone_claims (user_id, milestone_key, reward_coins)
            VALUES (?, ?, ?)
        ");
        $stmt->execute([$userId, $milestoneKey, $target['reward']]);

        $stmt = $pdo->prepare("UPDATE users SET user_coins = user_coins + ? WHERE id = ?");
        $stmt->execute([$target['reward'], $userId]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        echo json_encode(['success' => false, 'message' => 'Could not claim milestone reward']);
        return;
    }

    echo json_encode(['success' => true, 'coinsAdded' => $target['reward']]);
}
