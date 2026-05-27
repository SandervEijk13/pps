<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Credentials: true");

require 'db.php';

$stmt = $pdo->query("
    SELECT * FROM marketplace
");

echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));