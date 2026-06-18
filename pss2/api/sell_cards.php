<?php

header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

session_start();
require_once 'db.php';

function fetchCardSellPrice(PDO $pdo, string $cardId): float
{
    $stmt = $pdo->prepare('SELECT MAX(price) AS price FROM battle_crate_items WHERE card_id = ?');
    $stmt->execute([$cardId]);
    return round(max(0, (float) ($stmt->fetchColumn() ?: 0)), 2);
}

function getAggregatedOwnedCounts(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare('
        SELECT card_id, SUM(card_amount) AS total
        FROM user_cards
        WHERE user_id = ? AND card_amount > 0
        GROUP BY card_id
    ');
    $stmt->execute([$userId]);

    $counts = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $counts[(string) $row['card_id']] = (int) $row['total'];
    }

    return $counts;
}

function setOwnedCardAmount(PDO $pdo, int $userId, string $cardId, int $amount): void
{
    $stmt = $pdo->prepare('DELETE FROM user_cards WHERE user_id = ? AND card_id = ?');
    $stmt->execute([$userId, $cardId]);

    if ($amount > 0) {
        $stmt = $pdo->prepare('
            INSERT INTO user_cards (user_id, card_id, card_amount)
            VALUES (?, ?, ?)
        ');
        $stmt->execute([$userId, $cardId, $amount]);
    }
}

function bulkSellDuplicates(PDO $pdo, int $userId): void
{
    $data = json_decode(file_get_contents('php://input'), true) ?: [];
    $setId = strtolower(trim((string) ($data['setId'] ?? '')));
    $clientItems = $data['items'] ?? null;
    $owned = getAggregatedOwnedCounts($pdo, $userId);

    $toSell = [];

    if (is_array($clientItems) && !empty($clientItems)) {
        foreach ($clientItems as $item) {
            $cardId = trim((string) ($item['cardId'] ?? ''));
            $qty = (int) ($item['qty'] ?? 0);
            $cardValue = (float) ($item['cardValue'] ?? 0);
            if ($cardId === '' || $qty <= 0) {
                continue;
            }
            if ($setId !== '' && strtolower(deriveSetIdFromCardId($cardId)) !== $setId) {
                continue;
            }
            $toSell[] = [
                'cardId' => $cardId,
                'qty' => $qty,
                'cardValue' => max(0, $cardValue),
            ];
        }
    } else {
        foreach ($owned as $cardId => $total) {
            if ($total <= 1) {
                continue;
            }
            if ($setId !== '' && strtolower(deriveSetIdFromCardId($cardId)) !== $setId) {
                continue;
            }
            $toSell[] = [
                'cardId' => $cardId,
                'qty' => $total - 1,
                'cardValue' => fetchCardSellPrice($pdo, $cardId),
            ];
        }
    }

    if (empty($toSell)) {
        echo json_encode([
            'success' => false,
            'message' => 'Geen dubbele kaarten om te verkopen',
        ]);
        return;
    }

    $totalCoins = 0.0;
    $cardsSold = 0;
    $soldCards = [];

    $pdo->beginTransaction();
    try {
        $owned = getAggregatedOwnedCounts($pdo, $userId);

        foreach ($toSell as $item) {
            $cardId = $item['cardId'];
            $ownedTotal = (int) ($owned[$cardId] ?? 0);
            if ($ownedTotal <= 1) {
                continue;
            }

            $maxSell = $ownedTotal - 1;
            $sellQty = min((int) $item['qty'], $maxSell);
            if ($sellQty <= 0) {
                continue;
            }

            $price = $item['cardValue'] > 0 ? $item['cardValue'] : fetchCardSellPrice($pdo, $cardId);
            if ($price <= 0) {
                $price = 0.5;
            }

            $newAmount = $ownedTotal - $sellQty;
            setOwnedCardAmount($pdo, $userId, $cardId, $newAmount);

            $lineCoins = round($price * 0.8 * $sellQty, 2);
            $totalCoins += $lineCoins;
            $cardsSold += $sellQty;
            $owned[$cardId] = $newAmount;
            $soldCards[] = [
                'cardId' => $cardId,
                'qty' => $sellQty,
                'coinsAdded' => $lineCoins,
            ];
        }

        if ($cardsSold <= 0) {
            $pdo->rollBack();
            echo json_encode(['success' => false, 'message' => 'Geen dubbele kaarten om te verkopen']);
            return;
        }

        if ($totalCoins > 0) {
            $stmt = $pdo->prepare('UPDATE users SET user_coins = user_coins + ? WHERE id = ?');
            $stmt->execute([round($totalCoins, 2), $userId]);
        }

        $pdo->commit();
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        echo json_encode(['success' => false, 'message' => 'Bulk sell mislukt']);
        return;
    }

    $stmt = $pdo->prepare('SELECT user_coins FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $coins = round((float) ($stmt->fetchColumn() ?: 0), 2);

    echo json_encode([
        'success' => true,
        'message' => "{$cardsSold} dubbele kaarten verkocht",
        'cardsSold' => $cardsSold,
        'coinsAdded' => round($totalCoins, 2),
        'coins' => $coins,
        'sold' => $soldCards,
    ]);
}

if (!isset($_SESSION['user_id'])) {
    echo json_encode([
        'success' => false,
        'message' => 'Not logged in',
    ]);
    exit;
}

$userId = (int) $_SESSION['user_id'];
$action = $_GET['action'] ?? 'single';

if ($action === 'bulkDuplicates') {
    bulkSellDuplicates($pdo, $userId);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true) ?: [];
$cardId = $data['cardId'] ?? null;
$cardValue = (float) ($data['cardValue'] ?? 0);

if (!$cardId) {
    echo json_encode([
        'success' => false,
        'message' => 'No card ID provided',
    ]);
    exit;
}

$owned = getAggregatedOwnedCounts($pdo, $userId);
$ownedTotal = (int) ($owned[$cardId] ?? 0);

if ($ownedTotal <= 0) {
    echo json_encode([
        'success' => false,
        'message' => "You don't own this card",
    ]);
    exit;
}

$pdo->beginTransaction();
try {
    setOwnedCardAmount($pdo, $userId, $cardId, $ownedTotal - 1);

    $coinsAdded = 0.0;
    if ($cardValue > 0) {
        $coinsAdded = round($cardValue * 0.8, 2);
        $stmt = $pdo->prepare('UPDATE users SET user_coins = user_coins + ? WHERE id = ?');
        $stmt->execute([$coinsAdded, $userId]);
    }

    $pdo->commit();
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo json_encode(['success' => false, 'message' => 'Sell failed']);
    exit;
}

$coins = null;
if ($coinsAdded > 0) {
    $stmt = $pdo->prepare('SELECT user_coins FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $coins = round((float) ($stmt->fetchColumn() ?: 0), 2);
}

echo json_encode([
    'success' => true,
    'message' => 'Card sold',
    'coinsAdded' => $coinsAdded,
    'coins' => $coins,
]);
