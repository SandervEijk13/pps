<?php

require_once __DIR__ . '/trades.php';

function ensureStorybookTables(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS set_story_chapters (
            id INT AUTO_INCREMENT PRIMARY KEY,
            set_id VARCHAR(64) NOT NULL,
            chapter_no TINYINT NOT NULL,
            title VARCHAR(120) NOT NULL,
            body TEXT NOT NULL,
            unlock_pct TINYINT NOT NULL DEFAULT 25,
            reward_coins DECIMAL(10,2) NOT NULL DEFAULT 0,
            reward_cosmetic_key VARCHAR(64) NULL,
            is_secret TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_set_chapter (set_id, chapter_no)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_story_claims (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            set_id VARCHAR(64) NOT NULL,
            chapter_no TINYINT NOT NULL,
            claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_user_story_claim (user_id, set_id, chapter_no),
            CONSTRAINT fk_user_story_claim_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS cosmetics (
            cosmetic_key VARCHAR(64) PRIMARY KEY,
            type ENUM('title','banner','frame','badge','cardback') NOT NULL,
            name VARCHAR(80) NOT NULL,
            description VARCHAR(180) NOT NULL DEFAULT '',
            rarity ENUM('common','rare','epic','legendary') NOT NULL DEFAULT 'common',
            animation ENUM('none','pulse','shimmer','glow','cosmic') NOT NULL DEFAULT 'none',
            source_type ENUM('starter','storybook','achievement','event') NOT NULL DEFAULT 'starter',
            source_ref VARCHAR(80) DEFAULT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_cosmetics (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            cosmetic_key VARCHAR(64) NOT NULL,
            unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_user_cosmetic (user_id, cosmetic_key),
            CONSTRAINT fk_user_cosmetic_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT fk_user_cosmetic_item FOREIGN KEY (cosmetic_key) REFERENCES cosmetics(cosmetic_key) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_profile_loadout (
            user_id INT PRIMARY KEY,
            title_key VARCHAR(64) DEFAULT NULL,
            banner_key VARCHAR(64) DEFAULT NULL,
            frame_key VARCHAR(64) DEFAULT NULL,
            cardback_key VARCHAR(64) DEFAULT NULL,
            badge_1_key VARCHAR(64) DEFAULT NULL,
            badge_2_key VARCHAR(64) DEFAULT NULL,
            badge_3_key VARCHAR(64) DEFAULT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_profile_loadout_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_story_stats (
            user_id INT PRIMARY KEY,
            set_guess_correct INT NOT NULL DEFAULT 0,
            higher_lower_correct INT NOT NULL DEFAULT 0,
            pack_opens INT NOT NULL DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_story_stats_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_story_ch5_baselines (
            user_id INT NOT NULL,
            set_id VARCHAR(64) NOT NULL,
            baseline_set_guess_correct INT NOT NULL DEFAULT 0,
            baseline_higher_lower_correct INT NOT NULL DEFAULT 0,
            baseline_pack_opens INT NOT NULL DEFAULT 0,
            baseline_case_wins INT NOT NULL DEFAULT 0,
            baseline_wheel_spins INT NOT NULL DEFAULT 0,
            baseline_upgrader_wins INT NOT NULL DEFAULT 0,
            started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, set_id),
            CONSTRAINT fk_story_ch5_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    seedCosmetics($pdo);
    $ready = true;
}

function ensureUserStoryStatsRow(PDO $pdo, int $userId): void
{
    $stmt = $pdo->prepare("INSERT IGNORE INTO user_story_stats (user_id) VALUES (?)");
    $stmt->execute([$userId]);
}

function bumpUserStoryStat(PDO $pdo, int $userId, string $field, int $amount = 1): void
{
    $allowed = ['set_guess_correct', 'higher_lower_correct', 'pack_opens'];
    if (!in_array($field, $allowed, true) || $amount <= 0) {
        return;
    }
    ensureUserStoryStatsRow($pdo, $userId);
    $stmt = $pdo->prepare("UPDATE user_story_stats SET {$field} = {$field} + ? WHERE user_id = ?");
    $stmt->execute([$amount, $userId]);
}

function buildStoryStatFeedback(PDO $pdo, int $userId, string $statKey): array
{
    $labels = [
        'set_guess_correct' => 'Set Guess',
        'higher_lower_correct' => 'Higher / Lower',
        'pack_opens' => 'Pack opens',
    ];
    $label = $labels[$statKey] ?? 'Storybook';

    $progressMap = fetchSetProgressMap($pdo, $userId);
    foreach ($progressMap as $setId => $progress) {
        if (!hasClaimedStoryChapter($pdo, $userId, $setId, 4)) {
            continue;
        }
        if (hasClaimedStoryChapter($pdo, $userId, $setId, 5)) {
            continue;
        }

        $ch5 = getChapterFiveQuestProgress($pdo, $userId, $setId);
        foreach ($ch5['requirements'] as $req) {
            if ($req['key'] !== $statKey) {
                continue;
            }

            return [
                'message' => "+1 {$label} — Storybook progress",
                'detail' => "{$progress['setName']}: {$req['current']}/{$req['target']} {$req['label']}",
                'setId' => $setId,
                'setName' => $progress['setName'],
                'statKey' => $statKey,
                'current' => (int) $req['current'],
                'target' => (int) $req['target'],
            ];
        }
    }

    return [
        'message' => "+1 {$label} — Storybook progress",
        'detail' => 'Claim Chapter 4 in Storybook to start secret chapter objectives.',
        'statKey' => $statKey,
    ];
}

function bumpUserStoryStatWithFeedback(PDO $pdo, int $userId, string $field, int $amount = 1): array
{
    bumpUserStoryStat($pdo, $userId, $field, $amount);
    return buildStoryStatFeedback($pdo, $userId, $field);
}

function chapterFiveTargetFor(PDO $pdo, int $userId, string $setId, string $requirementKey): int
{
    $seed = crc32($userId . '|' . $setId . '|ch5|' . $requirementKey);
    $min = 50;
    $max = 150;
    return $min + ((int) $seed % ($max - $min + 1));
}

function hasClaimedStoryChapter(PDO $pdo, int $userId, string $setId, int $chapterNo): bool
{
    $stmt = $pdo->prepare("
        SELECT 1
        FROM user_story_claims
        WHERE user_id = ? AND set_id = ? AND chapter_no = ?
        LIMIT 1
    ");
    $stmt->execute([$userId, $setId, $chapterNo]);
    return (bool) $stmt->fetchColumn();
}

function captureChapterFiveBaseline(PDO $pdo, int $userId, string $setId): void
{
    ensureUserStoryStatsRow($pdo, $userId);

    $statsStmt = $pdo->prepare("
        SELECT set_guess_correct, higher_lower_correct, pack_opens
        FROM user_story_stats
        WHERE user_id = ?
        LIMIT 1
    ");
    $statsStmt->execute([$userId]);
    $storyStats = $statsStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    $userStmt = $pdo->prepare("
        SELECT COALESCE(upgrader_wins, 0) AS upgrader_wins, COALESCE(battles_won, 0) AS battles_won
        FROM users
        WHERE id = ?
        LIMIT 1
    ");
    $userStmt->execute([$userId]);
    $userRow = $userStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    $wheelSpins = 0;
    try {
        $spinStmt = $pdo->prepare("SELECT COUNT(*) FROM wheel_spins WHERE user_id = ?");
        $spinStmt->execute([$userId]);
        $wheelSpins = (int) $spinStmt->fetchColumn();
    } catch (Throwable $e) {
        $wheelSpins = 0;
    }

    $insert = $pdo->prepare("
        INSERT IGNORE INTO user_story_ch5_baselines (
            user_id, set_id,
            baseline_set_guess_correct, baseline_higher_lower_correct, baseline_pack_opens,
            baseline_case_wins, baseline_wheel_spins, baseline_upgrader_wins
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $insert->execute([
        $userId,
        $setId,
        (int) ($storyStats['set_guess_correct'] ?? 0),
        (int) ($storyStats['higher_lower_correct'] ?? 0),
        (int) ($storyStats['pack_opens'] ?? 0),
        (int) ($userRow['battles_won'] ?? 0),
        $wheelSpins,
        (int) ($userRow['upgrader_wins'] ?? 0),
    ]);
}

function getChapterFiveQuestProgress(PDO $pdo, int $userId, string $setId): array
{
    ensureUserStoryStatsRow($pdo, $userId);

    $chapter4Claimed = hasClaimedStoryChapter($pdo, $userId, $setId, 4);
    if ($chapter4Claimed) {
        captureChapterFiveBaseline($pdo, $userId, $setId);
    }

    $statsStmt = $pdo->prepare("
        SELECT set_guess_correct, higher_lower_correct, pack_opens
        FROM user_story_stats
        WHERE user_id = ?
        LIMIT 1
    ");
    $statsStmt->execute([$userId]);
    $storyStats = $statsStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    $userStmt = $pdo->prepare("
        SELECT COALESCE(upgrader_wins, 0) AS upgrader_wins, COALESCE(battles_won, 0) AS battles_won
        FROM users
        WHERE id = ?
        LIMIT 1
    ");
    $userStmt->execute([$userId]);
    $userRow = $userStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    $wheelSpins = 0;
    try {
        $spinStmt = $pdo->prepare("SELECT COUNT(*) FROM wheel_spins WHERE user_id = ?");
        $spinStmt->execute([$userId]);
        $wheelSpins = (int) $spinStmt->fetchColumn();
    } catch (Throwable $e) {
        $wheelSpins = 0;
    }

    $baseStmt = $pdo->prepare("
        SELECT
            baseline_set_guess_correct,
            baseline_higher_lower_correct,
            baseline_pack_opens,
            baseline_case_wins,
            baseline_wheel_spins,
            baseline_upgrader_wins
        FROM user_story_ch5_baselines
        WHERE user_id = ? AND set_id = ?
        LIMIT 1
    ");
    $baseStmt->execute([$userId, $setId]);
    $baseline = $baseStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    $setGuessDelta = max(0, (int) ($storyStats['set_guess_correct'] ?? 0) - (int) ($baseline['baseline_set_guess_correct'] ?? 0));
    $higherLowerDelta = max(0, (int) ($storyStats['higher_lower_correct'] ?? 0) - (int) ($baseline['baseline_higher_lower_correct'] ?? 0));
    $packOpenDelta = max(0, (int) ($storyStats['pack_opens'] ?? 0) - (int) ($baseline['baseline_pack_opens'] ?? 0));
    $caseWinsDelta = max(0, (int) ($userRow['battles_won'] ?? 0) - (int) ($baseline['baseline_case_wins'] ?? 0));
    $wheelSpinsDelta = max(0, $wheelSpins - (int) ($baseline['baseline_wheel_spins'] ?? 0));
    $upgraderWinsDelta = max(0, (int) ($userRow['upgrader_wins'] ?? 0) - (int) ($baseline['baseline_upgrader_wins'] ?? 0));

    $requirements = [
        [
            'key' => 'set_guess_correct',
            'label' => 'Correct guess a set',
            'current' => $chapter4Claimed ? $setGuessDelta : 0,
            'target' => chapterFiveTargetFor($pdo, $userId, $setId, 'set_guess_correct'),
        ],
        [
            'key' => 'higher_lower_correct',
            'label' => 'Higher/lower correct',
            'current' => $chapter4Claimed ? $higherLowerDelta : 0,
            'target' => chapterFiveTargetFor($pdo, $userId, $setId, 'higher_lower_correct'),
        ],
        [
            'key' => 'case_wins',
            'label' => 'Case wins',
            'current' => $chapter4Claimed ? $caseWinsDelta : 0,
            'target' => chapterFiveTargetFor($pdo, $userId, $setId, 'case_wins'),
        ],
        [
            'key' => 'pack_opens',
            'label' => 'Pack opens',
            'current' => $chapter4Claimed ? $packOpenDelta : 0,
            'target' => chapterFiveTargetFor($pdo, $userId, $setId, 'pack_opens'),
        ],
        [
            'key' => 'wheel_spins',
            'label' => 'Spins on the wheel',
            'current' => $chapter4Claimed ? $wheelSpinsDelta : 0,
            'target' => chapterFiveTargetFor($pdo, $userId, $setId, 'wheel_spins'),
        ],
        [
            'key' => 'upgrader_wins',
            'label' => 'Upgrader wins',
            'current' => $chapter4Claimed ? $upgraderWinsDelta : 0,
            'target' => chapterFiveTargetFor($pdo, $userId, $setId, 'upgrader_wins'),
        ],
    ];

    $anyDone = false;
    foreach ($requirements as &$req) {
        $req['done'] = $req['current'] >= $req['target'];
        if ($req['done']) {
            $anyDone = true;
        }
    }
    unset($req);

    return ['requirements' => $requirements, 'allDone' => $chapter4Claimed && $anyDone, 'chapter4Claimed' => $chapter4Claimed];
}

function seedCosmetics(PDO $pdo): void
{
    $items = [
        ['title_rookie_collector', 'title', 'Rookie Collector', 'Starter title for every trainer.', 'common', 'none', 'starter', 'starter'],
        ['banner_ocean_blue', 'banner', 'Ocean Blue', 'Classic PokeVault blue profile banner.', 'common', 'none', 'starter', 'starter'],
        ['frame_neon_blue', 'frame', 'Neon Frame', 'Glowing profile frame with subtle pulse.', 'rare', 'pulse', 'starter', 'starter'],
        ['frame_mythic_cosmos', 'frame', 'Mythic Cosmos', 'Event-exclusive cosmic frame.', 'legendary', 'cosmic', 'event', 'summer_2026'],
        ['badge_event_ember', 'badge', 'Ember Sigil', 'Limited event badge with animated glow.', 'legendary', 'cosmic', 'event', 'summer_2026'],

        ['title_storyforge', 'title', 'Storyforge Adept', 'Unlock via Storybook chapter quests.', 'common', 'none', 'storybook', 'chapter_2'],
        ['title_archive_hunter', 'title', 'Archive Hunter', 'Unlock via Storybook chapter quests.', 'rare', 'pulse', 'storybook', 'chapter_2'],
        ['title_set_nomad', 'title', 'Set Nomad', 'Unlock via Storybook chapter quests.', 'rare', 'shimmer', 'storybook', 'chapter_2'],
        ['title_relic_scholar', 'title', 'Relic Scholar', 'Unlock via Storybook chapter quests.', 'epic', 'glow', 'storybook', 'chapter_2'],
        ['title_lorekeeper', 'title', 'Lorekeeper', 'Unlock via Storybook chapter quests.', 'epic', 'glow', 'storybook', 'chapter_2'],
        ['title_era_whisperer', 'title', 'Era Whisperer', 'Unlock via Storybook chapter quests.', 'rare', 'pulse', 'storybook', 'chapter_2'],
        ['title_chapter_breaker', 'title', 'Chapter Breaker', 'Unlock via Storybook chapter quests.', 'legendary', 'cosmic', 'storybook', 'chapter_2'],
        ['title_vault_oracle', 'title', 'Vault Oracle', 'Unlock via Storybook chapter quests.', 'legendary', 'cosmic', 'storybook', 'chapter_2'],

        ['banner_nebula_trace', 'banner', 'Nebula Trace', 'Unlock via Storybook chapter quests.', 'rare', 'shimmer', 'storybook', 'chapter_4'],
        ['banner_azure_ember', 'banner', 'Azure Ember', 'Unlock via Storybook chapter quests.', 'epic', 'glow', 'storybook', 'chapter_4'],
        ['banner_midnight_arc', 'banner', 'Midnight Arc', 'Unlock via Storybook chapter quests.', 'rare', 'pulse', 'storybook', 'chapter_4'],
        ['banner_holo_wave', 'banner', 'Holo Wave', 'Unlock via Storybook chapter quests.', 'epic', 'shimmer', 'storybook', 'chapter_4'],
        ['banner_starlit_tide', 'banner', 'Starlit Tide', 'Unlock via Storybook chapter quests.', 'rare', 'none', 'storybook', 'chapter_4'],
        ['banner_vault_rain', 'banner', 'Vault Rain', 'Unlock via Storybook chapter quests.', 'epic', 'glow', 'storybook', 'chapter_4'],
        ['banner_chronicle_flux', 'banner', 'Chronicle Flux', 'Unlock via Storybook chapter quests.', 'legendary', 'cosmic', 'storybook', 'chapter_4'],
        ['banner_void_prism', 'banner', 'Void Prism', 'Unlock via Storybook chapter quests.', 'legendary', 'cosmic', 'storybook', 'chapter_4'],

        ['frame_chrome_edge', 'frame', 'Chrome Edge', 'Unlock via Storybook chapter quests.', 'common', 'none', 'storybook', 'chapter_3'],
        ['frame_ion_loop', 'frame', 'Ion Loop', 'Unlock via Storybook chapter quests.', 'rare', 'pulse', 'storybook', 'chapter_3'],
        ['frame_glacier_ring', 'frame', 'Glacier Ring', 'Unlock via Storybook chapter quests.', 'rare', 'shimmer', 'storybook', 'chapter_3'],
        ['frame_obsidian_flare', 'frame', 'Obsidian Flare', 'Unlock via Storybook chapter quests.', 'epic', 'glow', 'storybook', 'chapter_3'],
        ['frame_flux_crown', 'frame', 'Flux Crown', 'Unlock via Storybook chapter quests.', 'epic', 'pulse', 'storybook', 'chapter_3'],
        ['frame_storybound', 'frame', 'Storybound', 'Unlock via Storybook chapter quests.', 'rare', 'none', 'storybook', 'chapter_3'],
        ['frame_aurora_gate', 'frame', 'Aurora Gate', 'Unlock via Storybook chapter quests.', 'legendary', 'cosmic', 'storybook', 'chapter_3'],
        ['frame_eclipse_prism', 'frame', 'Eclipse Prism', 'Unlock via Storybook chapter quests.', 'legendary', 'cosmic', 'storybook', 'chapter_3'],

        ['cardback_vault_blueprint', 'cardback', 'Vault Blueprint', 'Unlock via Storybook secret chapter quests.', 'common', 'none', 'storybook', 'chapter_5'],
        ['cardback_prism_engine', 'cardback', 'Prism Engine', 'Unlock via Storybook secret chapter quests.', 'rare', 'shimmer', 'storybook', 'chapter_5'],
        ['cardback_relic_grid', 'cardback', 'Relic Grid', 'Unlock via Storybook secret chapter quests.', 'rare', 'pulse', 'storybook', 'chapter_5'],
        ['cardback_crimson_sigil', 'cardback', 'Crimson Sigil', 'Unlock via Storybook secret chapter quests.', 'epic', 'glow', 'storybook', 'chapter_5'],
        ['cardback_frost_shard', 'cardback', 'Frost Shard', 'Unlock via Storybook secret chapter quests.', 'epic', 'shimmer', 'storybook', 'chapter_5'],
        ['cardback_inked_glyph', 'cardback', 'Inked Glyph', 'Unlock via Storybook secret chapter quests.', 'rare', 'none', 'storybook', 'chapter_5'],
        ['cardback_cosmic_archive', 'cardback', 'Cosmic Archive', 'Unlock via Storybook secret chapter quests.', 'legendary', 'cosmic', 'storybook', 'chapter_5'],
        ['cardback_starforge', 'cardback', 'Starforge', 'Unlock via Storybook secret chapter quests.', 'legendary', 'cosmic', 'storybook', 'chapter_5'],

        ['badge_story_spark', 'badge', 'Story Spark', 'Unlock via Storybook chapter quests.', 'common', 'none', 'storybook', 'chapter_1'],
        ['badge_set_scout', 'badge', 'Set Scout', 'Unlock via Storybook chapter quests.', 'rare', 'pulse', 'storybook', 'chapter_1'],
        ['badge_lore_pin', 'badge', 'Lore Pin', 'Unlock via Storybook chapter quests.', 'rare', 'shimmer', 'storybook', 'chapter_1'],
        ['badge_archive_key', 'badge', 'Archive Key', 'Unlock via Storybook chapter quests.', 'epic', 'glow', 'storybook', 'chapter_1'],
        ['badge_chapter_mark', 'badge', 'Chapter Mark', 'Unlock via Storybook chapter quests.', 'rare', 'none', 'storybook', 'chapter_1'],
        ['badge_relic_token', 'badge', 'Relic Token', 'Unlock via Storybook chapter quests.', 'epic', 'pulse', 'storybook', 'chapter_1'],
        ['badge_aurora_stamp', 'badge', 'Aurora Stamp', 'Unlock via Storybook chapter quests.', 'legendary', 'cosmic', 'storybook', 'chapter_1'],
        ['badge_void_emblem', 'badge', 'Void Emblem', 'Unlock via Storybook chapter quests.', 'legendary', 'cosmic', 'storybook', 'chapter_1'],
    ];

    $stmt = $pdo->prepare("
        INSERT IGNORE INTO cosmetics
            (cosmetic_key, type, name, description, rarity, animation, source_type, source_ref)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ");
    foreach ($items as $item) {
        $stmt->execute($item);
    }
}

function storybookCosmeticPools(): array
{
    return [
        1 => [
            'badge_story_spark',
            'badge_set_scout',
            'badge_lore_pin',
            'badge_archive_key',
            'badge_chapter_mark',
            'badge_relic_token',
            'badge_aurora_stamp',
            'badge_void_emblem',
        ],
        2 => [
            'title_storyforge',
            'title_archive_hunter',
            'title_set_nomad',
            'title_relic_scholar',
            'title_lorekeeper',
            'title_era_whisperer',
            'title_chapter_breaker',
            'title_vault_oracle',
        ],
        3 => [
            'frame_chrome_edge',
            'frame_ion_loop',
            'frame_glacier_ring',
            'frame_obsidian_flare',
            'frame_flux_crown',
            'frame_storybound',
            'frame_aurora_gate',
            'frame_eclipse_prism',
        ],
        4 => [
            'banner_nebula_trace',
            'banner_azure_ember',
            'banner_midnight_arc',
            'banner_holo_wave',
            'banner_starlit_tide',
            'banner_vault_rain',
            'banner_chronicle_flux',
            'banner_void_prism',
        ],
        5 => [
            'cardback_vault_blueprint',
            'cardback_prism_engine',
            'cardback_relic_grid',
            'cardback_crimson_sigil',
            'cardback_frost_shard',
            'cardback_inked_glyph',
            'cardback_cosmic_archive',
            'cardback_starforge',
        ],
    ];
}

function resolveStorybookRewardCosmeticKey(string $setId, int $chapterNo): ?string
{
    $pools = storybookCosmeticPools();
    $pool = $pools[$chapterNo] ?? null;
    if (!$pool || $setId === '') {
        return null;
    }
    $seed = abs((int) crc32($setId . '|chapter|' . $chapterNo));
    $idx = $seed % count($pool);
    return $pool[$idx] ?? null;
}

function getStorybookCosmeticSetHints(PDO $pdo): array
{
    static $cache = null;
    if (is_array($cache)) {
        return $cache;
    }

    $sql = "
        SELECT
            SUBSTRING_INDEX(card_id, '-', 1) AS set_id,
            MAX(set_name) AS set_name
        FROM battle_crate_items
        WHERE card_id LIKE '%-%'
        GROUP BY SUBSTRING_INDEX(card_id, '-', 1)
    ";
    $rows = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $byCosmetic = [];
    foreach ($rows as $row) {
        $setId = (string) ($row['set_id'] ?? '');
        $setName = trim((string) ($row['set_name'] ?? ''));
        if ($setId === '') {
            continue;
        }
        if ($setName === '') {
            $setName = strtoupper($setId);
        }
        for ($chapter = 1; $chapter <= 5; $chapter++) {
            $key = resolveStorybookRewardCosmeticKey($setId, $chapter);
            if (!$key) {
                continue;
            }
            if (!isset($byCosmetic[$key])) {
                $byCosmetic[$key] = [];
            }
            $label = $setName . " (Chapter {$chapter})";
            if (!in_array($label, $byCosmetic[$key], true)) {
                $byCosmetic[$key][] = $label;
            }
        }
    }

    $cache = $byCosmetic;
    return $cache;
}

function storybookSourceLabelForCosmetic(PDO $pdo, string $cosmeticKey, string $sourceRef): string
{
    if (!str_starts_with($sourceRef, 'chapter_')) {
        return 'Source: Storybook quest';
    }

    $chapterNo = (int) str_replace('chapter_', '', $sourceRef);
    $hints = getStorybookCosmeticSetHints($pdo)[$cosmeticKey] ?? [];

    if (!$hints) {
        return "Source: Storybook Chapter {$chapterNo}";
    }

    $sample = array_slice($hints, 0, 3);
    if (count($hints) > 3) {
        return 'Source: Storybook ' . implode(', ', $sample) . ', ...';
    }
    return 'Source: Storybook ' . implode(', ', $sample);
}

function deriveSetName(PDO $pdo, string $setId): string
{
    $stmt = $pdo->prepare("
        SELECT MAX(set_name) AS set_name
        FROM battle_crate_items
        WHERE card_id LIKE ?
    ");
    $stmt->execute([$setId . '-%']);
    $name = trim((string) ($stmt->fetchColumn() ?: ''));
    return $name !== '' ? $name : strtoupper($setId);
}

function deriveSetCoverImage(PDO $pdo, string $setId): ?string
{
    $stmt = $pdo->prepare("
        SELECT image
        FROM battle_crate_items
        WHERE card_id LIKE ? AND image IS NOT NULL AND image <> ''
        ORDER BY price DESC, id ASC
        LIMIT 1
    ");
    $stmt->execute([$setId . '-%']);
    $image = trim((string) ($stmt->fetchColumn() ?: ''));
    return $image !== '' ? $image : null;
}

function ensureSetStoryChapters(PDO $pdo, string $setId): void
{
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM set_story_chapters WHERE set_id = ?");
    $stmt->execute([$setId]);
    if ((int) $stmt->fetchColumn() > 0) {
        return;
    }

    $setName = deriveSetName($pdo, $setId);
    $chapters = [
        [1, "Origins of {$setName}", "Every set starts with a spark. Build momentum by collecting your first quarter.", 25, 30, 'badge_first_story', 0],
        [2, "{$setName} Rising", "Your binder fills up and rare pulls start to appear. Keep the streak alive.", 50, 45, null, 0],
        [3, "Echoes of {$setName}", "You are deep in the set now. Track missing cards and close the gaps.", 75, 60, null, 0],
        [4, "{$setName} Chronicle", "Set completed. Your collection becomes part of the PokeVault story archive.", 100, 120, 'title_set_historian', 0],
        [5, "{$setName} Secret Archive", "A hidden chapter unlocked only by true completionists.", 100, 150, 'banner_chronicle', 1],
    ];

    $insert = $pdo->prepare("
        INSERT IGNORE INTO set_story_chapters
            (set_id, chapter_no, title, body, unlock_pct, reward_coins, reward_cosmetic_key, is_secret)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ");
    foreach ($chapters as $chapter) {
        $insert->execute([
            $setId,
            $chapter[0],
            $chapter[1],
            $chapter[2],
            $chapter[3],
            $chapter[4],
            $chapter[5],
            $chapter[6],
        ]);
    }
}

function fetchSetProgressMap(PDO $pdo, int $userId): array
{
    $totals = [];
    $stmt = $pdo->query("SELECT card_id FROM battle_crate_items");
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $cardId = (string) ($row['card_id'] ?? '');
        if ($cardId === '') {
            continue;
        }
        $setId = deriveSetIdFromCardId($cardId);
        if (!isset($totals[$setId])) {
            $totals[$setId] = [];
        }
        $totals[$setId][$cardId] = true;
    }

    $owned = [];
    $stmt = $pdo->prepare("SELECT card_id FROM user_cards WHERE user_id = ? AND card_amount > 0");
    $stmt->execute([$userId]);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $cardId = (string) ($row['card_id'] ?? '');
        if ($cardId === '') {
            continue;
        }
        $setId = deriveSetIdFromCardId($cardId);
        if (!isset($owned[$setId])) {
            $owned[$setId] = [];
        }
        $owned[$setId][$cardId] = true;
    }

    $result = [];
    foreach ($totals as $setId => $cardsMap) {
        $total = count($cardsMap);
        if ($total <= 0) {
            continue;
        }
        $ownedCount = isset($owned[$setId]) ? count(array_intersect_key($cardsMap, $owned[$setId])) : 0;
        $pct = (int) floor(($ownedCount / $total) * 100);
        $result[$setId] = [
            'setId' => $setId,
            'setName' => deriveSetName($pdo, $setId),
            'coverImage' => deriveSetCoverImage($pdo, $setId),
            'owned' => $ownedCount,
            'total' => $total,
            'completionPct' => $pct,
        ];
    }
    uasort($result, static function (array $a, array $b): int {
        if ($a['completionPct'] === $b['completionPct']) {
            return strcmp($a['setName'], $b['setName']);
        }
        return $b['completionPct'] <=> $a['completionPct'];
    });
    return $result;
}

function fetchMissingSetCards(PDO $pdo, int $userId, string $setId, int $limit = 24): array
{
    $limit = max(1, min(60, $limit));
    $stmt = $pdo->prepare("
        SELECT bci.card_id, MAX(bci.name) AS name, MAX(bci.image) AS image, MAX(bci.price) AS price
        FROM battle_crate_items bci
        LEFT JOIN user_cards uc
            ON uc.card_id = bci.card_id
           AND uc.user_id = ?
           AND uc.card_amount > 0
        WHERE bci.card_id LIKE ?
          AND uc.card_id IS NULL
        GROUP BY bci.card_id
        ORDER BY MAX(bci.price) DESC, bci.card_id ASC
        LIMIT {$limit}
    ");
    $stmt->execute([$userId, $setId . '-%']);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    return array_map(static function (array $row): array {
        return [
            'cardId' => (string) ($row['card_id'] ?? ''),
            'name' => (string) ($row['name'] ?? ($row['card_id'] ?? 'Unknown card')),
            'image' => (string) ($row['image'] ?? ''),
            'price' => round((float) ($row['price'] ?? 0), 2),
        ];
    }, $rows);
}

function ensureStarterCosmeticsUnlocked(PDO $pdo, int $userId): void
{
    $starterKeys = ['title_rookie_collector', 'banner_ocean_blue', 'frame_neon_blue'];
    $stmt = $pdo->prepare("INSERT IGNORE INTO user_cosmetics (user_id, cosmetic_key) VALUES (?, ?)");
    foreach ($starterKeys as $key) {
        $stmt->execute([$userId, $key]);
    }

    $eventStmt = $pdo->prepare("SELECT COUNT(*) FROM user_cards WHERE user_id = ? AND card_amount > 0");
    $eventStmt->execute([$userId]);
    $totalOwned = (int) $eventStmt->fetchColumn();
    if ($totalOwned >= 120) {
        $stmt->execute([$userId, 'frame_mythic_cosmos']);
    }
    if ($totalOwned >= 180) {
        $stmt->execute([$userId, 'badge_event_ember']);
    }
}

function fetchUserCosmetics(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare("
        SELECT c.cosmetic_key, c.type, c.name, c.description, c.rarity, c.animation, c.source_type, c.source_ref,
               uc.unlocked_at
        FROM user_cosmetics uc
        INNER JOIN cosmetics c ON c.cosmetic_key = uc.cosmetic_key
        WHERE uc.user_id = ?
        ORDER BY FIELD(c.rarity, 'legendary','epic','rare','common'), c.type, c.name
    ");
    $stmt->execute([$userId]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
}

function fetchUserLoadout(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare("
        SELECT title_key, banner_key, frame_key, cardback_key, badge_1_key, badge_2_key, badge_3_key
        FROM user_profile_loadout
        WHERE user_id = ?
        LIMIT 1
    ");
    $stmt->execute([$userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
    return [
        'title' => $row['title_key'] ?? null,
        'banner' => $row['banner_key'] ?? null,
        'frame' => $row['frame_key'] ?? null,
        'cardback' => $row['cardback_key'] ?? null,
        'badges' => array_values(array_filter([
            $row['badge_1_key'] ?? null,
            $row['badge_2_key'] ?? null,
            $row['badge_3_key'] ?? null,
        ])),
    ];
}

function saveLoadoutSlot(PDO $pdo, int $userId, string $slot, ?string $cosmeticKey): void
{
    $stmt = $pdo->prepare("INSERT IGNORE INTO user_profile_loadout (user_id) VALUES (?)");
    $stmt->execute([$userId]);

    $columnMap = [
        'title' => 'title_key',
        'banner' => 'banner_key',
        'frame' => 'frame_key',
        'cardback' => 'cardback_key',
        'badge1' => 'badge_1_key',
        'badge2' => 'badge_2_key',
        'badge3' => 'badge_3_key',
    ];
    if (!isset($columnMap[$slot])) {
        throw new RuntimeException('Invalid loadout slot');
    }
    $column = $columnMap[$slot];
    $update = $pdo->prepare("UPDATE user_profile_loadout SET {$column} = ? WHERE user_id = ?");
    $update->execute([$cosmeticKey, $userId]);
}
