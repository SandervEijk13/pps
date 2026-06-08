<?php

function readJsonBody(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }

    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function ensureCrateTables(PDO $pdo): void
{
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS battle_crates (
            id INT AUTO_INCREMENT PRIMARY KEY,
            slug VARCHAR(32) NOT NULL UNIQUE,
            name VARCHAR(128) NOT NULL,
            tier VARCHAR(24) NOT NULL,
            price DECIMAL(12,2) NOT NULL DEFAULT 0,
            image TEXT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            pool_seed VARCHAR(64) NOT NULL DEFAULT 'pss-global-v1',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_tier (tier),
            INDEX idx_sort (sort_order)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS battle_crate_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            crate_id INT NOT NULL,
            card_id VARCHAR(64) NOT NULL,
            name VARCHAR(128) NOT NULL,
            image TEXT NULL,
            rarity VARCHAR(32) NULL,
            rarity_label VARCHAR(64) NULL,
            set_name VARCHAR(128) NULL,
            price DECIMAL(12,2) NULL,
            drop_chance DECIMAL(10,4) NOT NULL DEFAULT 1,
            FOREIGN KEY (crate_id) REFERENCES battle_crates(id) ON DELETE CASCADE,
            INDEX idx_crate (crate_id),
            INDEX idx_card (card_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
}

function fetchAllCrates(PDO $pdo): array
{
    $stmt = $pdo->query("
        SELECT id, slug, name, tier, price, image, sort_order, pool_seed
        FROM battle_crates
        ORDER BY sort_order ASC, id ASC
    ");
    $rows = $stmt->fetchAll();
    if (!$rows) {
        return [];
    }

    $itemStmt = $pdo->prepare("
        SELECT card_id, name, image, rarity, rarity_label, set_name, price, drop_chance
        FROM battle_crate_items
        WHERE crate_id = ?
        ORDER BY id ASC
    ");

    $crates = [];
    foreach ($rows as $row) {
        $itemStmt->execute([(int) $row['id']]);
        $items = [];
        foreach ($itemStmt->fetchAll() as $item) {
            $items[] = [
                'id' => $item['card_id'],
                'name' => $item['name'],
                'image' => $item['image'],
                'rarity' => $item['rarity'],
                'rarityLabel' => $item['rarity_label'],
                'setName' => $item['set_name'],
                'price' => $item['price'] !== null ? round((float) $item['price'], 2) : null,
                'dropChance' => (float) $item['drop_chance']
            ];
        }

        $crates[] = [
            'id' => $row['slug'],
            'slug' => $row['slug'],
            'name' => $row['name'],
            'tier' => $row['tier'],
            'price' => round((float) $row['price'], 2),
            'image' => $row['image'],
            'items' => $items
        ];
    }

    return $crates;
}

function expectedCrateSlugs(): array
{
    return ['basic', 'basic_ii', 'rare', 'rare_ii', 'elite', 'elite_ii'];
}

function catalogNeedsUpdate(PDO $pdo): bool
{
    $map = getCrateCatalogMap($pdo);
    if (!$map) {
        return true;
    }

    foreach (expectedCrateSlugs() as $slug) {
        if (!isset($map[$slug])) {
            return true;
        }
    }

    return false;
}

function clearCrateCatalog(PDO $pdo): void
{
    $pdo->exec('DELETE FROM battle_crate_items');
    $pdo->exec('DELETE FROM battle_crates');
}

function getCrateCatalogMap(PDO $pdo): array
{
    $stmt = $pdo->query("SELECT slug, tier, price FROM battle_crates ORDER BY sort_order ASC");
    $map = [];
    foreach ($stmt->fetchAll() as $row) {
        $map[$row['slug']] = [
            'id' => $row['slug'],
            'tier' => $row['tier'],
            'price' => round((float) $row['price'], 2)
        ];
    }
    return $map;
}

function getCrates(PDO $pdo): void
{
    $crates = fetchAllCrates($pdo);

    echo json_encode([
        'success' => true,
        'crates' => $crates,
        'needsSeed' => count($crates) === 0 || catalogNeedsUpdate($pdo),
        'catalogVersion' => count($crates)
    ]);
}

function syncCrates(PDO $pdo): void
{
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(["success" => false, "message" => "Not logged in"]);
        return;
    }

    $countStmt = $pdo->query("SELECT COUNT(*) AS c FROM battle_crates");
    $count = (int) ($countStmt->fetch()['c'] ?? 0);
    if ($count > 0 && !catalogNeedsUpdate($pdo)) {
        echo json_encode([
            'success' => true,
            'alreadySeeded' => true,
            'crates' => fetchAllCrates($pdo)
        ]);
        return;
    }

    if ($count > 0) {
        clearCrateCatalog($pdo);
    }

    $input = readJsonBody();
    $crates = $input['crates'] ?? [];

    if (!is_array($crates) || count($crates) < 1) {
        echo json_encode(["success" => false, "message" => "No crate data to sync"]);
        return;
    }

    $poolSeed = $input['poolSeed'] ?? 'pss-global-v1';
    $pdo->beginTransaction();

    try {
        $crateStmt = $pdo->prepare("
            INSERT INTO battle_crates (slug, name, tier, price, image, sort_order, pool_seed)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $itemStmt = $pdo->prepare("
            INSERT INTO battle_crate_items
            (crate_id, card_id, name, image, rarity, rarity_label, set_name, price, drop_chance)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $sort = 0;
        foreach ($crates as $crate) {
            if (!is_array($crate)) {
                continue;
            }

            $slug = trim((string) ($crate['id'] ?? $crate['slug'] ?? ''));
            if ($slug === '') {
                continue;
            }

            $name = trim((string) ($crate['name'] ?? $slug));
            $tier = trim((string) ($crate['tier'] ?? $slug));
            $price = round(max(0, (float) ($crate['price'] ?? 0)), 2);
            $image = $crate['image'] ?? null;
            $items = $crate['items'] ?? [];

            $crateStmt->execute([$slug, $name, $tier, $price, $image, $sort, $poolSeed]);
            $crateId = (int) $pdo->lastInsertId();
            $sort++;

            if (!is_array($items)) {
                continue;
            }

            foreach ($items as $item) {
                if (!is_array($item) || empty($item['id'])) {
                    continue;
                }

                $itemStmt->execute([
                    $crateId,
                    (string) $item['id'],
                    (string) ($item['name'] ?? 'Card'),
                    $item['image'] ?? null,
                    $item['rarity'] ?? null,
                    $item['rarityLabel'] ?? ($item['rarity'] ?? null),
                    $item['setName'] ?? null,
                    isset($item['price']) ? round((float) $item['price'], 2) : null,
                    (float) ($item['dropChance'] ?? 1)
                ]);
            }
        }

        $pdo->commit();

        echo json_encode([
            'success' => true,
            'seeded' => true,
            'crates' => fetchAllCrates($pdo)
        ]);
    } catch (Exception $e) {
        $pdo->rollBack();
        echo json_encode(["success" => false, "message" => "Could not save crates"]);
    }
}

function runCratesApi(): void
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
    header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type");
    header("Access-Control-Allow-Credentials: true");
    header("Content-Type: application/json; charset=utf-8");

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        exit(0);
    }

    require __DIR__ . '/db.php';

    $action = $_GET['action'] ?? '';

    try {
        ensureCrateTables($pdo);
    } catch (PDOException $e) {
        echo json_encode(["success" => false, "message" => "Database setup failed"]);
        exit;
    }

    switch ($action) {
        case 'getCrates':
            getCrates($pdo);
            break;
        case 'syncCrates':
            if (session_status() === PHP_SESSION_NONE) {
                session_start();
            }
            syncCrates($pdo);
            break;
        default:
            echo json_encode(["success" => false, "message" => "Invalid action"]);
            break;
    }
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === realpath(__FILE__)) {
    runCratesApi();
}
