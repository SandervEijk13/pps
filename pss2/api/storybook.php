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
require_once __DIR__ . '/storybook_lib.php';

$userId = (int) ($_SESSION['user_id'] ?? 0);
if ($userId <= 0) {
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

ensureStorybookTables($pdo);
ensureStarterCosmeticsUnlocked($pdo, $userId);

$action = $_GET['action'] ?? 'dashboard';
switch ($action) {
    case 'set':
        getSetDetail($pdo, $userId);
        break;
    case 'claimChapter':
        claimChapterReward($pdo, $userId);
        break;
    case 'dashboard':
    default:
        getStorybookDashboard($pdo, $userId);
        break;
}

function getStorybookDashboard(PDO $pdo, int $userId): void
{
    $progressMap = fetchSetProgressMap($pdo, $userId);
    $sets = [];
    foreach ($progressMap as $setId => $progress) {
        ensureSetStoryChapters($pdo, $setId);
        $sets[] = buildStorySetPayload($pdo, $userId, $setId, $progress);
    }
    echo json_encode([
        'success' => true,
        'eventSpotlight' => [
            'name' => 'Mythic Summer 2026',
            'status' => 'active',
            'description' => 'Unlock cosmic cosmetics with high collection progress.',
            'exclusiveRewards' => ['frame_mythic_cosmos', 'badge_event_ember'],
        ],
        'sets' => $sets,
    ]);
}

function getSetDetail(PDO $pdo, int $userId): void
{
    $setId = trim((string) ($_GET['setId'] ?? ''));
    if ($setId === '') {
        echo json_encode(['success' => false, 'message' => 'Missing setId']);
        return;
    }
    $progressMap = fetchSetProgressMap($pdo, $userId);
    if (!isset($progressMap[$setId])) {
        echo json_encode(['success' => false, 'message' => 'Unknown set']);
        return;
    }
    ensureSetStoryChapters($pdo, $setId);
    echo json_encode([
        'success' => true,
        'set' => buildStorySetPayload($pdo, $userId, $setId, $progressMap[$setId]),
    ]);
}

function buildStorySetPayload(PDO $pdo, int $userId, string $setId, array $progress): array
{
    $claimStmt = $pdo->prepare("SELECT chapter_no FROM user_story_claims WHERE user_id = ? AND set_id = ?");
    $claimStmt->execute([$userId, $setId]);
    $claimedMap = array_flip(array_map('intval', $claimStmt->fetchAll(PDO::FETCH_COLUMN) ?: []));

    $chapStmt = $pdo->prepare("
        SELECT chapter_no, title, body, unlock_pct, reward_coins, reward_cosmetic_key, is_secret
        FROM set_story_chapters
        WHERE set_id = ?
        ORDER BY chapter_no ASC
    ");
    $chapStmt->execute([$setId]);
    $chapters = [];
    foreach ($chapStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $chapterNo = (int) ($row['chapter_no'] ?? 0);
        $unlockPct = (int) ($row['unlock_pct'] ?? 0);
        $claimed = isset($claimedMap[$chapterNo]);
        $unlocked = (int) $progress['completionPct'] >= $unlockPct;
        $rewardCosmeticKey = resolveStorybookRewardCosmeticKey($setId, $chapterNo) ?? ($row['reward_cosmetic_key'] ?: null);
        $quest = null;
        if ($chapterNo === 5) {
            $quest = getChapterFiveQuestProgress($pdo, $userId, $setId);
            $unlocked = $unlocked && (bool) ($quest['allDone'] ?? false);
        }
        $chapters[] = [
            'chapterNo' => $chapterNo,
            'title' => (string) ($row['title'] ?? ''),
            'body' => (string) ($row['body'] ?? ''),
            'unlockPct' => $unlockPct,
            'rewardCoins' => (float) ($row['reward_coins'] ?? 0),
            'rewardCosmeticKey' => $rewardCosmeticKey,
            'isSecret' => (bool) ($row['is_secret'] ?? 0),
            'unlocked' => $unlocked,
            'claimed' => $claimed,
            'canClaim' => $unlocked && !$claimed,
            'questRequirements' => $quest['requirements'] ?? [],
            'questComplete' => $quest['allDone'] ?? true,
            'chapter4Claimed' => $quest['chapter4Claimed'] ?? true,
        ];
    }

    $nextChapterGuide = null;
    foreach ($chapters as $chapter) {
        if ($chapter['claimed']) {
            continue;
        }
        if ((int) $chapter['unlockPct'] <= (int) $progress['completionPct']) {
            continue;
        }
        $requiredOwned = (int) ceil(((int) $progress['total'] * (int) $chapter['unlockPct']) / 100);
        $cardsNeeded = max(0, $requiredOwned - (int) $progress['owned']);
        $missingCards = $cardsNeeded > 0
            ? fetchMissingSetCards($pdo, $userId, $setId, min(24, $cardsNeeded))
            : [];
        $nextChapterGuide = [
            'chapterNo' => (int) $chapter['chapterNo'],
            'title' => (string) $chapter['title'],
            'unlockPct' => (int) $chapter['unlockPct'],
            'cardsNeeded' => $cardsNeeded,
            'missingCards' => $missingCards,
        ];
        break;
    }

    return [
        'setId' => $setId,
        'setName' => $progress['setName'],
        'coverImage' => $progress['coverImage'] ?? null,
        'owned' => (int) $progress['owned'],
        'total' => (int) $progress['total'],
        'completionPct' => (int) $progress['completionPct'],
        'isComplete' => (int) $progress['completionPct'] >= 100,
        'nextChapterGuide' => $nextChapterGuide,
        'chapters' => $chapters,
    ];
}

function claimChapterReward(PDO $pdo, int $userId): void
{
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $setId = trim((string) ($input['setId'] ?? ''));
    $chapterNo = (int) ($input['chapterNo'] ?? 0);
    if ($setId === '' || $chapterNo <= 0) {
        echo json_encode(['success' => false, 'message' => 'Invalid claim payload']);
        return;
    }

    $progressMap = fetchSetProgressMap($pdo, $userId);
    if (!isset($progressMap[$setId])) {
        echo json_encode(['success' => false, 'message' => 'Set not found']);
        return;
    }
    ensureSetStoryChapters($pdo, $setId);

    $stmt = $pdo->prepare("
        SELECT chapter_no, unlock_pct, reward_coins, reward_cosmetic_key
        FROM set_story_chapters
        WHERE set_id = ? AND chapter_no = ?
        LIMIT 1
    ");
    $stmt->execute([$setId, $chapterNo]);
    $chapter = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$chapter) {
        echo json_encode(['success' => false, 'message' => 'Chapter not found']);
        return;
    }
    if ((int) $progressMap[$setId]['completionPct'] < (int) $chapter['unlock_pct']) {
        echo json_encode(['success' => false, 'message' => 'Chapter is still locked']);
        return;
    }
    if ((int) $chapterNo === 5) {
        $quest = getChapterFiveQuestProgress($pdo, $userId, $setId);
        if (!($quest['allDone'] ?? false)) {
            echo json_encode(['success' => false, 'message' => 'Extra chapter quest is not complete yet']);
            return;
        }
    }

    try {
        $pdo->beginTransaction();
        $claim = $pdo->prepare("
            INSERT INTO user_story_claims (user_id, set_id, chapter_no)
            VALUES (?, ?, ?)
        ");
        $claim->execute([$userId, $setId, $chapterNo]);

        if ($chapterNo === 4) {
            captureChapterFiveBaseline($pdo, $userId, $setId);
        }

        $coins = (float) ($chapter['reward_coins'] ?? 0);
        if ($coins > 0) {
            $updateCoins = $pdo->prepare("UPDATE users SET user_coins = user_coins + ? WHERE id = ?");
            $updateCoins->execute([$coins, $userId]);
        }

        $cosmeticKey = resolveStorybookRewardCosmeticKey($setId, $chapterNo) ?? ($chapter['reward_cosmetic_key'] ?? null);
        if ($cosmeticKey) {
            $unlock = $pdo->prepare("INSERT IGNORE INTO user_cosmetics (user_id, cosmetic_key) VALUES (?, ?)");
            $unlock->execute([$userId, $cosmeticKey]);
        }

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        if ((int) ($e->errorInfo[1] ?? 0) === 1062) {
            echo json_encode(['success' => false, 'message' => 'Reward already claimed']);
            return;
        }
        echo json_encode(['success' => false, 'message' => 'Could not claim chapter reward']);
        return;
    }

    echo json_encode([
        'success' => true,
        'coinsAdded' => (float) ($chapter['reward_coins'] ?? 0),
        'cosmeticUnlocked' => resolveStorybookRewardCosmeticKey($setId, $chapterNo) ?? ($chapter['reward_cosmetic_key'] ?: null),
    ]);
}
