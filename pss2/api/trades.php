<?php

function ensureUsersPrimaryKeyForTrades(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }

    try {
        $keys = $pdo->query("SHOW KEYS FROM users WHERE Key_name = 'PRIMARY'")->fetchAll();
        if (!$keys) {
            $pdo->exec('ALTER TABLE users ADD PRIMARY KEY (id)');
        }
    } catch (PDOException $e) {
        // Older databases may not allow adding a PK; trades still work without FK constraints.
    }

    $done = true;
}

function ensureTradeTables(PDO $pdo): void
{
    ensureUsersPrimaryKeyForTrades($pdo);

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS trades (
            id INT AUTO_INCREMENT PRIMARY KEY,
            initiator_id INT NOT NULL,
            receiver_id INT NOT NULL,
            status ENUM('pending','negotiating','completed','declined','cancelled') NOT NULL DEFAULT 'pending',
            initiator_coins DECIMAL(14,2) NOT NULL DEFAULT 0,
            receiver_coins DECIMAL(14,2) NOT NULL DEFAULT 0,
            initiator_ready TINYINT(1) NOT NULL DEFAULT 0,
            receiver_ready TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            completed_at TIMESTAMP NULL,
            INDEX idx_trade_initiator (initiator_id, status),
            INDEX idx_trade_receiver (receiver_id, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS trade_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            trade_id INT NOT NULL,
            user_id INT NOT NULL,
            card_id VARCHAR(64) NOT NULL,
            quantity INT NOT NULL DEFAULT 1,
            unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
            UNIQUE KEY uq_trade_user_card (trade_id, user_id, card_id),
            INDEX idx_trade_items_trade (trade_id),
            INDEX idx_trade_items_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    migrateTradeStatusColumn($pdo);
}

function migrateTradeStatusColumn(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }

    try {
        $stmt = $pdo->query("SHOW COLUMNS FROM trades LIKE 'status'");
        $column = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$column) {
            $done = true;
            return;
        }

        $type = (string) ($column['Type'] ?? '');
        if (strpos($type, 'pending') === false) {
            $pdo->exec("
                ALTER TABLE trades
                MODIFY status ENUM('open','pending','negotiating','completed','declined','cancelled')
                NOT NULL DEFAULT 'pending'
            ");
        }

        $pdo->exec("UPDATE trades SET status = 'negotiating' WHERE status = 'open'");

        $stmt = $pdo->query("SHOW COLUMNS FROM trades LIKE 'status'");
        $column = $stmt->fetch(PDO::FETCH_ASSOC);
        $type = (string) ($column['Type'] ?? '');
        if (strpos($type, 'open') !== false) {
            $pdo->exec("
                ALTER TABLE trades
                MODIFY status ENUM('pending','negotiating','completed','declined','cancelled')
                NOT NULL DEFAULT 'pending'
            ");
        }
    } catch (PDOException $e) {
        // Table may not exist yet on first deploy.
    }

    $done = true;
}

function readTradeJsonBody(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function requireTradeLogin(): ?int
{
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(['success' => false, 'message' => 'Not logged in']);
        return null;
    }
    return (int) $_SESSION['user_id'];
}

function tradeCardPriceSql(): string
{
    return "
        SELECT card_id, MAX(price) AS price, MAX(name) AS name, MAX(image) AS image
        FROM battle_crate_items
        WHERE price IS NOT NULL AND price > 0
        GROUP BY card_id
    ";
}

function deriveSetIdFromCardId(string $cardId): string
{
    $id = trim($cardId);
    if ($id === '') {
        return 'unknown';
    }

    $dash = strrpos($id, '-');
    if ($dash !== false && $dash > 0) {
        return substr($id, 0, $dash);
    }

    return $id;
}

function fetchCardMeta(PDO $pdo, string $cardId): array
{
    $stmt = $pdo->prepare('
        SELECT MAX(price) AS price, MAX(name) AS name, MAX(image) AS image, MAX(set_name) AS set_name
        FROM battle_crate_items
        WHERE card_id = ?
    ');
    $stmt->execute([$cardId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
    $setName = trim((string) ($row['set_name'] ?? ''));
    $setId = deriveSetIdFromCardId($cardId);

    return [
        'cardId' => $cardId,
        'name' => (string) ($row['name'] ?? $cardId),
        'image' => $row['image'] ?? null,
        'price' => round(max(0, (float) ($row['price'] ?? 0)), 2),
        'setId' => $setId,
        'setName' => $setName !== '' ? $setName : $setId,
    ];
}

function getOwnedCardCounts(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare('
        SELECT card_id, card_amount
        FROM user_cards
        WHERE user_id = ? AND card_amount > 0
    ');
    $stmt->execute([$userId]);
    $counts = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $counts[(string) $row['card_id']] = (int) $row['card_amount'];
    }
    return $counts;
}

function getReservedCardCounts(PDO $pdo, int $userId, ?int $excludeTradeId = null): array
{
    $sql = "
        SELECT ti.card_id, SUM(ti.quantity) AS qty
        FROM trade_items ti
        INNER JOIN trades t ON t.id = ti.trade_id
        WHERE t.status IN ('pending', 'negotiating', 'open') AND ti.user_id = ?
    ";
    $params = [$userId];
    if ($excludeTradeId) {
        $sql .= ' AND t.id <> ?';
        $params[] = $excludeTradeId;
    }
    $sql .= ' GROUP BY ti.card_id';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $counts = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $counts[(string) $row['card_id']] = (int) $row['qty'];
    }
    return $counts;
}

function getAvailableCardCount(PDO $pdo, int $userId, string $cardId): int
{
    $owned = getOwnedCardCounts($pdo, $userId);
    $reserved = getReservedCardCounts($pdo, $userId, null);
    $own = $owned[$cardId] ?? 0;
    $res = $reserved[$cardId] ?? 0;
    return max(0, $own - $res);
}

function tradeParticipantRole(array $trade, int $userId): ?string
{
    if ((int) $trade['initiator_id'] === $userId) {
        return 'initiator';
    }
    if ((int) $trade['receiver_id'] === $userId) {
        return 'receiver';
    }
    return null;
}

function resetTradeReadyFlags(PDO $pdo, int $tradeId): void
{
    $stmt = $pdo->prepare('
        UPDATE trades
        SET initiator_ready = 0, receiver_ready = 0
        WHERE id = ?
    ');
    $stmt->execute([$tradeId]);
}

function fetchTradeRow(PDO $pdo, int $tradeId): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM trades WHERE id = ?');
    $stmt->execute([$tradeId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function findActiveTradeBetween(PDO $pdo, int $userA, int $userB): ?array
{
    $stmt = $pdo->prepare("
        SELECT *
        FROM trades
        WHERE status IN ('pending', 'negotiating', 'open')
          AND (
            (initiator_id = ? AND receiver_id = ?)
            OR (initiator_id = ? AND receiver_id = ?)
          )
        ORDER BY id DESC
        LIMIT 1
    ");
    $stmt->execute([$userA, $userB, $userB, $userA]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function buildInventoryList(PDO $pdo, int $userId): array
{
    $owned = getOwnedCardCounts($pdo, $userId);
    $reserved = getReservedCardCounts($pdo, $userId, null);
    $inventory = [];

    foreach ($owned as $cardId => $amount) {
        $available = max(0, $amount - (int) ($reserved[$cardId] ?? 0));
        if ($available <= 0) {
            continue;
        }

        $meta = fetchCardMeta($pdo, $cardId);
        $inventory[] = [
            'cardId' => $cardId,
            'name' => $meta['name'],
            'image' => $meta['image'],
            'price' => $meta['price'],
            'setName' => $meta['setName'],
            'setId' => $meta['setId'],
            'owned' => $amount,
            'available' => $available,
        ];
    }

    usort($inventory, static function ($a, $b) {
        return strcmp($a['name'], $b['name']);
    });

    return $inventory;
}

function sideSummaryFromData(array $side): array
{
    return [
        'userId' => (int) ($side['userId'] ?? 0),
        'username' => (string) ($side['username'] ?? 'Trainer'),
        'coins' => round((float) ($side['coins'] ?? 0), 2),
        'cards' => $side['cards'] ?? [],
        'cardsValue' => round((float) ($side['cardsValue'] ?? 0), 2),
        'totalValue' => round((float) ($side['totalValue'] ?? 0), 2),
    ];
}

function fetchTradeItems(PDO $pdo, int $tradeId): array
{
    $priceSql = tradeCardPriceSql();
    $stmt = $pdo->prepare("
        SELECT ti.user_id, ti.card_id, ti.quantity, ti.unit_price,
               cp.name, cp.image, cp.price AS pool_price
        FROM trade_items ti
        LEFT JOIN ({$priceSql}) cp ON cp.card_id = ti.card_id
        WHERE ti.trade_id = ?
        ORDER BY ti.id ASC
    ");
    $stmt->execute([$tradeId]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function buildTradeSide(PDO $pdo, array $trade, string $role, int $userId, array $items, ?int $viewerId = null): array
{
    $usernameStmt = $pdo->prepare('SELECT username FROM users WHERE id = ?');
    $usernameStmt->execute([$userId]);
    $username = (string) ($usernameStmt->fetchColumn() ?: 'Trainer');

    $coinsKey = $role === 'initiator' ? 'initiator_coins' : 'receiver_coins';
    $readyKey = $role === 'initiator' ? 'initiator_ready' : 'receiver_ready';

    $cards = [];
    $cardsValue = 0.0;

    foreach ($items as $item) {
        if ((int) $item['user_id'] !== $userId) {
            continue;
        }
        $unitPrice = round((float) ($item['unit_price'] ?? 0), 2);
        $qty = (int) $item['quantity'];
        $lineValue = round($unitPrice * $qty, 2);
        $cardsValue += $lineValue;
        $cards[] = [
            'cardId' => (string) $item['card_id'],
            'name' => (string) ($item['name'] ?? $item['card_id']),
            'image' => $item['image'] ?? null,
            'quantity' => $qty,
            'unitPrice' => $unitPrice,
            'lineValue' => $lineValue,
        ];
    }

    $coins = round((float) ($trade[$coinsKey] ?? 0), 2);
    $side = [
        'userId' => $userId,
        'username' => $username,
        'role' => $role,
        'coins' => $coins,
        'ready' => (bool) ($trade[$readyKey] ?? false),
        'cards' => $cards,
        'cardsValue' => round($cardsValue, 2),
        'totalValue' => round($cardsValue + $coins, 2),
    ];

    if ($viewerId && $viewerId === $userId) {
        $side['inventory'] = buildTradeInventory($pdo, $userId, (int) $trade['id']);
    }

    return $side;
}

function buildTradeInventory(PDO $pdo, int $userId, int $tradeId): array
{
    $owned = getOwnedCardCounts($pdo, $userId);
    $allReserved = getReservedCardCounts($pdo, $userId, null);

    $stmt = $pdo->prepare('
        SELECT card_id, quantity, unit_price
        FROM trade_items
        WHERE trade_id = ? AND user_id = ?
    ');
    $stmt->execute([$tradeId, $userId]);
    $inThisTrade = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $inThisTrade[(string) $row['card_id']] = [
            'quantity' => (int) $row['quantity'],
            'unit_price' => round((float) ($row['unit_price'] ?? 0), 2),
        ];
    }

    $cardIds = array_unique(array_merge(array_keys($owned), array_keys($inThisTrade)));
    $inventory = [];

    foreach ($cardIds as $cardId) {
        $amount = (int) ($owned[$cardId] ?? 0);
        $allRes = (int) ($allReserved[$cardId] ?? 0);
        $available = max(0, $amount - $allRes);
        $inTrade = (int) ($inThisTrade[$cardId]['quantity'] ?? 0);

        if ($available <= 0 && $inTrade <= 0) {
            continue;
        }

        $meta = fetchCardMeta($pdo, $cardId);
        $inventory[] = [
            'cardId' => $cardId,
            'name' => $meta['name'],
            'image' => $meta['image'],
            'price' => $inThisTrade[$cardId]['unit_price'] ?? $meta['price'],
            'setName' => $meta['setName'],
            'setId' => $meta['setId'],
            'owned' => $amount,
            'available' => $available,
            'inTrade' => $inTrade,
        ];
    }

    usort($inventory, static function ($a, $b) {
        return strcmp($a['name'], $b['name']);
    });

    return $inventory;
}

function formatTradeForClient(PDO $pdo, array $trade, int $viewerId): array
{
    $items = fetchTradeItems($pdo, (int) $trade['id']);
    $initiatorId = (int) $trade['initiator_id'];
    $receiverId = (int) $trade['receiver_id'];

    $initiator = buildTradeSide($pdo, $trade, 'initiator', $initiatorId, $items, $viewerId);
    $receiver = buildTradeSide($pdo, $trade, 'receiver', $receiverId, $items, $viewerId);

    $myRole = tradeParticipantRole($trade, $viewerId);
    $partner = null;
    if ($myRole === 'initiator') {
        $partner = $receiver;
    } elseif ($myRole === 'receiver') {
        $partner = $initiator;
    }

    $youGive = $myRole === 'initiator' ? $initiator : $receiver;
    $youReceive = $myRole === 'initiator' ? $receiver : $initiator;
    $status = (string) $trade['status'];

    return [
        'id' => (int) $trade['id'],
        'status' => $status,
        'statusLabel' => tradeStatusLabel($status),
        'createdAt' => $trade['created_at'] ?? null,
        'updatedAt' => $trade['updated_at'] ?? null,
        'completedAt' => $trade['completed_at'] ?? null,
        'initiator' => $initiator,
        'receiver' => $receiver,
        'myRole' => $myRole,
        'partner' => $partner,
        'me' => $myRole === 'initiator' ? $initiator : ($myRole === 'receiver' ? $receiver : null),
        'youGive' => sideSummaryFromData($youGive),
        'youReceive' => sideSummaryFromData($youReceive),
        'bothReady' => !empty($trade['initiator_ready']) && !empty($trade['receiver_ready']),
        'canRespond' => $status === 'pending' && $myRole === 'receiver',
        'canAccept' => $status === 'pending' && $myRole === 'receiver',
        'canDecline' => $status === 'pending' && $myRole === 'receiver',
        'canCancel' => ($status === 'pending' && $myRole === 'initiator')
            || ($status === 'negotiating'),
        'canEdit' => $status === 'negotiating',
        'canComplete' => $status === 'negotiating'
            && !empty($trade['initiator_ready'])
            && !empty($trade['receiver_ready']),
    ];
}

function tradeStatusLabel(string $status): string
{
    $labels = [
        'pending' => 'Wacht op reactie',
        'negotiating' => 'Onderhandelen',
        'completed' => 'Voltooid',
        'declined' => 'Geweigerd',
        'cancelled' => 'Geannuleerd',
    ];

    return $labels[$status] ?? $status;
}

function resolveReceiverId(PDO $pdo, array $input): ?int
{
    $receiverId = (int) ($input['receiverId'] ?? 0);
    if ($receiverId > 0) {
        return $receiverId;
    }

    $username = trim((string) ($input['receiverUsername'] ?? ''));
    if ($username === '') {
        return null;
    }

    $stmt = $pdo->prepare('SELECT id FROM users WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $id = (int) ($stmt->fetchColumn() ?: 0);
    return $id > 0 ? $id : null;
}

function normalizeCardPayload(array $cards): array
{
    $normalized = [];
    foreach ($cards as $entry) {
        if (!is_array($entry)) {
            continue;
        }
        $cardId = trim((string) ($entry['cardId'] ?? ''));
        $qty = max(1, (int) ($entry['quantity'] ?? 1));
        if ($cardId === '') {
            continue;
        }
        $normalized[$cardId] = ($normalized[$cardId] ?? 0) + $qty;
    }
    return $normalized;
}

function submitProposal(PDO $pdo): void
{
    $userId = requireTradeLogin();
    if ($userId === null) {
        return;
    }

    $input = readTradeJsonBody();
    $receiverId = resolveReceiverId($pdo, $input);

    if (!$receiverId) {
        echo json_encode(['success' => false, 'message' => 'Ontvanger niet gevonden']);
        return;
    }

    if ($receiverId === $userId) {
        echo json_encode(['success' => false, 'message' => 'Je kunt niet met jezelf traden']);
        return;
    }

    $stmt = $pdo->prepare('SELECT id FROM users WHERE id = ?');
    $stmt->execute([$receiverId]);
    if (!$stmt->fetch()) {
        echo json_encode(['success' => false, 'message' => 'Gebruiker bestaat niet']);
        return;
    }

    $existing = findActiveTradeBetween($pdo, $userId, $receiverId);
    if ($existing) {
        echo json_encode([
            'success' => false,
            'message' => 'Er loopt al een trade met deze speler',
            'trade' => formatTradeForClient($pdo, $existing, $userId),
        ]);
        return;
    }

    $offerCards = normalizeCardPayload($input['offerCards'] ?? []);
    $requestCards = normalizeCardPayload($input['requestCards'] ?? []);
    $offerCoins = round(max(0, (float) ($input['offerCoins'] ?? 0)), 2);
    $requestCoins = round(max(0, (float) ($input['requestCoins'] ?? 0)), 2);

    if (empty($offerCards) && $offerCoins <= 0) {
        echo json_encode(['success' => false, 'message' => 'Voeg minstens iets toe wat jij geeft']);
        return;
    }

    if (empty($requestCards) && $requestCoins <= 0) {
        echo json_encode(['success' => false, 'message' => 'Kies minstens iets wat je van de andere speler wilt']);
        return;
    }

    foreach ($offerCards as $cardId => $qty) {
        if (getAvailableCardCount($pdo, $userId, $cardId) < $qty) {
            echo json_encode(['success' => false, 'message' => 'Je hebt niet genoeg van een gekozen kaart']);
            return;
        }
    }

    foreach ($requestCards as $cardId => $qty) {
        if (getAvailableCardCount($pdo, $receiverId, $cardId) < $qty) {
            echo json_encode(['success' => false, 'message' => 'De andere speler heeft niet genoeg van een gevraagde kaart']);
            return;
        }
    }

    $stmt = $pdo->prepare('SELECT user_coins FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $myCoins = round((float) ($stmt->fetchColumn() ?: 0), 2);
    if ($offerCoins > $myCoins) {
        echo json_encode(['success' => false, 'message' => 'Niet genoeg coins om aan te bieden']);
        return;
    }

    $stmt->execute([$receiverId]);
    $theirCoins = round((float) ($stmt->fetchColumn() ?: 0), 2);
    if ($requestCoins > $theirCoins) {
        echo json_encode(['success' => false, 'message' => 'De andere speler heeft niet genoeg coins voor dit verzoek']);
        return;
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('
            INSERT INTO trades (initiator_id, receiver_id, status, initiator_coins, receiver_coins)
            VALUES (?, ?, \'pending\', ?, ?)
        ');
        $stmt->execute([$userId, $receiverId, $offerCoins, $requestCoins]);
        $tradeId = (int) $pdo->lastInsertId();

        $insert = $pdo->prepare('
            INSERT INTO trade_items (trade_id, user_id, card_id, quantity, unit_price)
            VALUES (?, ?, ?, ?, ?)
        ');

        foreach ($offerCards as $cardId => $qty) {
            $meta = fetchCardMeta($pdo, $cardId);
            $insert->execute([$tradeId, $userId, $cardId, $qty, $meta['price']]);
        }

        foreach ($requestCards as $cardId => $qty) {
            $meta = fetchCardMeta($pdo, $cardId);
            $insert->execute([$tradeId, $receiverId, $cardId, $qty, $meta['price']]);
        }

        $pdo->commit();
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        $message = 'Trade aanmaken mislukt';
        if ($e instanceof PDOException) {
            $message = 'Databasefout bij trade aanmaken. Vernieuw de pagina en probeer opnieuw.';
        }
        echo json_encode(['success' => false, 'message' => $message]);
        return;
    }

    $trade = fetchTradeRow($pdo, $tradeId);
    echo json_encode([
        'success' => true,
        'trade' => formatTradeForClient($pdo, $trade, $userId),
        'message' => 'Trade verzoek verstuurd!',
    ]);
}

function getUserInventory(PDO $pdo): void
{
    $userId = requireTradeLogin();
    if ($userId === null) {
        return;
    }

    $targetId = (int) ($_GET['userId'] ?? 0);
    if ($targetId <= 0) {
        echo json_encode(['success' => false, 'message' => 'Gebruiker ontbreekt']);
        return;
    }

    $stmt = $pdo->prepare('SELECT id, username FROM users WHERE id = ?');
    $stmt->execute([$targetId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user) {
        echo json_encode(['success' => false, 'message' => 'Gebruiker niet gevonden']);
        return;
    }

    echo json_encode([
        'success' => true,
        'user' => [
            'id' => (int) $user['id'],
            'username' => (string) $user['username'],
        ],
        'inventory' => buildInventoryList($pdo, $targetId),
    ]);
}

function getPendingIncoming(PDO $pdo): void
{
    $userId = requireTradeLogin();
    if ($userId === null) {
        return;
    }

    $stmt = $pdo->prepare("
        SELECT *
        FROM trades
        WHERE receiver_id = ? AND status = 'pending'
        ORDER BY created_at DESC
        LIMIT 20
    ");
    $stmt->execute([$userId]);

    $trades = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $trades[] = formatTradeForClient($pdo, $row, $userId);
    }

    echo json_encode(['success' => true, 'trades' => $trades]);
}

function listTrades(PDO $pdo): void
{
    $userId = requireTradeLogin();
    if ($userId === null) {
        return;
    }

    $status = strtolower(trim((string) ($_GET['status'] ?? 'active')));
    $allowed = ['active', 'pending', 'negotiating', 'completed', 'declined', 'cancelled', 'all'];
    if (!in_array($status, $allowed, true)) {
        $status = 'active';
    }

    $sql = "
        SELECT t.*
        FROM trades t
        WHERE (t.initiator_id = ? OR t.receiver_id = ?)
    ";
    $params = [$userId, $userId];
    if ($status === 'active') {
        $sql .= " AND t.status IN ('pending', 'negotiating')";
    } elseif ($status !== 'all') {
        $sql .= ' AND t.status = ?';
        $params[] = $status;
    }
    $sql .= ' ORDER BY t.updated_at DESC LIMIT 50';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $trades = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $trades[] = formatTradeForClient($pdo, $row, $userId);
    }

    echo json_encode(['success' => true, 'trades' => $trades]);
}

function getTrade(PDO $pdo): void
{
    $userId = requireTradeLogin();
    if ($userId === null) {
        return;
    }

    $tradeId = (int) ($_GET['id'] ?? 0);
    if ($tradeId <= 0) {
        echo json_encode(['success' => false, 'message' => 'Trade id ontbreekt']);
        return;
    }

    $trade = fetchTradeRow($pdo, $tradeId);
    if (!$trade || !tradeParticipantRole($trade, $userId)) {
        echo json_encode(['success' => false, 'message' => 'Trade niet gevonden']);
        return;
    }

    echo json_encode([
        'success' => true,
        'trade' => formatTradeForClient($pdo, $trade, $userId),
    ]);
}

function requireNegotiatingTradeForUser(PDO $pdo, int $tradeId, int $userId): ?array
{
    $trade = fetchTradeRow($pdo, $tradeId);
    if (!$trade || $trade['status'] !== 'negotiating' || !tradeParticipantRole($trade, $userId)) {
        echo json_encode(['success' => false, 'message' => 'Trade niet beschikbaar voor bewerken']);
        return null;
    }
    return $trade;
}

function requirePendingTradeForReceiver(PDO $pdo, int $tradeId, int $userId): ?array
{
    $trade = fetchTradeRow($pdo, $tradeId);
    if (
        !$trade
        || $trade['status'] !== 'pending'
        || (int) $trade['receiver_id'] !== $userId
    ) {
        echo json_encode(['success' => false, 'message' => 'Trade verzoek niet gevonden']);
        return null;
    }
    return $trade;
}

function addTradeCard(PDO $pdo): void
{
    $userId = requireTradeLogin();
    if ($userId === null) {
        return;
    }

    $input = readTradeJsonBody();
    $tradeId = (int) ($input['tradeId'] ?? 0);
    $cardId = trim((string) ($input['cardId'] ?? ''));
    $quantity = max(1, (int) ($input['quantity'] ?? 1));

    if ($tradeId <= 0 || $cardId === '') {
        echo json_encode(['success' => false, 'message' => 'Ongeldige data']);
        return;
    }

    $trade = requireNegotiatingTradeForUser($pdo, $tradeId, $userId);
    if (!$trade) {
        return;
    }

    $available = getAvailableCardCount($pdo, $userId, $cardId);
    if ($available < $quantity) {
        echo json_encode(['success' => false, 'message' => 'Niet genoeg exemplaren van deze kaart']);
        return;
    }

    $meta = fetchCardMeta($pdo, $cardId);
    $unitPrice = $meta['price'];

    $stmt = $pdo->prepare('
        INSERT INTO trade_items (trade_id, user_id, card_id, quantity, unit_price)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            quantity = quantity + VALUES(quantity),
            unit_price = VALUES(unit_price)
    ');
    $stmt->execute([$tradeId, $userId, $cardId, $quantity, $unitPrice]);

    resetTradeReadyFlags($pdo, $tradeId);
    $updated = fetchTradeRow($pdo, $tradeId);

    echo json_encode([
        'success' => true,
        'trade' => formatTradeForClient($pdo, $updated, $userId),
    ]);
}

function removeTradeCard(PDO $pdo): void
{
    $userId = requireTradeLogin();
    if ($userId === null) {
        return;
    }

    $input = readTradeJsonBody();
    $tradeId = (int) ($input['tradeId'] ?? 0);
    $cardId = trim((string) ($input['cardId'] ?? ''));
    $quantity = max(1, (int) ($input['quantity'] ?? 1));

    $trade = requireNegotiatingTradeForUser($pdo, $tradeId, $userId);
    if (!$trade || $cardId === '') {
        return;
    }

    $stmt = $pdo->prepare('
        SELECT id, quantity FROM trade_items
        WHERE trade_id = ? AND user_id = ? AND card_id = ?
    ');
    $stmt->execute([$tradeId, $userId, $cardId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        echo json_encode(['success' => false, 'message' => 'Kaart zit niet in de trade']);
        return;
    }

    $current = (int) $row['quantity'];
    if ($quantity >= $current) {
        $del = $pdo->prepare('DELETE FROM trade_items WHERE id = ?');
        $del->execute([(int) $row['id']]);
    } else {
        $upd = $pdo->prepare('UPDATE trade_items SET quantity = quantity - ? WHERE id = ?');
        $upd->execute([$quantity, (int) $row['id']]);
    }

    resetTradeReadyFlags($pdo, $tradeId);
    $updated = fetchTradeRow($pdo, $tradeId);

    echo json_encode([
        'success' => true,
        'trade' => formatTradeForClient($pdo, $updated, $userId),
    ]);
}

function setTradeCoins(PDO $pdo): void
{
    $userId = requireTradeLogin();
    if ($userId === null) {
        return;
    }

    $input = readTradeJsonBody();
    $tradeId = (int) ($input['tradeId'] ?? 0);
    $coins = round(max(0, (float) ($input['coins'] ?? 0)), 2);

    $trade = requireNegotiatingTradeForUser($pdo, $tradeId, $userId);
    if (!$trade) {
        return;
    }

    $role = tradeParticipantRole($trade, $userId);
    $column = $role === 'initiator' ? 'initiator_coins' : 'receiver_coins';

    $stmt = $pdo->prepare('SELECT user_coins FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $balance = round((float) ($stmt->fetchColumn() ?: 0), 2);
    if ($coins > $balance) {
        echo json_encode(['success' => false, 'message' => 'Niet genoeg coins', 'coins' => $balance]);
        return;
    }

    $stmt = $pdo->prepare("UPDATE trades SET {$column} = ? WHERE id = ?");
    $stmt->execute([$coins, $tradeId]);

    resetTradeReadyFlags($pdo, $tradeId);
    $updated = fetchTradeRow($pdo, $tradeId);

    echo json_encode([
        'success' => true,
        'trade' => formatTradeForClient($pdo, $updated, $userId),
    ]);
}

function setTradeReady(PDO $pdo): void
{
    $userId = requireTradeLogin();
    if ($userId === null) {
        return;
    }

    $input = readTradeJsonBody();
    $tradeId = (int) ($input['tradeId'] ?? 0);
    $ready = !empty($input['ready']);

    $trade = requireNegotiatingTradeForUser($pdo, $tradeId, $userId);
    if (!$trade) {
        return;
    }

    $role = tradeParticipantRole($trade, $userId);
    $column = $role === 'initiator' ? 'initiator_ready' : 'receiver_ready';

    if ($ready) {
        $items = fetchTradeItems($pdo, $tradeId);
        $hasCards = false;
        foreach ($items as $item) {
            if ((int) $item['user_id'] === $userId) {
                $hasCards = true;
                break;
            }
        }
        $coinsKey = $role === 'initiator' ? 'initiator_coins' : 'receiver_coins';
        $coins = (float) ($trade[$coinsKey] ?? 0);
        if (!$hasCards && $coins <= 0) {
            echo json_encode(['success' => false, 'message' => 'Voeg minstens een kaart of coins toe']);
            return;
        }
    }

    $stmt = $pdo->prepare("UPDATE trades SET {$column} = ? WHERE id = ?");
    $stmt->execute([$ready ? 1 : 0, $tradeId]);

    $updated = fetchTradeRow($pdo, $tradeId);

    echo json_encode([
        'success' => true,
        'trade' => formatTradeForClient($pdo, $updated, $userId),
    ]);
}

function transferCardsBetweenUsers(PDO $pdo, int $fromUserId, int $toUserId, string $cardId, int $quantity): void
{
    if ($quantity <= 0) {
        return;
    }

    $stmt = $pdo->prepare('
        SELECT card_amount FROM user_cards
        WHERE user_id = ? AND card_id = ?
        FOR UPDATE
    ');
    $stmt->execute([$fromUserId, $cardId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row || (int) $row['card_amount'] < $quantity) {
        throw new RuntimeException('Niet genoeg kaarten om te traden');
    }

    $stmt = $pdo->prepare('
        UPDATE user_cards
        SET card_amount = card_amount - ?
        WHERE user_id = ? AND card_id = ? AND card_amount >= ?
    ');
    $stmt->execute([$quantity, $fromUserId, $cardId, $quantity]);

    $stmt = $pdo->prepare('
        DELETE FROM user_cards
        WHERE user_id = ? AND card_id = ? AND card_amount <= 0
    ');
    $stmt->execute([$fromUserId, $cardId]);

    $stmt = $pdo->prepare('
        SELECT card_amount FROM user_cards
        WHERE user_id = ? AND card_id = ?
        FOR UPDATE
    ');
    $stmt->execute([$toUserId, $cardId]);
    $dest = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($dest) {
        $stmt = $pdo->prepare('
            UPDATE user_cards SET card_amount = card_amount + ?
            WHERE user_id = ? AND card_id = ?
        ');
        $stmt->execute([$quantity, $toUserId, $cardId]);
    } else {
        $stmt = $pdo->prepare('
            INSERT INTO user_cards (user_id, card_id, card_amount)
            VALUES (?, ?, ?)
        ');
        $stmt->execute([$toUserId, $cardId, $quantity]);
    }
}

function executeTrade(PDO $pdo, array $trade): void
{
    $tradeId = (int) $trade['id'];
    $initiatorId = (int) $trade['initiator_id'];
    $receiverId = (int) $trade['receiver_id'];
    $initiatorCoins = round((float) $trade['initiator_coins'], 2);
    $receiverCoins = round((float) $trade['receiver_coins'], 2);
    $items = fetchTradeItems($pdo, $tradeId);

    $hasInitiatorOffer = $initiatorCoins > 0;
    $hasReceiverOffer = $receiverCoins > 0;
    foreach ($items as $item) {
        if ((int) $item['user_id'] === $initiatorId) {
            $hasInitiatorOffer = true;
        }
        if ((int) $item['user_id'] === $receiverId) {
            $hasReceiverOffer = true;
        }
    }

    if (!$hasInitiatorOffer || !$hasReceiverOffer) {
        throw new RuntimeException('Beide spelers moeten iets aanbieden');
    }

    $userIds = [$initiatorId, $receiverId];
    sort($userIds);
    foreach ($userIds as $uid) {
        $stmt = $pdo->prepare('SELECT user_coins FROM users WHERE id = ? FOR UPDATE');
        $stmt->execute([$uid]);
        if (!$stmt->fetch()) {
            throw new RuntimeException('Gebruiker niet gevonden');
        }
    }

    foreach ($items as $item) {
        $ownerId = (int) $item['user_id'];
        $cardId = (string) $item['card_id'];
        $qty = (int) $item['quantity'];
        $owned = getOwnedCardCounts($pdo, $ownerId);
        if (($owned[$cardId] ?? 0) < $qty) {
            throw new RuntimeException('Een speler heeft niet meer genoeg kaarten');
        }
    }

    $stmt = $pdo->prepare('SELECT user_coins FROM users WHERE id = ?');
    $stmt->execute([$initiatorId]);
    $initiatorBalance = (float) $stmt->fetchColumn();
    $stmt->execute([$receiverId]);
    $receiverBalance = (float) $stmt->fetchColumn();

    if ($initiatorBalance < $initiatorCoins || $receiverBalance < $receiverCoins) {
        throw new RuntimeException('Niet genoeg coins voor deze trade');
    }

    if ($initiatorCoins > 0) {
        $stmt = $pdo->prepare('UPDATE users SET user_coins = user_coins - ? WHERE id = ?');
        $stmt->execute([$initiatorCoins, $initiatorId]);
        $stmt = $pdo->prepare('UPDATE users SET user_coins = user_coins + ? WHERE id = ?');
        $stmt->execute([$initiatorCoins, $receiverId]);
    }
    if ($receiverCoins > 0) {
        $stmt = $pdo->prepare('UPDATE users SET user_coins = user_coins - ? WHERE id = ?');
        $stmt->execute([$receiverCoins, $receiverId]);
        $stmt = $pdo->prepare('UPDATE users SET user_coins = user_coins + ? WHERE id = ?');
        $stmt->execute([$receiverCoins, $initiatorId]);
    }

    foreach ($items as $item) {
        $fromId = (int) $item['user_id'];
        $toId = $fromId === $initiatorId ? $receiverId : $initiatorId;
        transferCardsBetweenUsers($pdo, $fromId, $toId, (string) $item['card_id'], (int) $item['quantity']);
    }

    $stmt = $pdo->prepare("
        UPDATE trades
        SET status = 'completed',
            completed_at = NOW(),
            initiator_ready = 0,
            receiver_ready = 0
        WHERE id = ?
    ");
    $stmt->execute([$tradeId]);
}

function completeTrade(PDO $pdo): void
{
    $userId = requireTradeLogin();
    if ($userId === null) {
        return;
    }

    $input = readTradeJsonBody();
    $tradeId = (int) ($input['tradeId'] ?? 0);

    $trade = requireNegotiatingTradeForUser($pdo, $tradeId, $userId);
    if (!$trade) {
        return;
    }

    if (empty($trade['initiator_ready']) || empty($trade['receiver_ready'])) {
        echo json_encode(['success' => false, 'message' => 'Beide spelers moeten klaar zijn']);
        return;
    }

    $pdo->beginTransaction();
    try {
        $fresh = fetchTradeRow($pdo, $tradeId);
        if (!$fresh || $fresh['status'] !== 'negotiating') {
            throw new RuntimeException('Trade niet meer beschikbaar');
        }
        executeTrade($pdo, $fresh);
        $pdo->commit();
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        echo json_encode(['success' => false, 'message' => $e->getMessage() ?: 'Trade mislukt']);
        return;
    }

    $updated = fetchTradeRow($pdo, $tradeId);
    echo json_encode([
        'success' => true,
        'trade' => formatTradeForClient($pdo, $updated, $userId),
        'message' => 'Trade voltooid!',
    ]);
}

function acceptTrade(PDO $pdo): void
{
    $userId = requireTradeLogin();
    if ($userId === null) {
        return;
    }

    $input = readTradeJsonBody();
    $tradeId = (int) ($input['tradeId'] ?? 0);
    $trade = requirePendingTradeForReceiver($pdo, $tradeId, $userId);
    if (!$trade) {
        return;
    }

    $pdo->beginTransaction();
    try {
        $fresh = fetchTradeRow($pdo, $tradeId);
        if (!$fresh || $fresh['status'] !== 'pending') {
            throw new RuntimeException('Trade verzoek is niet meer geldig');
        }
        executeTrade($pdo, $fresh);
        $pdo->commit();
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        echo json_encode(['success' => false, 'message' => $e->getMessage() ?: 'Trade accepteren mislukt']);
        return;
    }

    $updated = fetchTradeRow($pdo, $tradeId);
    echo json_encode([
        'success' => true,
        'trade' => formatTradeForClient($pdo, $updated, $userId),
        'message' => 'Trade geaccepteerd!',
    ]);
}

function declineTrade(PDO $pdo): void
{
    $userId = requireTradeLogin();
    if ($userId === null) {
        return;
    }

    $input = readTradeJsonBody();
    $tradeId = (int) ($input['tradeId'] ?? 0);
    $trade = requirePendingTradeForReceiver($pdo, $tradeId, $userId);
    if (!$trade) {
        return;
    }

    $stmt = $pdo->prepare("
        UPDATE trades
        SET status = 'declined', initiator_ready = 0, receiver_ready = 0
        WHERE id = ?
    ");
    $stmt->execute([$tradeId]);

    $updated = fetchTradeRow($pdo, $tradeId);
    echo json_encode([
        'success' => true,
        'trade' => formatTradeForClient($pdo, $updated, $userId),
        'message' => 'Trade geweigerd',
    ]);
}

function negotiateTrade(PDO $pdo): void
{
    $userId = requireTradeLogin();
    if ($userId === null) {
        return;
    }

    $input = readTradeJsonBody();
    $tradeId = (int) ($input['tradeId'] ?? 0);
    $trade = requirePendingTradeForReceiver($pdo, $tradeId, $userId);
    if (!$trade) {
        return;
    }

    $stmt = $pdo->prepare("
        UPDATE trades
        SET status = 'negotiating', initiator_ready = 0, receiver_ready = 0
        WHERE id = ?
    ");
    $stmt->execute([$tradeId]);

    $updated = fetchTradeRow($pdo, $tradeId);
    echo json_encode([
        'success' => true,
        'trade' => formatTradeForClient($pdo, $updated, $userId),
        'message' => 'Onderhandelen gestart — pas de trade aan',
    ]);
}

function cancelTrade(PDO $pdo): void
{
    $userId = requireTradeLogin();
    if ($userId === null) {
        return;
    }

    $input = readTradeJsonBody();
    $tradeId = (int) ($input['tradeId'] ?? 0);

    $trade = fetchTradeRow($pdo, $tradeId);
    $role = $trade ? tradeParticipantRole($trade, $userId) : null;
    if (
        !$trade
        || !$role
        || !in_array($trade['status'], ['pending', 'negotiating'], true)
        || ($trade['status'] === 'pending' && $role !== 'initiator')
    ) {
        echo json_encode(['success' => false, 'message' => 'Trade kan niet geannuleerd worden']);
        return;
    }

    $stmt = $pdo->prepare("
        UPDATE trades
        SET status = 'cancelled',
            initiator_ready = 0,
            receiver_ready = 0
        WHERE id = ?
    ");
    $stmt->execute([$tradeId]);

    $updated = fetchTradeRow($pdo, $tradeId);

    echo json_encode([
        'success' => true,
        'trade' => formatTradeForClient($pdo, $updated, $userId),
    ]);
}

function lookupTradeUser(PDO $pdo): void
{
    $userId = requireTradeLogin();
    if ($userId === null) {
        return;
    }

    $username = trim((string) ($_GET['username'] ?? ''));
    if ($username === '') {
        echo json_encode(['success' => false, 'message' => 'Gebruikersnaam ontbreekt']);
        return;
    }

    $stmt = $pdo->prepare('SELECT id, username FROM users WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        echo json_encode(['success' => false, 'message' => 'Gebruiker niet gevonden']);
        return;
    }

    if ((int) $row['id'] === $userId) {
        echo json_encode(['success' => false, 'message' => 'Dat ben je zelf']);
        return;
    }

    echo json_encode([
        'success' => true,
        'user' => [
            'id' => (int) $row['id'],
            'username' => (string) $row['username'],
        ],
    ]);
}

function runTradesApi(): void
{
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
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Credentials: true');
    header('Content-Type: application/json; charset=utf-8');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        exit(0);
    }

    session_start();
    require __DIR__ . '/db.php';

    try {
        ensureTradeTables($pdo);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Database setup failed']);
        exit;
    }

    $action = $_GET['action'] ?? '';

    switch ($action) {
        case 'submit':
            submitProposal($pdo);
            break;
        case 'getInventory':
            getUserInventory($pdo);
            break;
        case 'pendingIncoming':
            getPendingIncoming($pdo);
            break;
        case 'accept':
            acceptTrade($pdo);
            break;
        case 'decline':
            declineTrade($pdo);
            break;
        case 'list':
            listTrades($pdo);
            break;
        case 'get':
            getTrade($pdo);
            break;
        case 'addCard':
            addTradeCard($pdo);
            break;
        case 'removeCard':
            removeTradeCard($pdo);
            break;
        case 'setCoins':
            setTradeCoins($pdo);
            break;
        case 'setReady':
            setTradeReady($pdo);
            break;
        case 'complete':
            completeTrade($pdo);
            break;
        case 'cancel':
            cancelTrade($pdo);
            break;
        case 'lookupUser':
            lookupTradeUser($pdo);
            break;
        default:
            echo json_encode(['success' => false, 'message' => 'Invalid action']);
            break;
    }
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === realpath(__FILE__)) {
    runTradesApi();
}
