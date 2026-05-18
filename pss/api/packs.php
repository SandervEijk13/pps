<?php
header("Content-Type: application/json");

if (isset($_SERVER['HTTP_ORIGIN'])) {
    header("Access-Control-Allow-Origin: " . $_SERVER['HTTP_ORIGIN']);
}

header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

session_start();
require "db.php";

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Not logged in"]);
    exit;
}

$userId = (int) $_SESSION['user_id'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->prepare("SELECT * FROM user_packs WHERE user_id = ? ORDER BY created_at DESC");
    $stmt->execute([$userId]);

    $packs = [];
    foreach ($stmt->fetchAll() as $row) {
        $packs[] = [
            "id" => $row["pack_uuid"],
            "setId" => $row["set_id"],
            "tcgdexSetId" => $row["tcgdex_set_id"],
            "setName" => $row["set_name"],
            "cardIds" => json_decode($row["card_ids"] ?? "[]", true) ?: [],
            "createdAt" => strtotime($row["created_at"]) * 1000
        ];
    }

    echo json_encode(["success" => true, "packs" => $packs]);
    exit;
}

$data = json_decode(file_get_contents("php://input"), true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Invalid JSON"]);
    exit;
}

if (($data["action"] ?? "") === "delete") {
    $packId = $data["packId"] ?? "";

    $stmt = $pdo->prepare("DELETE FROM user_packs WHERE user_id = ? AND pack_uuid = ?");
    $stmt->execute([$userId, $packId]);

    echo json_encode(["success" => true]);
    exit;
}

$packId = $data["id"] ?? "";
$setId = $data["setId"] ?? "";
$cardIds = is_array($data["cardIds"] ?? null) ? $data["cardIds"] : [];

if ($packId === "" || $setId === "") {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Missing pack data"]);
    exit;
}

$stmt = $pdo->prepare("
    INSERT INTO user_packs (pack_uuid, user_id, set_id, tcgdex_set_id, set_name, card_ids)
    VALUES (?, ?, ?, ?, ?, ?)
");

$stmt->execute([
    $packId,
    $userId,
    $setId,
    $data["tcgdexSetId"] ?? null,
    $data["setName"] ?? null,
    json_encode($cardIds)
]);

echo json_encode([
    "success" => true,
    "pack" => [
        "id" => $packId,
        "setId" => $setId,
        "tcgdexSetId" => $data["tcgdexSetId"] ?? null,
        "setName" => $data["setName"] ?? null,
        "cardIds" => $cardIds,
        "createdAt" => time() * 1000
    ]
]);
