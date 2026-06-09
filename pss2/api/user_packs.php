<?php

ini_set('display_errors', '0');
error_reporting(E_ALL);

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
require_once 'db.php';
require_once __DIR__ . '/leaderboard.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode([
        "success" => false,
        "message" => "Not logged in"
    ]);
    exit;
}

$action = $_GET['action'] ?? 'list';
$userId = (int) $_SESSION['user_id'];
$columns = [];
try {
    $columns = resolveUserPacksColumns($pdo);
} catch (Exception $e) {
    echo json_encode([
        "success" => false,
        "message" => "Could not inspect user_packs table"
    ]);
    exit;
}

if (!in_array('id', $columns, true) || !in_array('user_id', $columns, true)) {
    echo json_encode([
        "success" => false,
        "message" => "user_packs table must contain id and user_id"
    ]);
    exit;
}

switch ($action) {
    case 'buy':
        buyPack($pdo, $userId, $columns);
        break;
    case 'consume':
        consumePack($pdo, $userId, $columns);
        break;
    case 'list':
    default:
        listPacks($pdo, $userId, $columns);
        break;
}

function hasColumn($columns, $name)
{
    return in_array($name, $columns, true);
}

function resolveUserPacksColumns($pdo)
{
    $stmt = $pdo->query("SHOW COLUMNS FROM user_packs");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $columns = [];
    foreach ($rows as $row) {
        if (isset($row['Field'])) {
            $columns[] = $row['Field'];
        }
    }
    return $columns;
}

function buildPackPayloadFromRow($row, $columns)
{
    $packUuid = hasColumn($columns, 'pack_uuid') ? ($row['pack_uuid'] ?? null) : null;
    $setId = hasColumn($columns, 'set_id') ? ($row['set_id'] ?? null) : null;
    $tcgdexSetId = hasColumn($columns, 'tcgdex_set_id') ? ($row['tcgdex_set_id'] ?? null) : null;
    $setName = hasColumn($columns, 'set_name') ? ($row['set_name'] ?? null) : null;
    $createdAt = hasColumn($columns, 'created_at') ? ($row['created_at'] ?? null) : null;

    return [
        "id" => (int) $row['id'],
        "pack_uuid" => $packUuid,
        "set_id" => $setId,
        "tcgdex_set_id" => $tcgdexSetId,
        "set_name" => $setName ?: ($tcgdexSetId ?: 'Saved pack'),
        "created_at" => $createdAt
    ];
}

function listPacks($pdo, $userId, $columns)
{
    $selectParts = ['id'];
    if (hasColumn($columns, 'pack_uuid'))
        $selectParts[] = 'pack_uuid';
    if (hasColumn($columns, 'set_id'))
        $selectParts[] = 'set_id';
    if (hasColumn($columns, 'tcgdex_set_id'))
        $selectParts[] = 'tcgdex_set_id';
    if (hasColumn($columns, 'set_name'))
        $selectParts[] = 'set_name';
    if (hasColumn($columns, 'created_at'))
        $selectParts[] = 'created_at';

    $orderBy = hasColumn($columns, 'created_at') ? 'created_at DESC, id DESC' : 'id DESC';
    $stmt = $pdo->prepare("
        SELECT " . implode(', ', $selectParts) . "
        FROM user_packs
        WHERE user_id = ?
        ORDER BY {$orderBy}
    ");
    $stmt->execute([$userId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $packs = array_map(function ($row) use ($columns) {
        return buildPackPayloadFromRow($row, $columns);
    }, $rows);

    echo json_encode([
        "success" => true,
        "packs" => $packs
    ]);
}

function buyPack($pdo, $userId, $columns)
{
    $input = json_decode(file_get_contents("php://input"), true) ?: [];
    $amount = round((float) ($input['amount'] ?? 0), 2);
    $tcgdexSetId = trim((string) ($input['tcgdex_set_id'] ?? ''));
    $setName = trim((string) ($input['set_name'] ?? ''));

    if ($amount <= 0 || !$tcgdexSetId) {
        echo json_encode([
            "success" => false,
            "message" => "Invalid pack data"
        ]);
        return;
    }

    try {
        $pdo->beginTransaction();

        $stmt = $pdo->prepare("SELECT user_coins FROM users WHERE id = ? FOR UPDATE");
        $stmt->execute([$userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            $pdo->rollBack();
            echo json_encode([
                "success" => false,
                "message" => "User not found"
            ]);
            return;
        }

        $balance = (float) $row['user_coins'];
        if ($balance < $amount) {
            $pdo->rollBack();
            echo json_encode([
                "success" => false,
                "message" => "Not enough coins",
                "coins" => round($balance, 2)
            ]);
            return;
        }

        $stmt = $pdo->prepare("
            UPDATE users
            SET user_coins = user_coins - ?
            WHERE id = ?
        ");
        $stmt->execute([$amount, $userId]);
        recordUserWager($pdo, $userId, $amount);

        $insertColumns = ['user_id'];
        $insertValues = [$userId];
        $placeholders = ['?'];

        if (hasColumn($columns, 'pack_uuid')) {
            $insertColumns[] = 'pack_uuid';
            $insertValues[] = uniqid('pack_', true);
            $placeholders[] = '?';
        }
        if (hasColumn($columns, 'set_id')) {
            $insertColumns[] = 'set_id';
            $insertValues[] = $tcgdexSetId;
            $placeholders[] = '?';
        }
        if (hasColumn($columns, 'tcgdex_set_id')) {
            $insertColumns[] = 'tcgdex_set_id';
            $insertValues[] = $tcgdexSetId;
            $placeholders[] = '?';
        }
        if (hasColumn($columns, 'set_name')) {
            $insertColumns[] = 'set_name';
            $insertValues[] = $setName ?: $tcgdexSetId;
            $placeholders[] = '?';
        }

        $stmt = $pdo->prepare("
            INSERT INTO user_packs (" . implode(', ', $insertColumns) . ")
            VALUES (" . implode(', ', $placeholders) . ")
        ");
        $stmt->execute($insertValues);
        $packId = (int) $pdo->lastInsertId();

        $stmt = $pdo->prepare("SELECT user_coins FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $updated = $stmt->fetch(PDO::FETCH_ASSOC);

        $pdo->commit();

        echo json_encode([
            "success" => true,
            "message" => "Pack bought",
            "coins" => round((float) ($updated['user_coins'] ?? 0), 2),
            "pack" => [
                "id" => $packId,
                "pack_uuid" => hasColumn($columns, 'pack_uuid') ? ($insertValues[array_search('pack_uuid', $insertColumns, true)] ?? null) : null,
                "set_id" => hasColumn($columns, 'set_id') ? $tcgdexSetId : null,
                "tcgdex_set_id" => $tcgdexSetId,
                "set_name" => $setName ?: $tcgdexSetId
            ]
        ]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        echo json_encode([
            "success" => false,
            "message" => "Could not buy pack"
        ]);
    }
}

function consumePack($pdo, $userId, $columns)
{
    $input = json_decode(file_get_contents("php://input"), true) ?: [];
    $packId = (int) ($input['id'] ?? 0);

    if ($packId <= 0) {
        echo json_encode([
            "success" => false,
            "message" => "Missing pack id"
        ]);
        return;
    }

    try {
        $pdo->beginTransaction();

        $selectParts = ['id'];
        if (hasColumn($columns, 'pack_uuid'))
            $selectParts[] = 'pack_uuid';
        if (hasColumn($columns, 'set_id'))
            $selectParts[] = 'set_id';
        if (hasColumn($columns, 'tcgdex_set_id'))
            $selectParts[] = 'tcgdex_set_id';
        if (hasColumn($columns, 'set_name'))
            $selectParts[] = 'set_name';
        if (hasColumn($columns, 'created_at'))
            $selectParts[] = 'created_at';

        $stmt = $pdo->prepare("
            SELECT " . implode(', ', $selectParts) . "
            FROM user_packs
            WHERE id = ? AND user_id = ?
            FOR UPDATE
        ");
        $stmt->execute([$packId, $userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            $pdo->rollBack();
            echo json_encode([
                "success" => false,
                "message" => "Pack not found"
            ]);
            return;
        }

        $stmt = $pdo->prepare("DELETE FROM user_packs WHERE id = ? AND user_id = ?");
        $stmt->execute([$packId, $userId]);

        $pdo->commit();

        echo json_encode([
            "success" => true,
            "pack" => buildPackPayloadFromRow($row, $columns)
        ]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        echo json_encode([
            "success" => false,
            "message" => "Could not open pack"
        ]);
    }
}
