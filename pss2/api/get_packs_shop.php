<?php

header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json");


require_once 'db.php';

$stmt = $pdo->query("
    SELECT id, price, photo, name
    FROM packs
    ORDER BY price ASC
");

echo json_encode(
    $stmt->fetchAll(PDO::FETCH_ASSOC)
);