<?php

header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once 'db.php';

$columns = [];
try {
    $stmt = $pdo->query('SHOW COLUMNS FROM packs');
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $columns[] = $row['Field'];
    }
} catch (PDOException $e) {
    echo json_encode([]);
    exit;
}

$select = ['id', 'price', 'photo', 'name'];
if (in_array('tcgdex_set_id', $columns, true)) {
    $select[] = 'tcgdex_set_id';
}
if (in_array('set_id', $columns, true)) {
    $select[] = 'set_id';
}

$sql = 'SELECT ' . implode(', ', $select) . ' FROM packs ORDER BY price ASC';
$stmt = $pdo->query($sql);
$packs = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($packs as &$pack) {
    if (empty($pack['tcgdex_set_id']) && empty($pack['set_id']) && !empty($pack['name'])) {
        $name = trim((string) $pack['name']);
        if (preg_match('/^[a-z0-9]+$/i', $name)) {
            $pack['set_id'] = strtolower($name);
        }
    }
}
unset($pack);

echo json_encode($packs);
