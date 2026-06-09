<?php

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (
    $origin !== ''
    && (
        $origin === 'http://localhost:5173'
        || strpos($origin, 'http://localhost') === 0
        || strpos($origin, 'http://127.0.0.1') === 0
    )
) {
    header("Access-Control-Allow-Origin: $origin");
}
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once __DIR__ . '/crates.php';
require_once __DIR__ . '/leaderboard.php';
require "db.php";

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$action = $_GET['action'] ?? '';

try {
    ensureBattleTable($pdo);
    ensureCrateTables($pdo);
} catch (PDOException $e) {
    echo json_encode(["success" => false, "message" => "Database setup failed"]);
    exit;
}

switch ($action) {
    case 'createRoom':
        createRoom($pdo);
        break;
    case 'joinRoom':
        joinRoom($pdo);
        break;
    case 'getRoom':
        getRoom($pdo);
        break;
    case 'cancelRoom':
        cancelRoom($pdo);
        break;
    case 'payEntry':
        payEntry($pdo);
        break;
    case 'submitPulls':
        submitPulls($pdo);
        break;
    case 'startPve':
        startPve($pdo);
        break;
    case 'completePve':
        completePve($pdo);
        break;
    default:
        echo json_encode(["success" => false, "message" => "Invalid action"]);
        break;
}

function ensureBattleTable(PDO $pdo): void
{
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS crate_battle_rooms (
            id INT AUTO_INCREMENT PRIMARY KEY,
            room_code VARCHAR(8) NOT NULL UNIQUE,
            status VARCHAR(20) NOT NULL DEFAULT 'waiting',
            host_id INT NOT NULL,
            guest_id INT NULL,
            host_username VARCHAR(64) NULL,
            guest_username VARCHAR(64) NULL,
            crates_json TEXT NOT NULL,
            wager_total DECIMAL(12,2) NOT NULL,
            host_paid TINYINT(1) NOT NULL DEFAULT 0,
            guest_paid TINYINT(1) NOT NULL DEFAULT 0,
            host_pulls_json TEXT NULL,
            guest_pulls_json TEXT NULL,
            host_total_value DECIMAL(12,2) NULL,
            guest_total_value DECIMAL(12,2) NULL,
            winner_id INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_room_code (room_code),
            INDEX idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
}

function requireLogin(): ?int
{
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(["success" => false, "message" => "Not logged in"]);
        return null;
    }
    return (int) $_SESSION['user_id'];
}

/** Safe json_decode for nullable DB columns (PHP 8.1+). */
function decodeJsonField($value): array
{
    if ($value === null || $value === '') {
        return [];
    }

    if (is_array($value)) {
        return $value;
    }

    $decoded = json_decode((string) $value, true);
    return is_array($decoded) ? $decoded : [];
}

function normalizeCrates(PDO $pdo, array $crates): array
{
    $catalog = getCrateCatalogMap($pdo);
    if (!$catalog) {
        return [];
    }

    $normalized = [];

    foreach ($crates as $crate) {
        if (!is_array($crate)) {
            continue;
        }

        $id = trim((string) ($crate['id'] ?? $crate['tier'] ?? ''));
        if ($id === '' || !isset($catalog[$id])) {
            continue;
        }

        $entry = $catalog[$id];
        $normalized[] = [
            'id' => $entry['id'],
            'tier' => $entry['tier'],
            'price' => $entry['price']
        ];
    }

    return $normalized;
}

function wagerFromCrates(array $crates): float
{
    $sum = 0;
    foreach ($crates as $crate) {
        $sum += (float) $crate['price'];
    }
    return round($sum, 2);
}

function pullValue(array $pull): float
{
    return round(max(0, (float) ($pull['price'] ?? 0)), 2);
}

function sumPullValues(array $pulls): float
{
    $sum = 0;
    foreach ($pulls as $pull) {
        $sum += pullValue($pull);
    }
    return round($sum, 2);
}

function generateRoomCode(PDO $pdo): string
{
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for ($attempt = 0; $attempt < 20; $attempt++) {
        $code = '';
        for ($i = 0; $i < 6; $i++) {
            $code .= $chars[random_int(0, strlen($chars) - 1)];
        }
        $stmt = $pdo->prepare("SELECT id FROM crate_battle_rooms WHERE room_code = ? LIMIT 1");
        $stmt->execute([$code]);
        if (!$stmt->fetch()) {
            return $code;
        }
    }
    return strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));
}

function getUsername(PDO $pdo, int $userId): string
{
    $stmt = $pdo->prepare("SELECT username FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    return $row['username'] ?? 'Trainer';
}

function refundCoins(PDO $pdo, int $userId, float $amount): void
{
    if ($amount <= 0) {
        return;
    }

    $stmt = $pdo->prepare("UPDATE users SET user_coins = user_coins + ? WHERE id = ?");
    $stmt->execute([$amount, $userId]);
}

function deductCoins(PDO $pdo, int $userId, float $amount): array
{
    $stmt = $pdo->prepare("SELECT user_coins FROM users WHERE id = ? FOR UPDATE");
    $stmt->execute([$userId]);
    $row = $stmt->fetch();

    if (!$row) {
        return ["success" => false, "message" => "User not found"];
    }

    $balance = (float) $row['user_coins'];
    if ($balance < $amount) {
        return [
            "success" => false,
            "message" => "Not enough coins",
            "coins" => round($balance, 2)
        ];
    }

    $stmt = $pdo->prepare("UPDATE users SET user_coins = user_coins - ? WHERE id = ?");
    $stmt->execute([$amount, $userId]);
    recordUserWager($pdo, $userId, $amount);

    $stmt = $pdo->prepare("SELECT user_coins FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $updated = $stmt->fetch();

    return [
        "success" => true,
        "coins" => round((float) ($updated['user_coins'] ?? 0), 2)
    ];
}

function addCardsToUser(PDO $pdo, int $userId, array $pulls): void
{
    foreach ($pulls as $pull) {
        $cardId = $pull['id'] ?? null;
        if (!$cardId) {
            continue;
        }

        $stmt = $pdo->prepare("
            SELECT card_amount FROM user_cards
            WHERE user_id = ? AND card_id = ?
        ");
        $stmt->execute([$userId, $cardId]);
        $row = $stmt->fetch();

        if ($row) {
            $stmt = $pdo->prepare("
                UPDATE user_cards SET card_amount = card_amount + 1
                WHERE user_id = ? AND card_id = ?
            ");
            $stmt->execute([$userId, $cardId]);
        } else {
            $stmt = $pdo->prepare("
                INSERT INTO user_cards (user_id, card_id, card_amount)
                VALUES (?, ?, 1)
            ");
            $stmt->execute([$userId, $cardId]);
        }
    }
}

function roomPayload(array $room, int $viewerId): array
{
    $hostId = (int) $room['host_id'];
    $guestId = $room['guest_id'] ? (int) $room['guest_id'] : null;
    $isHost = $viewerId === $hostId;
    $isGuest = $guestId && $viewerId === $guestId;

    return [
        "code" => $room['room_code'],
        "status" => $room['status'],
        "wagerTotal" => round((float) $room['wager_total'], 2),
        "crates" => decodeJsonField($room['crates_json'] ?? null),
        "host" => [
            "id" => $hostId,
            "username" => $room['host_username'],
            "paid" => (bool) $room['host_paid'],
            "totalValue" => $room['host_total_value'] !== null
                ? round((float) $room['host_total_value'], 2) : null,
            "pulls" => !empty($room['host_pulls_json'])
                ? decodeJsonField($room['host_pulls_json']) : [],
            "pullsSubmitted" => !empty($room['host_pulls_json'])
        ],
        "guest" => $guestId ? [
            "id" => $guestId,
            "username" => $room['guest_username'],
            "paid" => (bool) $room['guest_paid'],
            "totalValue" => $room['guest_total_value'] !== null
                ? round((float) $room['guest_total_value'], 2) : null,
            "pulls" => !empty($room['guest_pulls_json'])
                ? decodeJsonField($room['guest_pulls_json']) : [],
            "pullsSubmitted" => !empty($room['guest_pulls_json'])
        ] : null,
        "winnerId" => $room['winner_id'] ? (int) $room['winner_id'] : null,
        "youAreHost" => $isHost,
        "youAreGuest" => $isGuest
    ];
}

function createRoom(PDO $pdo): void
{
    $userId = requireLogin();
    if ($userId === null) {
        return;
    }

    $input = readJsonBody();
    $crates = normalizeCrates($pdo, $input['crates'] ?? []);
    if (count($crates) < 1 || count($crates) > 5) {
        echo json_encode(["success" => false, "message" => "Select 1 to 5 crates"]);
        return;
    }

    $wager = wagerFromCrates($crates);
    if ($wager <= 0) {
        echo json_encode(["success" => false, "message" => "Invalid wager"]);
        return;
    }

    purgeFinishedBattleRooms($pdo);

    $code = generateRoomCode($pdo);
    $username = getUsername($pdo, $userId);

    $stmt = $pdo->prepare("
        INSERT INTO crate_battle_rooms
        (room_code, status, host_id, host_username, crates_json, wager_total)
        VALUES (?, 'waiting', ?, ?, ?, ?)
    ");
    $stmt->execute([
        $code,
        $userId,
        $username,
        json_encode($crates),
        $wager
    ]);

    $stmt = $pdo->prepare("SELECT * FROM crate_battle_rooms WHERE room_code = ?");
    $stmt->execute([$code]);
    $room = $stmt->fetch();

    echo json_encode([
        "success" => true,
        "room" => $room ? roomPayload($room, $userId) : [
            "code" => $code,
            "status" => "waiting",
            "wagerTotal" => $wager,
            "crates" => $crates,
            "host" => ["id" => $userId, "username" => $username],
            "youAreHost" => true
        ]
    ]);
}

function joinRoom(PDO $pdo): void
{
    $userId = requireLogin();
    if ($userId === null) {
        return;
    }

    $input = readJsonBody();
    $code = strtoupper(trim($input['code'] ?? ''));
    if ($code === '') {
        echo json_encode(["success" => false, "message" => "Room code required"]);
        return;
    }

    $stmt = $pdo->prepare("SELECT * FROM crate_battle_rooms WHERE room_code = ? LIMIT 1");
    $stmt->execute([$code]);
    $room = $stmt->fetch();

    if (!$room) {
        echo json_encode(["success" => false, "message" => "Room not found"]);
        return;
    }

    if ($room['status'] !== 'waiting') {
        echo json_encode(["success" => false, "message" => "Room is no longer available"]);
        return;
    }

    if ((int) $room['host_id'] === $userId) {
        echo json_encode([
            "success" => true,
            "room" => roomPayload($room, $userId)
        ]);
        return;
    }

    if ($room['guest_id'] && (int) $room['guest_id'] !== $userId) {
        echo json_encode(["success" => false, "message" => "Room is full"]);
        return;
    }

    if (!$room['guest_id']) {
        $username = getUsername($pdo, $userId);
        $stmt = $pdo->prepare("
            UPDATE crate_battle_rooms
            SET guest_id = ?, guest_username = ?, status = 'ready'
            WHERE id = ? AND guest_id IS NULL
        ");
        $stmt->execute([$userId, $username, $room['id']]);

        $stmt = $pdo->prepare("SELECT * FROM crate_battle_rooms WHERE id = ?");
        $stmt->execute([$room['id']]);
        $room = $stmt->fetch();
    }

    echo json_encode([
        "success" => true,
        "room" => roomPayload($room, $userId)
    ]);
}

function getRoom(PDO $pdo): void
{
    $userId = requireLogin();
    if ($userId === null) {
        return;
    }

    $code = strtoupper(trim($_GET['code'] ?? ''));
    if ($code === '') {
        echo json_encode(["success" => false, "message" => "Room code required"]);
        return;
    }

    $stmt = $pdo->prepare("SELECT * FROM crate_battle_rooms WHERE room_code = ? LIMIT 1");
    $stmt->execute([$code]);
    $room = $stmt->fetch();

    if (!$room) {
        echo json_encode(["success" => false, "message" => "Room not found"]);
        return;
    }

    $hostId = (int) $room['host_id'];
    $guestId = $room['guest_id'] ? (int) $room['guest_id'] : null;
    if ($userId !== $hostId && $userId !== $guestId) {
        echo json_encode(["success" => false, "message" => "You are not in this battle"]);
        return;
    }

    $payload = roomPayload($room, $userId);

    if ($room['status'] === 'finished') {
        deleteBattleRoom($pdo, (int) $room['id']);
    }

    echo json_encode([
        "success" => true,
        "room" => $payload
    ]);
}

function deleteBattleRoom(PDO $pdo, int $roomId): void
{
    $stmt = $pdo->prepare("DELETE FROM crate_battle_rooms WHERE id = ?");
    $stmt->execute([$roomId]);
}

function cancelRoom(PDO $pdo): void
{
    $userId = requireLogin();
    if ($userId === null) {
        return;
    }

    $input = readJsonBody();
    $code = strtoupper(trim($input['code'] ?? ''));
    if ($code === '') {
        echo json_encode(["success" => false, "message" => "Room code required"]);
        return;
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("SELECT * FROM crate_battle_rooms WHERE room_code = ? FOR UPDATE");
        $stmt->execute([$code]);
        $room = $stmt->fetch();

        if (!$room) {
            $pdo->rollBack();
            echo json_encode(["success" => false, "message" => "Room not found"]);
            return;
        }

        $hostId = (int) $room['host_id'];
        $guestId = $room['guest_id'] ? (int) $room['guest_id'] : null;

        if ($userId !== $hostId) {
            $pdo->rollBack();
            echo json_encode(["success" => false, "message" => "Only the host can cancel this room"]);
            return;
        }

        $status = $room['status'];
        if ($status === 'opening' || $status === 'finished') {
            $pdo->rollBack();
            echo json_encode(["success" => false, "message" => "This battle can no longer be cancelled"]);
            return;
        }

        $wager = round((float) $room['wager_total'], 2);

        if ($room['host_paid']) {
            refundCoins($pdo, $hostId, $wager);
        }
        if ($guestId && $room['guest_paid']) {
            refundCoins($pdo, $guestId, $wager);
        }

        deleteBattleRoom($pdo, (int) $room['id']);
        $pdo->commit();

        $stmt = $pdo->prepare("SELECT user_coins FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $row = $stmt->fetch();

        echo json_encode([
            "success" => true,
            "coins" => round((float) ($row['user_coins'] ?? 0), 2)
        ]);
    } catch (Exception $e) {
        $pdo->rollBack();
        echo json_encode(["success" => false, "message" => "Could not cancel room"]);
    }
}

function purgeFinishedBattleRooms(PDO $pdo): void
{
    $pdo->exec("
        DELETE FROM crate_battle_rooms
        WHERE status = 'finished'
           OR (status IN ('waiting', 'ready') AND created_at < NOW() - INTERVAL 24 HOUR)
    ");
}

function payEntry(PDO $pdo): void
{
    $userId = requireLogin();
    if ($userId === null) {
        return;
    }

    $input = readJsonBody();
    $code = strtoupper(trim($input['code'] ?? ''));

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("SELECT * FROM crate_battle_rooms WHERE room_code = ? FOR UPDATE");
        $stmt->execute([$code]);
        $room = $stmt->fetch();

        if (!$room) {
            $pdo->rollBack();
            echo json_encode(["success" => false, "message" => "Room not found"]);
            return;
        }

        $hostId = (int) $room['host_id'];
        $guestId = $room['guest_id'] ? (int) $room['guest_id'] : null;
        $wager = round((float) $room['wager_total'], 2);

        if ($userId !== $hostId && $userId !== $guestId) {
            $pdo->rollBack();
            echo json_encode(["success" => false, "message" => "You are not in this battle"]);
            return;
        }

        if (!$guestId) {
            $pdo->rollBack();
            echo json_encode(["success" => false, "message" => "Waiting for opponent"]);
            return;
        }

        $paidField = $userId === $hostId ? 'host_paid' : 'guest_paid';
        if ((bool) $room[$paidField]) {
            $pdo->commit();
            echo json_encode([
                "success" => true,
                "alreadyPaid" => true,
                "coins" => null,
                "room" => roomPayload($room, $userId)
            ]);
            return;
        }

        $payResult = deductCoins($pdo, $userId, $wager);
        if (!$payResult['success']) {
            $pdo->rollBack();
            echo json_encode($payResult);
            return;
        }

        $column = $userId === $hostId ? 'host_paid' : 'guest_paid';
        $stmt = $pdo->prepare("UPDATE crate_battle_rooms SET {$column} = 1 WHERE id = ?");
        $stmt->execute([$room['id']]);

        $stmt = $pdo->prepare("SELECT * FROM crate_battle_rooms WHERE id = ?");
        $stmt->execute([$room['id']]);
        $room = $stmt->fetch();

        if ($room['host_paid'] && $room['guest_paid']) {
            $stmt = $pdo->prepare("UPDATE crate_battle_rooms SET status = 'opening' WHERE id = ?");
            $stmt->execute([$room['id']]);
            $stmt = $pdo->prepare("SELECT * FROM crate_battle_rooms WHERE id = ?");
            $stmt->execute([$room['id']]);
            $room = $stmt->fetch();
        }

        $pdo->commit();

        echo json_encode([
            "success" => true,
            "coins" => $payResult['coins'],
            "room" => roomPayload($room, $userId)
        ]);
    } catch (Exception $e) {
        $pdo->rollBack();
        echo json_encode(["success" => false, "message" => "Payment failed"]);
    }
}

function tryFinishPvpRoom(PDO $pdo, array $room): ?array
{
    if ($room['status'] === 'finished') {
        return $room;
    }

    if (!$room['host_pulls_json'] || !$room['guest_pulls_json']) {
        return null;
    }

    $hostPulls = decodeJsonField($room['host_pulls_json'] ?? null);
    $guestPulls = decodeJsonField($room['guest_pulls_json'] ?? null);
    $hostValue = sumPullValues($hostPulls);
    $guestValue = sumPullValues($guestPulls);

    $hostId = (int) $room['host_id'];
    $guestId = (int) $room['guest_id'];

    if ($hostValue > $guestValue) {
        $winnerId = $hostId;
    } elseif ($guestValue > $hostValue) {
        $winnerId = $guestId;
    } else {
        $winnerId = random_int(0, 1) === 0 ? $hostId : $guestId;
    }

    $allPulls = array_merge($hostPulls, $guestPulls);
    addCardsToUser($pdo, $winnerId, $allPulls);
    recordUserWin($pdo, $winnerId, sumPullValues($allPulls));
    require_once __DIR__ . '/progression.php';
    progressionOnBattleWin($pdo, $winnerId);

    $stmt = $pdo->prepare("
        UPDATE crate_battle_rooms
        SET status = 'finished',
            host_total_value = ?,
            guest_total_value = ?,
            winner_id = ?
        WHERE id = ?
    ");
    $stmt->execute([$hostValue, $guestValue, $winnerId, $room['id']]);

    $stmt = $pdo->prepare("SELECT * FROM crate_battle_rooms WHERE id = ?");
    $stmt->execute([$room['id']]);
    return $stmt->fetch();
}

function submitPulls(PDO $pdo): void
{
    $userId = requireLogin();
    if ($userId === null) {
        return;
    }

    $input = readJsonBody();
    $code = strtoupper(trim($input['code'] ?? ''));
    $pulls = $input['pulls'] ?? [];

    if (!is_array($pulls) || !count($pulls)) {
        echo json_encode(["success" => false, "message" => "Pulls required"]);
        return;
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("SELECT * FROM crate_battle_rooms WHERE room_code = ? FOR UPDATE");
        $stmt->execute([$code]);
        $room = $stmt->fetch();

        if (!$room) {
            $pdo->rollBack();
            echo json_encode(["success" => false, "message" => "Room not found"]);
            return;
        }

        if ($room['status'] !== 'opening' && $room['status'] !== 'finished') {
            $pdo->rollBack();
            echo json_encode(["success" => false, "message" => "Battle not ready for pulls"]);
            return;
        }

        $hostId = (int) $room['host_id'];
        $guestId = (int) $room['guest_id'];
        $isHost = $userId === $hostId;
        $isGuest = $guestId && $userId === $guestId;

        if (!$isHost && !$isGuest) {
            $pdo->rollBack();
            echo json_encode(["success" => false, "message" => "You are not in this battle"]);
            return;
        }

        $column = $isHost ? 'host_pulls_json' : 'guest_pulls_json';
        if ($room[$column]) {
            $pdo->commit();
            echo json_encode([
                "success" => true,
                "alreadySubmitted" => true,
                "room" => roomPayload($room, $userId)
            ]);
            return;
        }

        $stmt = $pdo->prepare("UPDATE crate_battle_rooms SET {$column} = ? WHERE id = ?");
        $stmt->execute([json_encode($pulls), $room['id']]);

        $stmt = $pdo->prepare("SELECT * FROM crate_battle_rooms WHERE id = ?");
        $stmt->execute([$room['id']]);
        $room = $stmt->fetch();

        $finished = tryFinishPvpRoom($pdo, $room);
        if ($finished) {
            $room = $finished;
        }

        $pdo->commit();

        echo json_encode([
            "success" => true,
            "room" => roomPayload($room, $userId)
        ]);
    } catch (Exception $e) {
        $pdo->rollBack();
        echo json_encode(["success" => false, "message" => "Could not submit pulls"]);
    }
}

function startPve(PDO $pdo): void
{
    $userId = requireLogin();
    if ($userId === null) {
        return;
    }

    $input = readJsonBody();
    $crates = normalizeCrates($pdo, $input['crates'] ?? []);
    if (count($crates) < 1 || count($crates) > 5) {
        echo json_encode(["success" => false, "message" => "Select 1 to 5 crates"]);
        return;
    }

    $wager = wagerFromCrates($crates);
    if ($wager <= 0) {
        echo json_encode(["success" => false, "message" => "Invalid wager"]);
        return;
    }

    $pdo->beginTransaction();
    try {
        $payResult = deductCoins($pdo, $userId, $wager);
        if (!$payResult['success']) {
            $pdo->rollBack();
            echo json_encode($payResult);
            return;
        }

        $token = bin2hex(random_bytes(16));
        $_SESSION['pve_battle'] = [
            'token' => $token,
            'wager' => $wager,
            'crates' => $crates,
            'created' => time()
        ];

        $pdo->commit();

        echo json_encode([
            "success" => true,
            "token" => $token,
            "wager" => $wager,
            "crates" => $crates,
            "coins" => $payResult['coins']
        ]);
    } catch (Exception $e) {
        $pdo->rollBack();
        echo json_encode(["success" => false, "message" => "Could not start battle"]);
    }
}

function completePve(PDO $pdo): void
{
    $userId = requireLogin();
    if ($userId === null) {
        return;
    }

    $input = readJsonBody();
    $token = $input['token'] ?? '';
    $playerPulls = $input['playerPulls'] ?? [];
    $opponentPulls = $input['opponentPulls'] ?? [];

    $sessionBattle = $_SESSION['pve_battle'] ?? null;
    if (!$sessionBattle || ($sessionBattle['token'] ?? '') !== $token) {
        echo json_encode(["success" => false, "message" => "Invalid or expired battle"]);
        return;
    }

    if (time() - (int) ($sessionBattle['created'] ?? 0) > 3600) {
        unset($_SESSION['pve_battle']);
        echo json_encode(["success" => false, "message" => "Battle expired"]);
        return;
    }

    $expectedCrates = count($sessionBattle['crates'] ?? []);
    if (count($playerPulls) !== $expectedCrates || count($opponentPulls) !== $expectedCrates) {
        echo json_encode(["success" => false, "message" => "Pull count mismatch"]);
        return;
    }

    $playerValue = sumPullValues($playerPulls);
    $opponentValue = sumPullValues($opponentPulls);

    if ($playerValue > $opponentValue) {
        $outcome = 'win';
        $winnerId = $userId;
    } elseif ($opponentValue > $playerValue) {
        $outcome = 'lose';
        $winnerId = null;
    } else {
        $outcome = random_int(0, 1) === 0 ? 'win' : 'lose';
        $winnerId = $outcome === 'win' ? $userId : null;
    }

    $allPulls = array_merge($playerPulls, $opponentPulls);
    if ($outcome === 'win') {
        addCardsToUser($pdo, $userId, $allPulls);
        recordUserWin($pdo, $userId, sumPullValues($allPulls));
        require_once __DIR__ . '/progression.php';
        progressionOnBattleWin($pdo, $userId);
    }

    unset($_SESSION['pve_battle']);

    $stmt = $pdo->prepare("SELECT user_coins FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $row = $stmt->fetch();

    echo json_encode([
        "success" => true,
        "outcome" => $outcome,
        "playerValue" => $playerValue,
        "opponentValue" => $opponentValue,
        "winnerId" => $winnerId,
        "coins" => round((float) ($row['user_coins'] ?? 0), 2),
        "cardsWon" => $outcome === 'win' ? count($allPulls) : 0
    ]);
}
