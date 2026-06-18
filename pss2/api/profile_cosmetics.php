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

ensureStorybookTables($pdo);

$action = $_GET['action'] ?? 'inventory';
switch ($action) {
    case 'equip':
        equipCosmetic($pdo);
        break;
    case 'showcase':
        getShowcase($pdo);
        break;
    case 'inventory':
    default:
        getInventory($pdo);
        break;
}

function getInventory(PDO $pdo): void
{
    $userId = (int) ($_SESSION['user_id'] ?? 0);
    if ($userId <= 0) {
        echo json_encode(['success' => false, 'message' => 'Not logged in']);
        return;
    }
    ensureStarterCosmeticsUnlocked($pdo, $userId);
    $stmt = $pdo->prepare("
        SELECT
            c.cosmetic_key, c.type, c.name, c.description, c.rarity, c.animation, c.source_type, c.source_ref,
            uc.unlocked_at
        FROM cosmetics c
        LEFT JOIN user_cosmetics uc
            ON uc.cosmetic_key = c.cosmetic_key
           AND uc.user_id = ?
        ORDER BY FIELD(c.rarity, 'legendary','epic','rare','common'), c.type, c.name
    ");
    $stmt->execute([$userId]);
    $items = array_map(static function (array $row): array {
        $row['unlocked'] = !empty($row['unlocked_at']);
        return $row;
    }, $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
    foreach ($items as &$item) {
        $sourceType = (string) ($item['source_type'] ?? '');
        $sourceRef = (string) ($item['source_ref'] ?? '');
        if ($sourceType === 'storybook') {
            $item['source_label'] = storybookSourceLabelForCosmetic($pdo, (string) ($item['cosmetic_key'] ?? ''), $sourceRef);
        } elseif ($sourceType === 'event') {
            $item['source_label'] = 'Source: Event reward';
        } elseif ($sourceType === 'starter') {
            $item['source_label'] = 'Source: Starter unlock';
        } else {
            $item['source_label'] = 'Source: Profile cosmetics';
        }
    }
    unset($item);
    $loadout = fetchUserLoadout($pdo, $userId);
    echo json_encode([
        'success' => true,
        'owned' => $items,
        'loadout' => $loadout,
    ]);
}

function getShowcase(PDO $pdo): void
{
    $profileId = (int) ($_GET['id'] ?? 0);
    if ($profileId <= 0) {
        $profileId = (int) ($_SESSION['user_id'] ?? 0);
    }
    if ($profileId <= 0) {
        echo json_encode(['success' => false, 'message' => 'Missing user id']);
        return;
    }

    $loadout = fetchUserLoadout($pdo, $profileId);
    $allKeys = array_filter(array_merge(
        [$loadout['title'], $loadout['banner'], $loadout['frame'], $loadout['cardback']],
        $loadout['badges']
    ));
    if (!$allKeys) {
        echo json_encode(['success' => true, 'loadout' => $loadout, 'items' => []]);
        return;
    }
    $placeholders = implode(',', array_fill(0, count($allKeys), '?'));
    $stmt = $pdo->prepare("SELECT cosmetic_key, type, name, rarity, animation FROM cosmetics WHERE cosmetic_key IN ($placeholders)");
    $stmt->execute(array_values($allKeys));
    echo json_encode([
        'success' => true,
        'loadout' => $loadout,
        'items' => $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [],
    ]);
}

function equipCosmetic(PDO $pdo): void
{
    $userId = (int) ($_SESSION['user_id'] ?? 0);
    if ($userId <= 0) {
        echo json_encode(['success' => false, 'message' => 'Not logged in']);
        return;
    }
    ensureStarterCosmeticsUnlocked($pdo, $userId);

    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $slot = (string) ($input['slot'] ?? '');
    $cosmeticKey = $input['cosmeticKey'] ?? null;
    if (!is_null($cosmeticKey)) {
        $cosmeticKey = (string) $cosmeticKey;
    }
    $validSlots = ['title', 'banner', 'frame', 'cardback', 'badge1', 'badge2', 'badge3'];
    if (!in_array($slot, $validSlots, true)) {
        echo json_encode(['success' => false, 'message' => 'Invalid slot']);
        return;
    }

    if ($cosmeticKey !== null && $cosmeticKey !== '') {
        $stmt = $pdo->prepare("
            SELECT c.type
            FROM user_cosmetics uc
            INNER JOIN cosmetics c ON c.cosmetic_key = uc.cosmetic_key
            WHERE uc.user_id = ? AND uc.cosmetic_key = ?
            LIMIT 1
        ");
        $stmt->execute([$userId, $cosmeticKey]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            echo json_encode(['success' => false, 'message' => 'Cosmetic not unlocked']);
            return;
        }
        $type = (string) $row['type'];
        $typeMap = [
            'title' => 'title',
            'banner' => 'banner',
            'frame' => 'frame',
            'cardback' => 'cardback',
            'badge1' => 'badge',
            'badge2' => 'badge',
            'badge3' => 'badge',
        ];
        if ($typeMap[$slot] !== $type) {
            echo json_encode(['success' => false, 'message' => 'Wrong cosmetic type for this slot']);
            return;
        }
    } else {
        $cosmeticKey = null;
    }

    saveLoadoutSlot($pdo, $userId, $slot, $cosmeticKey);
    echo json_encode([
        'success' => true,
        'loadout' => fetchUserLoadout($pdo, $userId),
    ]);
}
