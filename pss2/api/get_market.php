<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Credentials: true");

require 'db.php';

$stmt = $pdo->query("
    SELECT 
        marketplace.*,
        users.username
    FROM marketplace
    JOIN users 
        ON users.id = marketplace.user_id
");

$data = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode([
    "success" => true,
    "data" => $data
]);