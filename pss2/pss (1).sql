-- phpMyAdmin SQL Dump
-- version 5.2.0
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Jun 15, 2026 at 09:21 AM
-- Server version: 8.0.30
-- PHP Version: 8.1.10

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `pss`
--

-- --------------------------------------------------------

--
-- Table structure for table `battle_crates`
--

CREATE TABLE `battle_crates` (
  `id` int NOT NULL,
  `slug` varchar(32) NOT NULL,
  `name` varchar(128) NOT NULL,
  `tier` varchar(24) NOT NULL,
  `price` decimal(12,2) NOT NULL DEFAULT '0.00',
  `image` text,
  `sort_order` int NOT NULL DEFAULT '0',
  `pool_seed` varchar(64) NOT NULL DEFAULT 'pss-global-v1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `battle_crates`
--

INSERT INTO `battle_crates` (`id`, `slug`, `name`, `tier`, `price`, `image`, `sort_order`, `pool_seed`, `created_at`) VALUES
(1, 'basic', 'Starter Pack', 'basic', '0.50', 'https://assets.tcgdex.net/en/bw/bw3/54/high.webp', 0, 'pss-global-v1', '2026-06-03 08:23:22'),
(2, 'basic_ii', 'Starter Pack II', 'basic', '0.50', 'https://assets.tcgdex.net/en/gym/gym2/58/high.webp', 1, 'pss-global-v1', '2026-06-03 08:23:22'),
(3, 'rare', 'Rare Pack', 'rare', '11.00', 'https://assets.tcgdex.net/en/bw/bw2/23/high.webp', 2, 'pss-global-v1', '2026-06-03 08:23:22'),
(4, 'rare_ii', 'Rare Pack II', 'rare', '11.00', 'https://assets.tcgdex.net/en/ex/ex13/12/high.webp', 3, 'pss-global-v1', '2026-06-03 08:23:22'),
(5, 'elite', 'Ultra Rare Pack', 'elite', '77.00', 'https://assets.tcgdex.net/en/hgss/hgss1/109/high.webp', 4, 'pss-global-v1', '2026-06-03 08:23:22'),
(6, 'elite_ii', 'Chase Pack', 'elite', '85.00', 'https://assets.tcgdex.net/en/bw/bw9/117/high.webp', 5, 'pss-global-v1', '2026-06-03 08:23:22');

-- --------------------------------------------------------

--
-- Table structure for table `battle_crate_items`
--

CREATE TABLE `battle_crate_items` (
  `id` int NOT NULL,
  `crate_id` int NOT NULL,
  `card_id` varchar(64) NOT NULL,
  `name` varchar(128) NOT NULL,
  `image` text,
  `rarity` varchar(32) DEFAULT NULL,
  `rarity_label` varchar(64) DEFAULT NULL,
  `set_name` varchar(128) DEFAULT NULL,
  `price` decimal(12,2) DEFAULT NULL,
  `drop_chance` decimal(10,4) NOT NULL DEFAULT '1.0000'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `battle_crate_items`
--

INSERT INTO `battle_crate_items` (`id`, `crate_id`, `card_id`, `name`, `image`, `rarity`, `rarity_label`, `set_name`, `price`, `drop_chance`) VALUES
(1, 1, 'bw3-54', 'Elgyem', 'https://assets.tcgdex.net/en/bw/bw3/54/high.webp', 'rare', 'Common', 'Noble Victories', '0.02', '100.0000'),
(2, 1, 'bw10-22', 'Glalie', 'https://assets.tcgdex.net/en/bw/bw10/22/high.webp', 'rare', 'Uncommon', 'Plasma Blast', '0.02', '100.0000'),
(3, 1, 'ex5-29', 'Beldum', 'https://assets.tcgdex.net/en/ex/ex5/29/high.webp', 'rare', 'Uncommon', 'Hidden Legends', '14.39', '100.0000'),
(4, 1, 'base5-70', 'Zubat', 'https://assets.tcgdex.net/en/base/base5/70/high.webp', 'rare', 'Common', 'Team Rocket', '0.02', '100.0000'),
(5, 1, 'bw1-18', 'Pignite', 'https://assets.tcgdex.net/en/bw/bw1/18/high.webp', 'rare', 'Uncommon', 'Black & White', '0.02', '100.0000'),
(6, 1, 'col1-45', 'Jolteon', 'https://assets.tcgdex.net/en/col/col1/45/high.webp', 'rare', 'Uncommon', 'Call of Legends', '0.07', '100.0000'),
(7, 1, 'gym1-38', 'Brock\'s Geodude', 'https://assets.tcgdex.net/en/gym/gym1/38/high.webp', 'rare', 'Uncommon', 'Gym Heroes', '0.49', '100.0000'),
(8, 1, 'ex10-94', 'Energy Search', 'https://assets.tcgdex.net/en/ex/ex10/94/high.webp', 'rare', 'Common', 'Unseen Forces', '0.02', '100.0000'),
(9, 1, 'ex8-67', 'Nincada', 'https://assets.tcgdex.net/en/ex/ex8/67/high.webp', 'rare', 'Common', 'Deoxys', '0.02', '100.0000'),
(10, 1, 'bw3-38', 'Tynamo', 'https://assets.tcgdex.net/en/bw/bw3/38/high.webp', 'rare', 'Common', 'Noble Victories', '0.02', '100.0000'),
(11, 1, 'dp3-53', 'Kirlia', 'https://assets.tcgdex.net/en/dp/dp3/53/high.webp', 'rare', 'Uncommon', 'Secret Wonders', '0.02', '100.0000'),
(12, 1, 'ex16-32', 'Lairon', 'https://assets.tcgdex.net/en/ex/ex16/32/high.webp', 'rare', 'Uncommon', 'Power Keepers', '0.02', '100.0000'),
(13, 1, 'bw7-78', 'Sandshrew', 'https://assets.tcgdex.net/en/bw/bw7/78/high.webp', 'rare', 'Common', 'Boundaries Crossed', '0.02', '100.0000'),
(14, 1, 'ex10-81', 'Energy Recycle System', 'https://assets.tcgdex.net/en/ex/ex10/81/high.webp', 'rare', 'Uncommon', 'Unseen Forces', '0.02', '100.0000'),
(15, 1, 'g1-31', 'Golbat', 'https://assets.tcgdex.net/en/xy/g1/31/high.webp', 'rare', 'Uncommon', 'Generations', '0.02', '100.0000'),
(16, 1, 'ex8-32', 'Grumpig', 'https://assets.tcgdex.net/en/ex/ex8/32/high.webp', 'rare', 'Uncommon', 'Deoxys', '0.05', '100.0000'),
(17, 1, 'ex1-80', 'Energy Removal 2', 'https://assets.tcgdex.net/en/ex/ex1/80/high.webp', 'rare', 'Uncommon', 'Ruby & Sapphire', '0.05', '100.0000'),
(18, 1, 'dp2-60', 'Quilava', 'https://assets.tcgdex.net/en/dp/dp2/60/high.webp', 'rare', 'Uncommon', 'Mysterious Treasures', '0.05', '100.0000'),
(19, 1, 'bw9-41', 'Nidorina', 'https://assets.tcgdex.net/en/bw/bw9/41/high.webp', 'rare', 'Uncommon', 'Plasma Freeze', '0.02', '100.0000'),
(20, 1, 'ex7-74', 'Sandshrew', 'https://assets.tcgdex.net/en/ex/ex7/74/high.webp', 'rare', 'Common', 'Team Rocket Returns', '0.10', '100.0000'),
(21, 1, 'gym1-80', 'Lt. Surge\'s Magnemite', 'https://assets.tcgdex.net/en/gym/gym1/80/high.webp', 'rare', 'Common', 'Gym Heroes', '7.00', '100.0000'),
(22, 1, 'gym2-99', 'Sabrina\'s Psyduck', 'https://assets.tcgdex.net/en/gym/gym2/99/high.webp', 'rare', 'Common', 'Gym Challenge', '1.49', '100.0000'),
(23, 1, 'bw1-59', 'Timburr', 'https://assets.tcgdex.net/en/bw/bw1/59/high.webp', 'rare', 'Common', 'Black & White', '0.02', '100.0000'),
(24, 1, 'ex5-89', 'Island Cave', 'https://assets.tcgdex.net/en/ex/ex5/89/high.webp', 'rare', 'Uncommon', 'Hidden Legends', '0.05', '100.0000'),
(25, 1, 'dp7-45', 'Pichu', 'https://assets.tcgdex.net/en/dp/dp7/45/high.webp', 'rare', 'Uncommon', 'Stormfront', '0.30', '100.0000'),
(26, 1, 'base1-64', 'Starmie', 'https://assets.tcgdex.net/en/base/base1/64/high.webp', 'rare', 'Common', 'Base Set', '0.02', '100.0000'),
(27, 1, 'gym2-91', 'Misty\'s Seel', 'https://assets.tcgdex.net/en/gym/gym2/91/high.webp', 'rare', 'Common', 'Gym Challenge', '0.02', '100.0000'),
(28, 1, 'bw11-5', 'Carnivine', 'https://assets.tcgdex.net/en/bw/bw11/5/high.webp', 'rare', 'Uncommon', 'Legendary Treasures', '0.20', '100.0000'),
(29, 1, 'col1-54', 'Clefairy', 'https://assets.tcgdex.net/en/col/col1/54/high.webp', 'rare', 'Common', 'Call of Legends', '0.02', '100.0000'),
(30, 1, 'bw11-25', 'Tepig', 'https://assets.tcgdex.net/en/bw/bw11/25/high.webp', 'rare', 'Common', 'Legendary Treasures', '0.20', '100.0000'),
(31, 1, 'ex4-69', 'Team Aqua Schemer', 'https://assets.tcgdex.net/en/ex/ex4/69/high.webp', 'rare', 'Common', 'Team Magma vs Team Aqua', '0.02', '100.0000'),
(32, 1, 'bw10-76', 'Ursaring', 'https://assets.tcgdex.net/en/bw/bw10/76/high.webp', 'rare', 'Uncommon', 'Plasma Blast', '0.02', '100.0000'),
(33, 1, 'ex13-51', 'Raichu', 'https://assets.tcgdex.net/en/ex/ex13/51/high.webp', 'rare', 'Uncommon', 'Holon Phantoms', '0.18', '100.0000'),
(34, 1, 'g1-RC17', 'Flabébé', 'https://assets.tcgdex.net/en/xy/g1/RC17/high.webp', 'rare', 'Common', 'Generations', '0.25', '100.0000'),
(35, 1, 'ex13-35', 'Aerodactyl δ', 'https://assets.tcgdex.net/en/ex/ex13/35/high.webp', 'rare', 'Uncommon', 'Holon Phantoms', '1.00', '100.0000'),
(36, 1, 'bw7-70', 'Woobat', 'https://assets.tcgdex.net/en/bw/bw7/70/high.webp', 'rare', 'Common', 'Boundaries Crossed', '0.02', '100.0000'),
(37, 1, 'ex13-83', 'Torchic', 'https://assets.tcgdex.net/en/ex/ex13/83/high.webp', 'rare', 'Common', 'Holon Phantoms', '0.02', '100.0000'),
(38, 1, 'bw3-20', 'Larvesta', 'https://assets.tcgdex.net/en/bw/bw3/20/high.webp', 'rare', 'Common', 'Noble Victories', '0.02', '100.0000'),
(39, 1, 'dp1-93', 'Piplup', 'https://assets.tcgdex.net/en/dp/dp1/93/high.webp', 'rare', 'Common', 'Diamond & Pearl', '0.02', '100.0000'),
(40, 1, 'base4-86', 'Pidgey', 'https://assets.tcgdex.net/en/base/base4/86/high.webp', 'rare', 'Common', 'Base Set 2', '0.10', '100.0000'),
(41, 1, 'bw9-61', 'Onix', 'https://assets.tcgdex.net/en/bw/bw9/61/high.webp', 'rare', 'Uncommon', 'Plasma Freeze', '0.02', '100.0000'),
(42, 1, 'bw11-RC7', 'Pikachu', 'https://assets.tcgdex.net/en/bw/bw11/RC7/high.webp', 'rare', 'Uncommon', 'Legendary Treasures', '25.00', '100.0000'),
(43, 1, 'ex11-58', 'Bagon δ', 'https://assets.tcgdex.net/en/ex/ex11/58/high.webp', 'rare', 'Common', 'Delta Species', '0.02', '100.0000'),
(44, 1, 'ex9-64', 'Snorunt', 'https://assets.tcgdex.net/en/ex/ex9/64/high.webp', 'rare', 'Common', 'Emerald', '0.02', '100.0000'),
(45, 1, 'ex16-34', 'Medicham', 'https://assets.tcgdex.net/en/ex/ex16/34/high.webp', 'rare', 'Uncommon', 'Power Keepers', '0.05', '100.0000'),
(46, 1, 'bw8-54', 'Golbat', 'https://assets.tcgdex.net/en/bw/bw8/54/high.webp', 'rare', 'Uncommon', 'Plasma Storm', '0.02', '100.0000'),
(47, 1, 'bw2-24', 'Basculin', 'https://assets.tcgdex.net/en/bw/bw2/24/high.webp', 'rare', 'Common', 'Emerging Powers', '0.02', '100.0000'),
(48, 1, 'dp3-51', 'Ivysaur', 'https://assets.tcgdex.net/en/dp/dp3/51/high.webp', 'rare', 'Uncommon', 'Secret Wonders', '0.02', '100.0000'),
(49, 1, 'ecard1-132', 'Squirtle', 'https://assets.tcgdex.net/en/ecard/ecard1/132/high.webp', 'rare', 'Common', 'Expedition Base Set', '0.50', '100.0000'),
(50, 1, 'dp6-71', 'Starmie', 'https://assets.tcgdex.net/en/dp/dp6/71/high.webp', 'rare', 'Uncommon', 'Legends Awakened', '0.02', '100.0000'),
(51, 2, 'gym2-58', 'Sabrina\'s Kadabra', 'https://assets.tcgdex.net/en/gym/gym2/58/high.webp', 'rare', 'Uncommon', 'Gym Challenge', '0.49', '100.0000'),
(52, 2, 'ex16-27', 'Cacturne', 'https://assets.tcgdex.net/en/ex/ex16/27/high.webp', 'rare', 'Uncommon', 'Power Keepers', '0.02', '100.0000'),
(53, 2, 'base4-47', 'Kakuna', 'https://assets.tcgdex.net/en/base/base4/47/high.webp', 'rare', 'Uncommon', 'Base Set 2', '0.02', '100.0000'),
(54, 2, 'dp7-73', 'Skorupi', 'https://assets.tcgdex.net/en/dp/dp7/73/high.webp', 'rare', 'Common', 'Stormfront', '0.02', '100.0000'),
(55, 2, 'bw2-51', 'Boldore', 'https://assets.tcgdex.net/en/bw/bw2/51/high.webp', 'rare', 'Uncommon', 'Emerging Powers', '0.02', '100.0000'),
(56, 2, 'ex15-69', 'Trapinch δ', 'https://assets.tcgdex.net/en/ex/ex15/69/high.webp', 'rare', 'Common', 'Dragon Frontiers', '0.02', '100.0000'),
(57, 2, 'gym2-61', 'Blaine\'s Doduo', 'https://assets.tcgdex.net/en/gym/gym2/61/high.webp', 'rare', 'Common', 'Gym Challenge', '0.02', '100.0000'),
(58, 2, 'base4-43', 'Haunter', 'https://assets.tcgdex.net/en/base/base4/43/high.webp', 'rare', 'Uncommon', 'Base Set 2', '0.12', '100.0000'),
(59, 2, 'dp2-54', 'Magmar', 'https://assets.tcgdex.net/en/dp/dp2/54/high.webp', 'rare', 'Uncommon', 'Mysterious Treasures', '0.02', '100.0000'),
(60, 2, 'dp1-69', 'Azurill', 'https://assets.tcgdex.net/en/dp/dp1/69/high.webp', 'rare', 'Common', 'Diamond & Pearl', '0.02', '100.0000'),
(61, 2, 'bw11-26', 'Pignite', 'https://assets.tcgdex.net/en/bw/bw11/26/high.webp', 'rare', 'Uncommon', 'Legendary Treasures', '2.50', '100.0000'),
(62, 2, 'bw8-1', 'Turtwig', 'https://assets.tcgdex.net/en/bw/bw8/1/high.webp', 'rare', 'Common', 'Plasma Storm', '0.02', '100.0000'),
(63, 2, 'dp2-116', 'Armor Fossil', 'https://assets.tcgdex.net/en/dp/dp2/116/high.webp', 'rare', 'Common', 'Mysterious Treasures', '0.02', '100.0000'),
(64, 2, 'dp6-103', 'Houndour', 'https://assets.tcgdex.net/en/dp/dp6/103/high.webp', 'rare', 'Common', 'Legends Awakened', '0.03', '100.0000'),
(65, 2, 'dp5-41', 'Monferno', 'https://assets.tcgdex.net/en/dp/dp5/41/high.webp', 'rare', 'Uncommon', 'Majestic Dawn', '0.03', '100.0000'),
(66, 2, 'dp5-66', 'Hippopotas', 'https://assets.tcgdex.net/en/dp/dp5/66/high.webp', 'rare', 'Common', 'Majestic Dawn', '0.02', '100.0000'),
(67, 2, 'ex8-68', 'Numel', 'https://assets.tcgdex.net/en/ex/ex8/68/high.webp', 'rare', 'Common', 'Deoxys', '0.02', '100.0000'),
(68, 2, 'base4-86', 'Pidgey', 'https://assets.tcgdex.net/en/base/base4/86/high.webp', 'rare', 'Common', 'Base Set 2', '0.10', '100.0000'),
(69, 2, 'bw7-14', 'Cottonee', 'https://assets.tcgdex.net/en/bw/bw7/14/high.webp', 'rare', 'Common', 'Boundaries Crossed', '0.02', '100.0000'),
(70, 2, 'bw3-68', 'Stunfisk', 'https://assets.tcgdex.net/en/bw/bw3/68/high.webp', 'rare', 'Uncommon', 'Noble Victories', '0.02', '100.0000'),
(71, 2, 'bw8-105', 'Whismur', 'https://assets.tcgdex.net/en/bw/bw8/105/high.webp', 'rare', 'Common', 'Plasma Storm', '0.02', '100.0000'),
(72, 2, 'ex7-37', 'Dark Houndoom', 'https://assets.tcgdex.net/en/ex/ex7/37/high.webp', 'rare', 'Uncommon', 'Team Rocket Returns', '3.00', '100.0000'),
(73, 2, 'bw6-60', 'Cubone', 'https://assets.tcgdex.net/en/bw/bw6/60/high.webp', 'rare', 'Common', 'Dragons Exalted', '0.02', '100.0000'),
(74, 2, 'ecard1-153', 'Energy Search', 'https://assets.tcgdex.net/en/ecard/ecard1/153/high.webp', 'rare', 'Common', 'Expedition Base Set', '0.02', '100.0000'),
(75, 2, 'g1-50', 'Clefairy', 'https://assets.tcgdex.net/en/xy/g1/50/high.webp', 'rare', 'Common', 'Generations', '0.02', '100.0000'),
(76, 2, 'base1-87', 'Pokédex', 'https://assets.tcgdex.net/en/base/base1/87/high.webp', 'rare', 'Uncommon', 'Base Set', '0.02', '100.0000'),
(77, 2, 'ex16-86', 'Root Fossil', 'https://assets.tcgdex.net/en/ex/ex16/86/high.webp', 'rare', 'Common', 'Power Keepers', '0.02', '100.0000'),
(78, 2, 'bw8-112', 'Watchog', 'https://assets.tcgdex.net/en/bw/bw8/112/high.webp', 'rare', 'Uncommon', 'Plasma Storm', '0.02', '100.0000'),
(79, 2, 'gym1-117', 'Sabrina\'s ESP', 'https://assets.tcgdex.net/en/gym/gym1/117/high.webp', 'rare', 'Uncommon', 'Gym Heroes', '0.20', '100.0000'),
(80, 2, 'ex4-63', 'Team Magma\'s Houndour', 'https://assets.tcgdex.net/en/ex/ex4/63/high.webp', 'rare', 'Common', 'Team Magma vs Team Aqua', '0.03', '100.0000'),
(81, 2, 'bw11-47', 'Plusle', 'https://assets.tcgdex.net/en/bw/bw11/47/high.webp', 'rare', 'Uncommon', 'Legendary Treasures', '0.30', '100.0000'),
(82, 2, 'ex5-77', 'Tentacool', 'https://assets.tcgdex.net/en/ex/ex5/77/high.webp', 'rare', 'Common', 'Hidden Legends', '0.02', '100.0000'),
(83, 2, 'ex7-51', 'Cubone', 'https://assets.tcgdex.net/en/ex/ex7/51/high.webp', 'rare', 'Common', 'Team Rocket Returns', '0.10', '100.0000'),
(84, 2, 'ex9-28', 'Grovyle', 'https://assets.tcgdex.net/en/ex/ex9/28/high.webp', 'rare', 'Uncommon', 'Emerald', '0.02', '100.0000'),
(85, 2, 'base3-56', 'Tentacool', 'https://assets.tcgdex.net/en/base/base3/56/high.webp', 'rare', 'Common', 'Fossil', '0.02', '100.0000'),
(86, 2, 'ex11-65', 'Dratini δ', 'https://assets.tcgdex.net/en/ex/ex11/65/high.webp', 'rare', 'Common', 'Delta Species', '0.02', '100.0000'),
(87, 2, 'ex7-52', 'Dratini', 'https://assets.tcgdex.net/en/ex/ex7/52/high.webp', 'rare', 'Common', 'Team Rocket Returns', '0.10', '100.0000'),
(88, 2, 'dp1-82', 'Gastly', 'https://assets.tcgdex.net/en/dp/dp1/82/high.webp', 'rare', 'Common', 'Diamond & Pearl', '0.02', '100.0000'),
(89, 2, 'bw7-134', 'Skyla', 'https://assets.tcgdex.net/en/bw/bw7/134/high.webp', 'rare', 'Uncommon', 'Boundaries Crossed', '0.02', '100.0000'),
(90, 2, 'ecard1-140', 'Energy Removal 2', 'https://assets.tcgdex.net/en/ecard/ecard1/140/high.webp', 'rare', 'Uncommon', 'Expedition Base Set', '0.10', '100.0000'),
(91, 2, 'bw7-133', 'Rocky Helmet', 'https://assets.tcgdex.net/en/bw/bw7/133/high.webp', 'rare', 'Uncommon', 'Boundaries Crossed', '0.02', '100.0000'),
(92, 2, 'dp2-108', 'Zubat', 'https://assets.tcgdex.net/en/dp/dp2/108/high.webp', 'rare', 'Common', 'Mysterious Treasures', '0.02', '100.0000'),
(93, 2, 'bw10-85', 'Rare Candy', 'https://assets.tcgdex.net/en/bw/bw10/85/high.webp', 'rare', 'Uncommon', 'Plasma Blast', '0.05', '100.0000'),
(94, 2, 'ex1-57', 'Makuhita', 'https://assets.tcgdex.net/en/ex/ex1/57/high.webp', 'rare', 'Common', 'Ruby & Sapphire', '0.02', '100.0000'),
(95, 2, 'bw10-14', 'Squirtle', 'https://assets.tcgdex.net/en/bw/bw10/14/high.webp', 'rare', 'Common', 'Plasma Blast', '0.02', '100.0000'),
(96, 2, 'ex12-57', 'Machop', 'https://assets.tcgdex.net/en/ex/ex12/57/high.webp', 'rare', 'Common', 'Legend Maker', '0.02', '100.0000'),
(97, 2, 'ex2-68', 'Marill', 'https://assets.tcgdex.net/en/ex/ex2/68/high.webp', 'rare', 'Common', 'Sandstorm', '0.02', '100.0000'),
(98, 2, 'dp5-85', 'Poké Ball', 'https://assets.tcgdex.net/en/dp/dp5/85/high.webp', 'rare', 'Uncommon', 'Majestic Dawn', '0.02', '100.0000'),
(99, 2, 'dp1-111', 'Pokédex HANDY910is', 'https://assets.tcgdex.net/en/dp/dp1/111/high.webp', 'rare', 'Uncommon', 'Diamond & Pearl', '0.02', '100.0000'),
(100, 2, 'bw11-RC5', 'Torchic', 'https://assets.tcgdex.net/en/bw/bw11/RC5/high.webp', 'rare', 'Common', 'Legendary Treasures', '2.00', '100.0000'),
(101, 3, 'bw2-23', 'Simipour', 'https://assets.tcgdex.net/en/bw/bw2/23/high.webp', 'rare', 'Rare', 'Emerging Powers', '0.55', '100.0000'),
(102, 3, 'ex13-33', 'Torkoal', 'https://assets.tcgdex.net/en/ex/ex13/33/high.webp', 'rare', 'Rare', 'Holon Phantoms', '1.20', '100.0000'),
(103, 3, 'base2-6', 'Mr. Mime', 'https://assets.tcgdex.net/en/base/base2/6/high.webp', 'rare', 'Rare', 'Jungle', '27.19', '100.0000'),
(104, 3, 'ex6-18', 'Arcanine', 'https://assets.tcgdex.net/en/ex/ex6/18/high.webp', 'rare', 'Rare', 'FireRed & LeafGreen', '2.05', '100.0000'),
(105, 3, 'ex12-19', 'Lanturn', 'https://assets.tcgdex.net/en/ex/ex12/19/high.webp', 'rare', 'Rare', 'Legend Maker', '1.50', '100.0000'),
(106, 3, 'base1-13', 'Poliwrath', 'https://assets.tcgdex.net/en/base/base1/13/high.webp', 'rare', 'Rare', 'Base Set', '26.93', '100.0000'),
(107, 3, 'bw6-37', 'Alomomola', 'https://assets.tcgdex.net/en/bw/bw6/37/high.webp', 'rare', 'Rare', 'Dragons Exalted', '1.31', '100.0000'),
(108, 3, 'base5-20', 'Dark Blastoise', 'https://assets.tcgdex.net/en/base/base5/20/high.webp', 'rare', 'Rare', 'Team Rocket', '182.83', '100.0000'),
(109, 3, 'ex9-2', 'Deoxys', 'https://assets.tcgdex.net/en/ex/ex9/2/high.webp', 'rare', 'Rare', 'Emerald', '60.00', '100.0000'),
(110, 3, 'bw3-84', 'Cobalion', 'https://assets.tcgdex.net/en/bw/bw3/84/high.webp', 'rare', 'Rare', 'Noble Victories', '2.50', '100.0000'),
(111, 3, 'gym2-21', 'Blaine\'s Ninetales', 'https://assets.tcgdex.net/en/gym/gym2/21/high.webp', 'rare', 'Rare', 'Gym Challenge', '15.11', '100.0000'),
(112, 3, 'dp7-101', 'Charmander', 'https://assets.tcgdex.net/en/dp/dp7/101/high.webp', 'rare', 'Rare', 'Stormfront', '48.01', '100.0000'),
(113, 3, 'bw9-33', 'Electrode', 'https://assets.tcgdex.net/en/bw/bw9/33/high.webp', 'rare', 'Rare', 'Plasma Freeze', '0.92', '100.0000'),
(114, 3, 'dp5-17', 'Empoleon', 'https://assets.tcgdex.net/en/dp/dp5/17/high.webp', 'rare', 'Rare', 'Majestic Dawn', '0.80', '100.0000'),
(115, 3, 'col1-14', 'Lucario', 'https://assets.tcgdex.net/en/col/col1/14/high.webp', 'rare', 'Rare Holo', 'Call of Legends', '7.77', '100.0000'),
(116, 3, 'ex15-13', 'Arbok δ', 'https://assets.tcgdex.net/en/ex/ex15/13/high.webp', 'rare', 'Rare', 'Dragon Frontiers', '1.40', '100.0000'),
(117, 3, 'ex16-1', 'Aggron', 'https://assets.tcgdex.net/en/ex/ex16/1/high.webp', 'rare', 'Rare', 'Power Keepers', '6.92', '100.0000'),
(118, 3, 'ex2-8', 'Lunatone', 'https://assets.tcgdex.net/en/ex/ex2/8/high.webp', 'rare', 'Rare', 'Sandstorm', '33.00', '100.0000'),
(119, 3, 'ex4-7', 'Team Magma\'s Aggron', 'https://assets.tcgdex.net/en/ex/ex4/7/high.webp', 'rare', 'Rare', 'Team Magma vs Team Aqua', '6.92', '100.0000'),
(120, 3, 'ex6-21', 'Dodrio', 'https://assets.tcgdex.net/en/ex/ex6/21/high.webp', 'rare', 'Rare', 'FireRed & LeafGreen', '1.05', '100.0000'),
(121, 3, 'dp1-15', 'Skuntank', 'https://assets.tcgdex.net/en/dp/dp1/15/high.webp', 'rare', 'Rare Holo', 'Diamond & Pearl', '2.96', '100.0000'),
(122, 3, 'bw7-81', 'Gliscor', 'https://assets.tcgdex.net/en/bw/bw7/81/high.webp', 'rare', 'Rare', 'Boundaries Crossed', '6.47', '100.0000'),
(123, 3, 'gym1-9', 'Misty\'s Seadra', 'https://assets.tcgdex.net/en/gym/gym1/9/high.webp', 'rare', 'Rare Holo', 'Gym Heroes', '64.00', '100.0000'),
(124, 3, 'ex15-19', 'Lickitung δ', 'https://assets.tcgdex.net/en/ex/ex15/19/high.webp', 'rare', 'Rare', 'Dragon Frontiers', '2.44', '100.0000'),
(125, 3, 'gym1-12', 'Rocket\'s Moltres', 'https://assets.tcgdex.net/en/gym/gym1/12/high.webp', 'rare', 'Rare Holo', 'Gym Heroes', '114.66', '100.0000'),
(126, 3, 'ex12-5', 'Gengar', 'https://assets.tcgdex.net/en/ex/ex12/5/high.webp', 'rare', 'Rare', 'Legend Maker', '28.23', '100.0000'),
(127, 3, 'ex12-15', 'Absol', 'https://assets.tcgdex.net/en/ex/ex12/15/high.webp', 'rare', 'Rare', 'Legend Maker', '4.95', '100.0000'),
(128, 3, 'dp3-19', 'Suicune', 'https://assets.tcgdex.net/en/dp/dp3/19/high.webp', 'rare', 'Rare Holo', 'Secret Wonders', '6.29', '100.0000'),
(129, 3, 'ex10-12', 'Porygon2', 'https://assets.tcgdex.net/en/ex/ex10/12/high.webp', 'rare', 'Rare', 'Unseen Forces', '12.13', '100.0000'),
(130, 3, 'base3-20', 'Gengar', 'https://assets.tcgdex.net/en/base/base3/20/high.webp', 'rare', 'Rare', 'Fossil', '154.04', '100.0000'),
(131, 3, 'bw7-94', 'Scizor', 'https://assets.tcgdex.net/en/bw/bw7/94/high.webp', 'rare', 'Rare', 'Boundaries Crossed', '10.49', '100.0000'),
(132, 3, 'dp3-8', 'Gastrodon East Sea', 'https://assets.tcgdex.net/en/dp/dp3/8/high.webp', 'rare', 'Rare Holo', 'Secret Wonders', '3.07', '100.0000'),
(133, 3, 'base1-6', 'Gyarados', 'https://assets.tcgdex.net/en/base/base1/6/high.webp', 'rare', 'Rare', 'Base Set', '29.50', '100.0000'),
(134, 3, 'base5-26', 'Dark Hypno', 'https://assets.tcgdex.net/en/base/base5/26/high.webp', 'rare', 'Rare', 'Team Rocket', '39.32', '100.0000'),
(135, 3, 'ex4-89', 'Blaziken ex', 'https://assets.tcgdex.net/en/ex/ex4/89/high.webp', 'rare', 'Rare', 'Team Magma vs Team Aqua', '93.85', '100.0000'),
(136, 3, 'col1-25', 'Feraligatr', 'https://assets.tcgdex.net/en/col/col1/25/high.webp', 'rare', 'Rare', 'Call of Legends', '8.95', '100.0000'),
(137, 3, 'ecard1-30', 'Venusaur', 'https://assets.tcgdex.net/en/ecard/ecard1/30/high.webp', 'rare', 'Rare', 'Expedition Base Set', '154.11', '100.0000'),
(138, 3, 'ex6-105', 'Charizard ex', 'https://assets.tcgdex.net/en/ex/ex6/105/high.webp', 'rare', 'Rare', 'FireRed & LeafGreen', '646.30', '100.0000'),
(139, 3, 'ex13-13', 'Omastar δ', 'https://assets.tcgdex.net/en/ex/ex13/13/high.webp', 'rare', 'Rare', 'Holon Phantoms', '19.99', '100.0000'),
(140, 3, 'base1-21', 'Electrode', 'https://assets.tcgdex.net/en/base/base1/21/high.webp', 'rare', 'Rare', 'Base Set', '9.81', '100.0000'),
(141, 3, 'ex3-94', 'Latios ex', 'https://assets.tcgdex.net/en/ex/ex3/94/high.webp', 'rare', 'Rare', 'Dragon', '129.36', '100.0000'),
(142, 3, 'col1-32', 'Slowking', 'https://assets.tcgdex.net/en/col/col1/32/high.webp', 'rare', 'Rare', 'Call of Legends', '4.03', '100.0000'),
(143, 3, 'col1-18', 'Pachirisu', 'https://assets.tcgdex.net/en/col/col1/18/high.webp', 'rare', 'Rare Holo', 'Call of Legends', '10.48', '100.0000'),
(144, 3, 'ex5-99', 'Registeel ex', 'https://assets.tcgdex.net/en/ex/ex5/99/high.webp', 'rare', 'Rare', 'Hidden Legends', '38.39', '100.0000'),
(145, 3, 'ex6-28', 'Primeape', 'https://assets.tcgdex.net/en/ex/ex6/28/high.webp', 'rare', 'Rare', 'FireRed & LeafGreen', '1.98', '100.0000'),
(146, 3, 'dp1-22', 'Clefable', 'https://assets.tcgdex.net/en/dp/dp1/22/high.webp', 'rare', 'Rare', 'Diamond & Pearl', '2.79', '100.0000'),
(147, 3, 'ex16-10', 'Kabutops', 'https://assets.tcgdex.net/en/ex/ex16/10/high.webp', 'rare', 'Rare', 'Power Keepers', '6.46', '100.0000'),
(148, 3, 'ex2-100', 'Wailord ex', 'https://assets.tcgdex.net/en/ex/ex2/100/high.webp', 'rare', 'Rare', 'Sandstorm', '41.81', '100.0000'),
(149, 3, 'ex5-10', 'Medicham', 'https://assets.tcgdex.net/en/ex/ex5/10/high.webp', 'rare', 'Rare', 'Hidden Legends', '7.99', '100.0000'),
(150, 3, 'ex3-4', 'Flygon', 'https://assets.tcgdex.net/en/ex/ex3/4/high.webp', 'rare', 'Rare', 'Dragon', '32.99', '100.0000'),
(151, 4, 'ex13-12', 'Latios δ', 'https://assets.tcgdex.net/en/ex/ex13/12/high.webp', 'rare', 'Rare', 'Holon Phantoms', '20.74', '100.0000'),
(152, 4, 'ex14-98', 'Swampert ex', 'https://assets.tcgdex.net/en/ex/ex14/98/high.webp', 'rare', 'Rare', 'Crystal Guardians', '165.00', '100.0000'),
(153, 4, 'bw8-101', 'Snorlax', 'https://assets.tcgdex.net/en/bw/bw8/101/high.webp', 'rare', 'Rare', 'Plasma Storm', '10.00', '100.0000'),
(154, 4, 'ex2-18', 'Kecleon', 'https://assets.tcgdex.net/en/ex/ex2/18/high.webp', 'rare', 'Rare', 'Sandstorm', '1.44', '100.0000'),
(155, 4, 'bw9-84', 'Kingdra', 'https://assets.tcgdex.net/en/bw/bw9/84/high.webp', 'rare', 'Rare', 'Plasma Freeze', '3.88', '100.0000'),
(156, 4, 'ex5-12', 'Milotic', 'https://assets.tcgdex.net/en/ex/ex5/12/high.webp', 'rare', 'Rare', 'Hidden Legends', '20.82', '100.0000'),
(157, 4, 'ex13-29', 'Registeel', 'https://assets.tcgdex.net/en/ex/ex13/29/high.webp', 'rare', 'Rare', 'Holon Phantoms', '2.88', '100.0000'),
(158, 4, 'col1-38', 'Weezing', 'https://assets.tcgdex.net/en/col/col1/38/high.webp', 'rare', 'Rare', 'Call of Legends', '4.06', '100.0000'),
(159, 4, 'ex8-23', 'Sableye', 'https://assets.tcgdex.net/en/ex/ex8/23/high.webp', 'rare', 'Rare', 'Deoxys', '14.99', '100.0000'),
(160, 4, 'ex10-18', 'Ursaring', 'https://assets.tcgdex.net/en/ex/ex10/18/high.webp', 'rare', 'Rare', 'Unseen Forces', '11.00', '100.0000'),
(161, 4, 'dp2-2', 'Alakazam', 'https://assets.tcgdex.net/en/dp/dp2/2/high.webp', 'rare', 'Rare Holo', 'Mysterious Treasures', '11.57', '100.0000'),
(162, 4, 'dp5-32', 'Umbreon', 'https://assets.tcgdex.net/en/dp/dp5/32/high.webp', 'rare', 'Rare', 'Majestic Dawn', '11.69', '100.0000'),
(163, 4, 'bw8-98', 'Clefable', 'https://assets.tcgdex.net/en/bw/bw8/98/high.webp', 'rare', 'Rare', 'Plasma Storm', '2.00', '100.0000'),
(164, 4, 'ecard1-44', 'Dugtrio', 'https://assets.tcgdex.net/en/ecard/ecard1/44/high.webp', 'rare', 'Rare', 'Expedition Base Set', '32.91', '100.0000'),
(165, 4, 'dp1-14', 'Shiftry', 'https://assets.tcgdex.net/en/dp/dp1/14/high.webp', 'rare', 'Rare Holo', 'Diamond & Pearl', '2.47', '100.0000'),
(166, 4, 'bw6-73', 'Honchkrow', 'https://assets.tcgdex.net/en/bw/bw6/73/high.webp', 'rare', 'Rare', 'Dragons Exalted', '0.87', '100.0000'),
(167, 4, 'dp2-29', 'Mantine', 'https://assets.tcgdex.net/en/dp/dp2/29/high.webp', 'rare', 'Rare', 'Mysterious Treasures', '0.49', '100.0000'),
(168, 4, 'ex16-5', 'Blaziken', 'https://assets.tcgdex.net/en/ex/ex16/5/high.webp', 'rare', 'Rare', 'Power Keepers', '8.13', '100.0000'),
(169, 4, 'col1-17', 'Ninetales', 'https://assets.tcgdex.net/en/col/col1/17/high.webp', 'rare', 'Rare Holo', 'Call of Legends', '8.68', '100.0000'),
(170, 4, 'bw5-36', 'Swanna', 'https://assets.tcgdex.net/en/bw/bw5/36/high.webp', 'rare', 'Rare', 'Dark Explorers', '0.50', '100.0000'),
(171, 4, 'dp1-36', 'Purugly', 'https://assets.tcgdex.net/en/dp/dp1/36/high.webp', 'rare', 'Rare', 'Diamond & Pearl', '0.99', '100.0000'),
(172, 4, 'bw7-102', 'White Kyurem', 'https://assets.tcgdex.net/en/bw/bw7/102/high.webp', 'rare', 'Rare', 'Boundaries Crossed', '1.05', '100.0000'),
(173, 4, 'col1-39', 'Zangoose', 'https://assets.tcgdex.net/en/col/col1/39/high.webp', 'rare', 'Rare', 'Call of Legends', '2.02', '100.0000'),
(174, 4, 'bw10-13', 'Volcarona', 'https://assets.tcgdex.net/en/bw/bw10/13/high.webp', 'rare', 'Rare', 'Plasma Blast', '1.02', '100.0000'),
(175, 4, 'ex8-28', 'Whiscash', 'https://assets.tcgdex.net/en/ex/ex8/28/high.webp', 'rare', 'Rare', 'Deoxys', '1.79', '100.0000'),
(176, 4, 'base4-15', 'Poliwrath', 'https://assets.tcgdex.net/en/base/base4/15/high.webp', 'rare', 'Rare', 'Base Set 2', '95.00', '100.0000'),
(177, 4, 'base1-11', 'Nidoking', 'https://assets.tcgdex.net/en/base/base1/11/high.webp', 'rare', 'Rare', 'Base Set', '38.90', '100.0000'),
(178, 4, 'base2-8', 'Pidgeot', 'https://assets.tcgdex.net/en/base/base2/8/high.webp', 'rare', 'Rare', 'Jungle', '53.24', '100.0000'),
(179, 4, 'dp3-24', 'Dugtrio', 'https://assets.tcgdex.net/en/dp/dp3/24/high.webp', 'rare', 'Rare', 'Secret Wonders', '0.84', '100.0000'),
(180, 4, 'g1-27', 'Raichu', 'https://assets.tcgdex.net/en/xy/g1/27/high.webp', 'rare', 'Rare', 'Generations', '2.50', '100.0000'),
(181, 4, 'bw9-10', 'Cacturne', 'https://assets.tcgdex.net/en/bw/bw9/10/high.webp', 'rare', 'Rare', 'Plasma Freeze', '0.63', '100.0000'),
(182, 4, 'ex11-1', 'Beedrill δ', 'https://assets.tcgdex.net/en/ex/ex11/1/high.webp', 'rare', 'Rare', 'Delta Species', '14.00', '100.0000'),
(183, 4, 'bw6-52', 'Sigilyph', 'https://assets.tcgdex.net/en/bw/bw6/52/high.webp', 'rare', 'Rare', 'Dragons Exalted', '0.80', '100.0000'),
(184, 4, 'bw8-114', 'Bouffalant', 'https://assets.tcgdex.net/en/bw/bw8/114/high.webp', 'rare', 'Rare', 'Plasma Storm', '4.75', '100.0000'),
(185, 4, 'bw3-67', 'Archeops', 'https://assets.tcgdex.net/en/bw/bw3/67/high.webp', 'rare', 'Rare', 'Noble Victories', '3.50', '100.0000'),
(186, 4, 'bw7-22', 'Camerupt', 'https://assets.tcgdex.net/en/bw/bw7/22/high.webp', 'rare', 'Rare', 'Boundaries Crossed', '0.53', '100.0000'),
(187, 4, 'ex14-6', 'Ludicolo δ', 'https://assets.tcgdex.net/en/ex/ex14/6/high.webp', 'rare', 'Rare', 'Crystal Guardians', '12.30', '100.0000'),
(188, 4, 'bw7-74', 'Scolipede', 'https://assets.tcgdex.net/en/bw/bw7/74/high.webp', 'rare', 'Rare', 'Boundaries Crossed', '3.66', '100.0000'),
(189, 4, 'dp6-39', 'Registeel', 'https://assets.tcgdex.net/en/dp/dp6/39/high.webp', 'rare', 'Rare', 'Legends Awakened', '2.10', '100.0000'),
(190, 4, 'bw11-31', 'Gyarados', 'https://assets.tcgdex.net/en/bw/bw11/31/high.webp', 'rare', 'Rare', 'Legendary Treasures', '2.00', '100.0000'),
(191, 4, 'ex7-15', 'Dark Dragonite', 'https://assets.tcgdex.net/en/ex/ex7/15/high.webp', 'rare', 'Rare', 'Team Rocket Returns', '82.66', '100.0000'),
(192, 4, 'ex9-11', 'Swampert', 'https://assets.tcgdex.net/en/ex/ex9/11/high.webp', 'rare', 'Rare', 'Emerald', '12.00', '100.0000'),
(193, 4, 'ex12-6', 'Golem', 'https://assets.tcgdex.net/en/ex/ex12/6/high.webp', 'rare', 'Rare', 'Legend Maker', '4.14', '100.0000'),
(194, 4, 'ex5-23', 'Rain Castform', 'https://assets.tcgdex.net/en/ex/ex5/23/high.webp', 'rare', 'Rare', 'Hidden Legends', '8.00', '100.0000'),
(195, 4, 'bw2-65', 'Liepard', 'https://assets.tcgdex.net/en/bw/bw2/65/high.webp', 'rare', 'Rare', 'Emerging Powers', '1.00', '100.0000'),
(196, 4, 'ex12-15', 'Absol', 'https://assets.tcgdex.net/en/ex/ex12/15/high.webp', 'rare', 'Rare', 'Legend Maker', '4.95', '100.0000'),
(197, 4, 'ex7-110', 'Charmeleon', 'https://assets.tcgdex.net/en/ex/ex7/110/high.webp', 'rare', 'Rare', 'Team Rocket Returns', '115.86', '100.0000'),
(198, 4, 'bw8-116', 'Braviary', 'https://assets.tcgdex.net/en/bw/bw8/116/high.webp', 'rare', 'Rare', 'Plasma Storm', '1.44', '100.0000'),
(199, 4, 'ex7-102', 'Rocket\'s Scyther ex', 'https://assets.tcgdex.net/en/ex/ex7/102/high.webp', 'rare', 'Rare', 'Team Rocket Returns', '259.99', '100.0000'),
(200, 4, 'ex4-97', 'Jirachi', 'https://assets.tcgdex.net/en/ex/ex4/97/high.webp', 'rare', 'Rare', 'Team Magma vs Team Aqua', '63.69', '100.0000'),
(201, 5, 'hgss1-109', 'Meganium', 'https://assets.tcgdex.net/en/hgss/hgss1/109/high.webp', 'legendary', 'Rare PRIME', 'HeartGold SoulSilver', '6.75', '10.0000'),
(202, 5, 'dp1-121', 'Infernape', 'https://assets.tcgdex.net/en/dp/dp1/121/high.webp', 'legendary', 'Rare Holo LV.X', 'Diamond & Pearl', '37.47', '10.0000'),
(203, 5, 'bw3-100', 'Cobalion', 'https://assets.tcgdex.net/en/bw/bw3/100/high.webp', 'epic', 'Ultra Rare', 'Noble Victories', '2.50', '30.0000'),
(204, 5, 'dp5-100', 'Porygon-Z', 'https://assets.tcgdex.net/en/dp/dp5/100/high.webp', 'legendary', 'Rare Holo LV.X', 'Majestic Dawn', '54.53', '10.0000'),
(205, 5, 'bw3-102', 'Meowth', 'https://assets.tcgdex.net/en/bw/bw3/102/high.webp', 'legendary', 'Secret Rare', 'Noble Victories', '94.99', '3.0000'),
(206, 5, 'bw8-135', 'Colress', 'https://assets.tcgdex.net/en/bw/bw8/135/high.webp', 'epic', 'Ultra Rare', 'Plasma Storm', '3.50', '30.0000'),
(207, 5, 'bw7-150', 'Golurk', 'https://assets.tcgdex.net/en/bw/bw7/150/high.webp', 'legendary', 'Secret Rare', 'Boundaries Crossed', '52.90', '3.0000'),
(208, 5, 'bw6-127', 'Krookodile', 'https://assets.tcgdex.net/en/bw/bw6/127/high.webp', 'legendary', 'Secret Rare', 'Dragons Exalted', '189.00', '3.0000'),
(209, 5, 'bw4-103', 'Hydreigon', 'https://assets.tcgdex.net/en/bw/bw4/103/high.webp', 'legendary', 'Secret Rare', 'Next Destinies', '119.99', '3.0000'),
(210, 5, 'dp5-97', 'Garchomp', 'https://assets.tcgdex.net/en/dp/dp5/97/high.webp', 'legendary', 'Rare Holo LV.X', 'Majestic Dawn', '97.41', '10.0000'),
(211, 5, 'g1-28', 'Jolteon EX', 'https://assets.tcgdex.net/en/xy/g1/28/high.webp', 'epic', 'Ultra Rare', 'Generations', '21.74', '30.0000'),
(212, 5, 'bw4-101', 'Chandelure', 'https://assets.tcgdex.net/en/bw/bw4/101/high.webp', 'legendary', 'Secret Rare', 'Next Destinies', '189.99', '3.0000'),
(213, 5, 'dp6-143', 'Mesprit', 'https://assets.tcgdex.net/en/dp/dp6/143/high.webp', 'legendary', 'Rare Holo LV.X', 'Legends Awakened', '62.13', '10.0000'),
(214, 5, 'g1-24', 'Vaporeon EX', 'https://assets.tcgdex.net/en/xy/g1/24/high.webp', 'epic', 'Ultra Rare', 'Generations', '23.58', '30.0000'),
(215, 5, 'bw11-RC25', 'Meloetta-EX', 'https://assets.tcgdex.net/en/bw/bw11/RC25/high.webp', 'epic', 'Ultra Rare', 'Legendary Treasures', '35.00', '30.0000'),
(216, 5, 'g1-RC21', 'Sylveon EX', 'https://assets.tcgdex.net/en/xy/g1/RC21/high.webp', 'epic', 'Ultra Rare', 'Generations', '44.95', '30.0000'),
(217, 5, 'g1-RC29', 'Pikachu', 'https://assets.tcgdex.net/en/xy/g1/RC29/high.webp', 'epic', 'Ultra Rare', 'Generations', '3.44', '30.0000'),
(218, 5, 'dp3-132', 'Honchkrow', 'https://assets.tcgdex.net/en/dp/dp3/132/high.webp', 'legendary', 'Rare Holo LV.X', 'Secret Wonders', '19.50', '10.0000'),
(219, 5, 'dp7-99', 'Raichu', 'https://assets.tcgdex.net/en/dp/dp7/99/high.webp', 'legendary', 'Rare Holo LV.X', 'Stormfront', '85.28', '10.0000'),
(220, 5, 'g1-13', 'Ninetales EX', 'https://assets.tcgdex.net/en/xy/g1/13/high.webp', 'epic', 'Ultra Rare', 'Generations', '6.99', '30.0000'),
(221, 5, 'bw7-153', 'Rocky Helmet', 'https://assets.tcgdex.net/en/bw/bw7/153/high.webp', 'legendary', 'Secret Rare', 'Boundaries Crossed', '15.92', '3.0000'),
(222, 5, 'bw11-RC24', 'Mew-EX', 'https://assets.tcgdex.net/en/bw/bw11/RC24/high.webp', 'epic', 'Ultra Rare', 'Legendary Treasures', '222.29', '30.0000'),
(223, 5, 'dp6-142', 'Magnezone', 'https://assets.tcgdex.net/en/dp/dp6/142/high.webp', 'legendary', 'Rare Holo LV.X', 'Legends Awakened', '45.14', '10.0000'),
(224, 5, 'g1-29', 'Zapdos', 'https://assets.tcgdex.net/en/xy/g1/29/high.webp', 'epic', 'Ultra Rare', 'Generations', '24.92', '30.0000'),
(225, 5, 'dp5-99', 'Leafeon', 'https://assets.tcgdex.net/en/dp/dp5/99/high.webp', 'legendary', 'Rare Holo LV.X', 'Majestic Dawn', '159.60', '10.0000'),
(226, 5, 'bw9-116', 'Professor Juniper', 'https://assets.tcgdex.net/en/bw/bw9/116/high.webp', 'epic', 'Ultra Rare', 'Plasma Freeze', '45.65', '30.0000'),
(227, 5, 'bw8-137', 'Blastoise', 'https://assets.tcgdex.net/en/bw/bw8/137/high.webp', 'legendary', 'Secret Rare', 'Plasma Storm', '151.86', '3.0000'),
(228, 5, 'bw9-120', 'Garchomp', 'https://assets.tcgdex.net/en/bw/bw9/120/high.webp', 'legendary', 'Secret Rare', 'Plasma Freeze', '300.00', '3.0000'),
(229, 5, 'bw1-115', 'Pikachu', 'https://assets.tcgdex.net/en/bw/bw1/115/high.webp', 'legendary', 'Secret Rare', 'Black & White', '59.59', '3.0000'),
(230, 5, 'dp6-146', 'Uxie', 'https://assets.tcgdex.net/en/dp/dp6/146/high.webp', 'legendary', 'Rare Holo LV.X', 'Legends Awakened', '45.88', '10.0000'),
(231, 5, 'bw7-152', 'Altaria', 'https://assets.tcgdex.net/en/bw/bw7/152/high.webp', 'legendary', 'Secret Rare', 'Boundaries Crossed', '73.70', '3.0000'),
(232, 5, 'bw10-104', 'Dusknoir', 'https://assets.tcgdex.net/en/bw/bw10/104/high.webp', 'legendary', 'Secret Rare', 'Plasma Blast', '81.16', '3.0000'),
(233, 5, 'dp5-98', 'Glaceon', 'https://assets.tcgdex.net/en/dp/dp5/98/high.webp', 'legendary', 'Rare Holo LV.X', 'Majestic Dawn', '113.55', '10.0000'),
(234, 5, 'bw7-148', 'Cheren', 'https://assets.tcgdex.net/en/bw/bw7/148/high.webp', 'epic', 'Ultra Rare', 'Boundaries Crossed', '39.99', '30.0000'),
(235, 5, 'bw11-115', 'Zekrom', 'https://assets.tcgdex.net/en/bw/bw11/115/high.webp', 'legendary', 'Secret Rare', 'Legendary Treasures', '4.21', '3.0000'),
(236, 5, 'bw3-97', 'Virizion', 'https://assets.tcgdex.net/en/bw/bw3/97/high.webp', 'epic', 'Ultra Rare', 'Noble Victories', '17.31', '30.0000'),
(237, 5, 'bw6-128', 'Rayquaza', 'https://assets.tcgdex.net/en/bw/bw6/128/high.webp', 'legendary', 'Secret Rare', 'Dragons Exalted', '26.27', '3.0000'),
(238, 5, 'dp2-122', 'Lucario', 'https://assets.tcgdex.net/en/dp/dp2/122/high.webp', 'legendary', 'Rare Holo LV.X', 'Mysterious Treasures', '53.76', '10.0000'),
(239, 5, 'dp6-140', 'Azelf', 'https://assets.tcgdex.net/en/dp/dp6/140/high.webp', 'legendary', 'Rare Holo LV.X', 'Legends Awakened', '70.00', '10.0000'),
(240, 5, 'bw11-RC23', 'Emolga', 'https://assets.tcgdex.net/en/bw/bw11/RC23/high.webp', 'epic', 'Ultra Rare', 'Legendary Treasures', '60.00', '30.0000'),
(241, 5, 'g1-RC32', 'Sylveon EX', 'https://assets.tcgdex.net/en/xy/g1/RC32/high.webp', 'epic', 'Ultra Rare', 'Generations', '44.95', '30.0000'),
(242, 5, 'g1-RC30', 'Gardevoir EX', 'https://assets.tcgdex.net/en/xy/g1/RC30/high.webp', 'epic', 'Ultra Rare', 'Generations', '59.50', '30.0000'),
(243, 5, 'bw7-149', 'Skyla', 'https://assets.tcgdex.net/en/bw/bw7/149/high.webp', 'epic', 'Ultra Rare', 'Boundaries Crossed', '0.78', '30.0000'),
(244, 5, 'dp1-120', 'Empoleon', 'https://assets.tcgdex.net/en/dp/dp1/120/high.webp', 'legendary', 'Rare Holo LV.X', 'Diamond & Pearl', '108.56', '10.0000'),
(245, 5, 'dp7-SH1', 'Drifloon', 'https://assets.tcgdex.net/en/dp/dp7/SH1/high.webp', 'legendary', 'Rare Holo LV.X', 'Stormfront', '36.12', '10.0000'),
(246, 5, 'dp7-SH2', 'Duskull', 'https://assets.tcgdex.net/en/dp/dp7/SH2/high.webp', 'legendary', 'Rare Holo LV.X', 'Stormfront', '31.83', '10.0000'),
(247, 5, 'bw2-98', 'Tornadus', 'https://assets.tcgdex.net/en/bw/bw2/98/high.webp', 'epic', 'Ultra Rare', 'Emerging Powers', '1.19', '30.0000'),
(248, 5, 'bw10-101', 'Iris', 'https://assets.tcgdex.net/en/bw/bw10/101/high.webp', 'epic', 'Ultra Rare', 'Plasma Blast', '0.38', '30.0000'),
(249, 5, 'bw9-121', 'Max Potion', 'https://assets.tcgdex.net/en/bw/bw9/121/high.webp', 'legendary', 'Secret Rare', 'Plasma Freeze', '32.51', '3.0000'),
(250, 5, 'bw10-102', 'Exeggcute', 'https://assets.tcgdex.net/en/bw/bw10/102/high.webp', 'legendary', 'Secret Rare', 'Plasma Blast', '75.71', '3.0000'),
(251, 5, 'bw2-97', 'Thundurus', 'https://assets.tcgdex.net/en/bw/bw2/97/high.webp', 'epic', 'Ultra Rare', 'Emerging Powers', '3.00', '30.0000'),
(252, 5, 'bw9-117', 'Empoleon', 'https://assets.tcgdex.net/en/bw/bw9/117/high.webp', 'legendary', 'Secret Rare', 'Plasma Freeze', '599.00', '3.0000'),
(253, 5, 'bw5-111', 'Pokémon Catcher', 'https://assets.tcgdex.net/en/bw/bw5/111/high.webp', 'legendary', 'Secret Rare', 'Dark Explorers', '70.00', '3.0000'),
(254, 5, 'bw1-114', 'Zekrom', 'https://assets.tcgdex.net/en/bw/bw1/114/high.webp', 'epic', 'Ultra Rare', 'Black & White', '75.56', '30.0000'),
(255, 5, 'hgss1-108', 'Feraligatr', 'https://assets.tcgdex.net/en/hgss/hgss1/108/high.webp', 'legendary', 'Rare PRIME', 'HeartGold SoulSilver', '4.00', '10.0000'),
(256, 5, 'hgss1-105', 'Ampharos', 'https://assets.tcgdex.net/en/hgss/hgss1/105/high.webp', 'legendary', 'Rare PRIME', 'HeartGold SoulSilver', '2.30', '10.0000'),
(257, 5, 'bw10-103', 'Virizion', 'https://assets.tcgdex.net/en/bw/bw10/103/high.webp', 'legendary', 'Secret Rare', 'Plasma Blast', '14.28', '3.0000'),
(258, 5, 'dp7-100', 'Regigigas', 'https://assets.tcgdex.net/en/dp/dp7/100/high.webp', 'legendary', 'Rare Holo LV.X', 'Stormfront', '27.51', '10.0000'),
(259, 5, 'bw9-115', 'Ghetsis', 'https://assets.tcgdex.net/en/bw/bw9/115/high.webp', 'epic', 'Ultra Rare', 'Plasma Freeze', '4.01', '30.0000'),
(260, 5, 'g1-RC6', 'Flareon EX', 'https://assets.tcgdex.net/en/xy/g1/RC6/high.webp', 'epic', 'Ultra Rare', 'Generations', '39.99', '30.0000'),
(261, 5, 'bw6-125', 'Serperior', 'https://assets.tcgdex.net/en/bw/bw6/125/high.webp', 'legendary', 'Secret Rare', 'Dragons Exalted', '114.62', '3.0000'),
(262, 5, 'g1-46', 'Golem EX', 'https://assets.tcgdex.net/en/xy/g1/46/high.webp', 'epic', 'Ultra Rare', 'Generations', '3.76', '30.0000'),
(263, 5, 'bw11-114', 'Reshiram', 'https://assets.tcgdex.net/en/bw/bw11/114/high.webp', 'legendary', 'Secret Rare', 'Legendary Treasures', '60.51', '3.0000'),
(264, 5, 'bw4-100', 'Emboar', 'https://assets.tcgdex.net/en/bw/bw4/100/high.webp', 'legendary', 'Secret Rare', 'Next Destinies', '50.00', '3.0000'),
(265, 5, 'bw3-99', 'Terrakion', 'https://assets.tcgdex.net/en/bw/bw3/99/high.webp', 'epic', 'Ultra Rare', 'Noble Victories', '2.70', '30.0000'),
(266, 5, 'dp6-144', 'Mewtwo', 'https://assets.tcgdex.net/en/dp/dp6/144/high.webp', 'legendary', 'Rare Holo LV.X', 'Legends Awakened', '127.82', '10.0000'),
(267, 5, 'bw7-151', 'Terrakion', 'https://assets.tcgdex.net/en/bw/bw7/151/high.webp', 'legendary', 'Secret Rare', 'Boundaries Crossed', '260.00', '3.0000'),
(268, 5, 'g1-37', 'Meowstic EX', 'https://assets.tcgdex.net/en/xy/g1/37/high.webp', 'epic', 'Ultra Rare', 'Generations', '4.86', '30.0000'),
(269, 5, 'bw4-102', 'Zoroark', 'https://assets.tcgdex.net/en/bw/bw4/102/high.webp', 'legendary', 'Secret Rare', 'Next Destinies', '88.27', '3.0000'),
(270, 5, 'dp3-131', 'Gardevoir', 'https://assets.tcgdex.net/en/dp/dp3/131/high.webp', 'legendary', 'Rare Holo LV.X', 'Secret Wonders', '65.12', '10.0000'),
(271, 5, 'dp2-121', 'Electivire', 'https://assets.tcgdex.net/en/dp/dp2/121/high.webp', 'legendary', 'Rare Holo LV.X', 'Mysterious Treasures', '28.80', '10.0000'),
(272, 5, 'g1-11', 'Charizard EX', 'https://assets.tcgdex.net/en/xy/g1/11/high.webp', 'epic', 'Ultra Rare', 'Generations', '22.23', '30.0000'),
(273, 5, 'bw8-136', 'Charizard', 'https://assets.tcgdex.net/en/bw/bw8/136/high.webp', 'legendary', 'Secret Rare', 'Plasma Storm', '589.25', '3.0000'),
(274, 5, 'bw9-118', 'Sigilyph', 'https://assets.tcgdex.net/en/bw/bw9/118/high.webp', 'legendary', 'Secret Rare', 'Plasma Freeze', '79.51', '3.0000'),
(275, 5, 'dp6-141', 'Gliscor', 'https://assets.tcgdex.net/en/dp/dp6/141/high.webp', 'legendary', 'Rare Holo LV.X', 'Legends Awakened', '50.00', '10.0000'),
(276, 5, 'dp7-97', 'Heatran', 'https://assets.tcgdex.net/en/dp/dp7/97/high.webp', 'legendary', 'Rare Holo LV.X', 'Stormfront', '17.54', '10.0000'),
(277, 5, 'g1-17', 'Blastoise EX', 'https://assets.tcgdex.net/en/xy/g1/17/high.webp', 'epic', 'Ultra Rare', 'Generations', '10.41', '30.0000'),
(278, 5, 'dp2-123', 'Magmortar', 'https://assets.tcgdex.net/en/dp/dp2/123/high.webp', 'legendary', 'Rare Holo LV.X', 'Mysterious Treasures', '39.14', '10.0000'),
(279, 5, 'bw5-110', 'Archeops', 'https://assets.tcgdex.net/en/bw/bw5/110/high.webp', 'legendary', 'Secret Rare', 'Dark Explorers', '51.44', '3.0000'),
(280, 5, 'bw7-147', 'Bianca', 'https://assets.tcgdex.net/en/bw/bw7/147/high.webp', 'epic', 'Ultra Rare', 'Boundaries Crossed', '94.64', '30.0000'),
(281, 6, 'bw9-117', 'Empoleon', 'https://assets.tcgdex.net/en/bw/bw9/117/high.webp', 'legendary', 'Secret Rare', 'Plasma Freeze', '599.00', '3.0000'),
(282, 6, 'bw10-101', 'Iris', 'https://assets.tcgdex.net/en/bw/bw10/101/high.webp', 'epic', 'Ultra Rare', 'Plasma Blast', '0.38', '30.0000'),
(283, 6, 'dp7-96', 'Dusknoir', 'https://assets.tcgdex.net/en/dp/dp7/96/high.webp', 'legendary', 'Rare Holo LV.X', 'Stormfront', '23.12', '10.0000'),
(284, 6, 'dp6-146', 'Uxie', 'https://assets.tcgdex.net/en/dp/dp6/146/high.webp', 'legendary', 'Rare Holo LV.X', 'Legends Awakened', '45.88', '10.0000'),
(285, 6, 'g1-13', 'Ninetales EX', 'https://assets.tcgdex.net/en/xy/g1/13/high.webp', 'epic', 'Ultra Rare', 'Generations', '6.99', '30.0000'),
(286, 6, 'g1-24', 'Vaporeon EX', 'https://assets.tcgdex.net/en/xy/g1/24/high.webp', 'epic', 'Ultra Rare', 'Generations', '23.58', '30.0000'),
(287, 6, 'hgss1-108', 'Feraligatr', 'https://assets.tcgdex.net/en/hgss/hgss1/108/high.webp', 'legendary', 'Rare PRIME', 'HeartGold SoulSilver', '4.00', '10.0000'),
(288, 6, 'dp1-120', 'Empoleon', 'https://assets.tcgdex.net/en/dp/dp1/120/high.webp', 'legendary', 'Rare Holo LV.X', 'Diamond & Pearl', '108.56', '10.0000'),
(289, 6, 'g1-RC6', 'Flareon EX', 'https://assets.tcgdex.net/en/xy/g1/RC6/high.webp', 'epic', 'Ultra Rare', 'Generations', '39.99', '30.0000'),
(290, 6, 'dp7-98', 'Machamp', 'https://assets.tcgdex.net/en/dp/dp7/98/high.webp', 'legendary', 'Rare Holo LV.X', 'Stormfront', '25.16', '10.0000'),
(291, 6, 'g1-RC30', 'Gardevoir EX', 'https://assets.tcgdex.net/en/xy/g1/RC30/high.webp', 'epic', 'Ultra Rare', 'Generations', '59.50', '30.0000'),
(292, 6, 'hgss1-107', 'Donphan', 'https://assets.tcgdex.net/en/hgss/hgss1/107/high.webp', 'legendary', 'Rare PRIME', 'HeartGold SoulSilver', '0.50', '10.0000'),
(293, 6, 'dp6-142', 'Magnezone', 'https://assets.tcgdex.net/en/dp/dp6/142/high.webp', 'legendary', 'Rare Holo LV.X', 'Legends Awakened', '45.14', '10.0000'),
(294, 6, 'g1-28', 'Jolteon EX', 'https://assets.tcgdex.net/en/xy/g1/28/high.webp', 'epic', 'Ultra Rare', 'Generations', '21.74', '30.0000'),
(295, 6, 'bw11-115', 'Zekrom', 'https://assets.tcgdex.net/en/bw/bw11/115/high.webp', 'legendary', 'Secret Rare', 'Legendary Treasures', '4.21', '3.0000'),
(296, 6, 'dp6-143', 'Mesprit', 'https://assets.tcgdex.net/en/dp/dp6/143/high.webp', 'legendary', 'Rare Holo LV.X', 'Legends Awakened', '62.13', '10.0000'),
(297, 6, 'dp5-98', 'Glaceon', 'https://assets.tcgdex.net/en/dp/dp5/98/high.webp', 'legendary', 'Rare Holo LV.X', 'Majestic Dawn', '113.55', '10.0000'),
(298, 6, 'g1-RC21', 'Sylveon EX', 'https://assets.tcgdex.net/en/xy/g1/RC21/high.webp', 'epic', 'Ultra Rare', 'Generations', '44.95', '30.0000'),
(299, 6, 'g1-46', 'Golem EX', 'https://assets.tcgdex.net/en/xy/g1/46/high.webp', 'epic', 'Ultra Rare', 'Generations', '3.76', '30.0000'),
(300, 6, 'bw4-103', 'Hydreigon', 'https://assets.tcgdex.net/en/bw/bw4/103/high.webp', 'legendary', 'Secret Rare', 'Next Destinies', '119.99', '3.0000'),
(301, 6, 'bw6-125', 'Serperior', 'https://assets.tcgdex.net/en/bw/bw6/125/high.webp', 'legendary', 'Secret Rare', 'Dragons Exalted', '114.62', '3.0000'),
(302, 6, 'dp2-122', 'Lucario', 'https://assets.tcgdex.net/en/dp/dp2/122/high.webp', 'legendary', 'Rare Holo LV.X', 'Mysterious Treasures', '53.76', '10.0000'),
(303, 6, 'g1-RC29', 'Pikachu', 'https://assets.tcgdex.net/en/xy/g1/RC29/high.webp', 'epic', 'Ultra Rare', 'Generations', '3.44', '30.0000'),
(304, 6, 'dp6-141', 'Gliscor', 'https://assets.tcgdex.net/en/dp/dp6/141/high.webp', 'legendary', 'Rare Holo LV.X', 'Legends Awakened', '50.00', '10.0000'),
(305, 6, 'dp3-131', 'Gardevoir', 'https://assets.tcgdex.net/en/dp/dp3/131/high.webp', 'legendary', 'Rare Holo LV.X', 'Secret Wonders', '65.12', '10.0000'),
(306, 6, 'g1-29', 'Zapdos', 'https://assets.tcgdex.net/en/xy/g1/29/high.webp', 'epic', 'Ultra Rare', 'Generations', '24.92', '30.0000'),
(307, 6, 'bw4-101', 'Chandelure', 'https://assets.tcgdex.net/en/bw/bw4/101/high.webp', 'legendary', 'Secret Rare', 'Next Destinies', '189.99', '3.0000'),
(308, 6, 'hgss1-110', 'Typhlosion', 'https://assets.tcgdex.net/en/hgss/hgss1/110/high.webp', 'legendary', 'Rare PRIME', 'HeartGold SoulSilver', '5.25', '10.0000'),
(309, 6, 'bw6-128', 'Rayquaza', 'https://assets.tcgdex.net/en/bw/bw6/128/high.webp', 'legendary', 'Secret Rare', 'Dragons Exalted', '26.27', '3.0000'),
(310, 6, 'bw10-105', 'Rare Candy', 'https://assets.tcgdex.net/en/bw/bw10/105/high.webp', 'legendary', 'Secret Rare', 'Plasma Blast', '0.74', '3.0000'),
(311, 6, 'dp5-97', 'Garchomp', 'https://assets.tcgdex.net/en/dp/dp5/97/high.webp', 'legendary', 'Rare Holo LV.X', 'Majestic Dawn', '97.41', '10.0000'),
(312, 6, 'g1-1', 'Venusaur EX', 'https://assets.tcgdex.net/en/xy/g1/1/high.webp', 'epic', 'Ultra Rare', 'Generations', '7.00', '30.0000'),
(313, 6, 'bw7-150', 'Golurk', 'https://assets.tcgdex.net/en/bw/bw7/150/high.webp', 'legendary', 'Secret Rare', 'Boundaries Crossed', '52.90', '3.0000'),
(314, 6, 'bw5-109', 'Gardevoir', 'https://assets.tcgdex.net/en/bw/bw5/109/high.webp', 'legendary', 'Secret Rare', 'Dark Explorers', '244.26', '3.0000'),
(315, 6, 'dp1-121', 'Infernape', 'https://assets.tcgdex.net/en/dp/dp1/121/high.webp', 'legendary', 'Rare Holo LV.X', 'Diamond & Pearl', '37.47', '10.0000'),
(316, 6, 'bw6-127', 'Krookodile', 'https://assets.tcgdex.net/en/bw/bw6/127/high.webp', 'legendary', 'Secret Rare', 'Dragons Exalted', '189.00', '3.0000'),
(317, 6, 'dp7-97', 'Heatran', 'https://assets.tcgdex.net/en/dp/dp7/97/high.webp', 'legendary', 'Rare Holo LV.X', 'Stormfront', '17.54', '10.0000'),
(318, 6, 'bw7-152', 'Altaria', 'https://assets.tcgdex.net/en/bw/bw7/152/high.webp', 'legendary', 'Secret Rare', 'Boundaries Crossed', '73.70', '3.0000'),
(319, 6, 'g1-10', 'Leafeon EX', 'https://assets.tcgdex.net/en/xy/g1/10/high.webp', 'epic', 'Ultra Rare', 'Generations', '24.07', '30.0000'),
(320, 6, 'bw1-113', 'Reshiram', 'https://assets.tcgdex.net/en/bw/bw1/113/high.webp', 'epic', 'Ultra Rare', 'Black & White', '10.00', '30.0000'),
(321, 6, 'bw9-122', 'Ultra Ball', 'https://assets.tcgdex.net/en/bw/bw9/122/high.webp', 'legendary', 'Secret Rare', 'Plasma Freeze', '454.00', '3.0000'),
(322, 6, 'hgss1-109', 'Meganium', 'https://assets.tcgdex.net/en/hgss/hgss1/109/high.webp', 'legendary', 'Rare PRIME', 'HeartGold SoulSilver', '6.75', '10.0000'),
(323, 6, 'g1-11', 'Charizard EX', 'https://assets.tcgdex.net/en/xy/g1/11/high.webp', 'epic', 'Ultra Rare', 'Generations', '22.23', '30.0000'),
(324, 6, 'bw6-126', 'Reuniclus', 'https://assets.tcgdex.net/en/bw/bw6/126/high.webp', 'legendary', 'Secret Rare', 'Dragons Exalted', '70.00', '3.0000'),
(325, 6, 'dp7-99', 'Raichu', 'https://assets.tcgdex.net/en/dp/dp7/99/high.webp', 'legendary', 'Rare Holo LV.X', 'Stormfront', '85.28', '10.0000'),
(326, 6, 'dp7-SH1', 'Drifloon', 'https://assets.tcgdex.net/en/dp/dp7/SH1/high.webp', 'legendary', 'Rare Holo LV.X', 'Stormfront', '36.12', '10.0000'),
(327, 6, 'dp2-123', 'Magmortar', 'https://assets.tcgdex.net/en/dp/dp2/123/high.webp', 'legendary', 'Rare Holo LV.X', 'Mysterious Treasures', '39.14', '10.0000'),
(328, 6, 'dp2-121', 'Electivire', 'https://assets.tcgdex.net/en/dp/dp2/121/high.webp', 'legendary', 'Rare Holo LV.X', 'Mysterious Treasures', '28.80', '10.0000'),
(329, 6, 'dp1-122', 'Torterra', 'https://assets.tcgdex.net/en/dp/dp1/122/high.webp', 'legendary', 'Rare Holo LV.X', 'Diamond & Pearl', '35.79', '10.0000'),
(330, 6, 'bw10-102', 'Exeggcute', 'https://assets.tcgdex.net/en/bw/bw10/102/high.webp', 'legendary', 'Secret Rare', 'Plasma Blast', '75.71', '3.0000'),
(331, 6, 'bw7-147', 'Bianca', 'https://assets.tcgdex.net/en/bw/bw7/147/high.webp', 'epic', 'Ultra Rare', 'Boundaries Crossed', '94.64', '30.0000'),
(332, 6, 'bw9-115', 'Ghetsis', 'https://assets.tcgdex.net/en/bw/bw9/115/high.webp', 'epic', 'Ultra Rare', 'Plasma Freeze', '4.01', '30.0000'),
(333, 6, 'bw2-98', 'Tornadus', 'https://assets.tcgdex.net/en/bw/bw2/98/high.webp', 'epic', 'Ultra Rare', 'Emerging Powers', '1.19', '30.0000'),
(334, 6, 'hgss1-105', 'Ampharos', 'https://assets.tcgdex.net/en/hgss/hgss1/105/high.webp', 'legendary', 'Rare PRIME', 'HeartGold SoulSilver', '2.30', '10.0000'),
(335, 6, 'bw9-116', 'Professor Juniper', 'https://assets.tcgdex.net/en/bw/bw9/116/high.webp', 'epic', 'Ultra Rare', 'Plasma Freeze', '45.65', '30.0000'),
(336, 6, 'bw10-104', 'Dusknoir', 'https://assets.tcgdex.net/en/bw/bw10/104/high.webp', 'legendary', 'Secret Rare', 'Plasma Blast', '81.16', '3.0000'),
(337, 6, 'g1-RC32', 'Sylveon EX', 'https://assets.tcgdex.net/en/xy/g1/RC32/high.webp', 'epic', 'Ultra Rare', 'Generations', '44.95', '30.0000'),
(338, 6, 'bw11-RC24', 'Mew-EX', 'https://assets.tcgdex.net/en/bw/bw11/RC24/high.webp', 'epic', 'Ultra Rare', 'Legendary Treasures', '222.29', '30.0000'),
(339, 6, 'bw3-102', 'Meowth', 'https://assets.tcgdex.net/en/bw/bw3/102/high.webp', 'legendary', 'Secret Rare', 'Noble Victories', '94.99', '3.0000'),
(340, 6, 'bw11-RC22', 'Reshiram', 'https://assets.tcgdex.net/en/bw/bw11/RC22/high.webp', 'epic', 'Ultra Rare', 'Legendary Treasures', '131.88', '30.0000'),
(341, 6, 'bw9-120', 'Garchomp', 'https://assets.tcgdex.net/en/bw/bw9/120/high.webp', 'legendary', 'Secret Rare', 'Plasma Freeze', '300.00', '3.0000'),
(342, 6, 'bw3-100', 'Cobalion', 'https://assets.tcgdex.net/en/bw/bw3/100/high.webp', 'epic', 'Ultra Rare', 'Noble Victories', '2.50', '30.0000'),
(343, 6, 'g1-25', 'Articuno', 'https://assets.tcgdex.net/en/xy/g1/25/high.webp', 'epic', 'Ultra Rare', 'Generations', '39.94', '30.0000'),
(344, 6, 'bw3-97', 'Virizion', 'https://assets.tcgdex.net/en/bw/bw3/97/high.webp', 'epic', 'Ultra Rare', 'Noble Victories', '17.31', '30.0000'),
(345, 6, 'bw4-100', 'Emboar', 'https://assets.tcgdex.net/en/bw/bw4/100/high.webp', 'legendary', 'Secret Rare', 'Next Destinies', '50.00', '3.0000'),
(346, 6, 'bw4-102', 'Zoroark', 'https://assets.tcgdex.net/en/bw/bw4/102/high.webp', 'legendary', 'Secret Rare', 'Next Destinies', '88.27', '3.0000'),
(347, 6, 'bw8-135', 'Colress', 'https://assets.tcgdex.net/en/bw/bw8/135/high.webp', 'epic', 'Ultra Rare', 'Plasma Storm', '3.50', '30.0000');
INSERT INTO `battle_crate_items` (`id`, `crate_id`, `card_id`, `name`, `image`, `rarity`, `rarity_label`, `set_name`, `price`, `drop_chance`) VALUES
(348, 6, 'bw11-RC23', 'Emolga', 'https://assets.tcgdex.net/en/bw/bw11/RC23/high.webp', 'epic', 'Ultra Rare', 'Legendary Treasures', '60.00', '30.0000'),
(349, 6, 'bw8-138', 'Random Receiver', 'https://assets.tcgdex.net/en/bw/bw8/138/high.webp', 'legendary', 'Secret Rare', 'Plasma Storm', '18.87', '3.0000'),
(350, 6, 'dp6-144', 'Mewtwo', 'https://assets.tcgdex.net/en/dp/dp6/144/high.webp', 'legendary', 'Rare Holo LV.X', 'Legends Awakened', '127.82', '10.0000'),
(351, 6, 'dp3-132', 'Honchkrow', 'https://assets.tcgdex.net/en/dp/dp3/132/high.webp', 'legendary', 'Rare Holo LV.X', 'Secret Wonders', '19.50', '10.0000'),
(352, 6, 'dp5-99', 'Leafeon', 'https://assets.tcgdex.net/en/dp/dp5/99/high.webp', 'legendary', 'Rare Holo LV.X', 'Majestic Dawn', '159.60', '10.0000'),
(353, 6, 'bw1-115', 'Pikachu', 'https://assets.tcgdex.net/en/bw/bw1/115/high.webp', 'legendary', 'Secret Rare', 'Black & White', '59.59', '3.0000'),
(354, 6, 'bw7-153', 'Rocky Helmet', 'https://assets.tcgdex.net/en/bw/bw7/153/high.webp', 'legendary', 'Secret Rare', 'Boundaries Crossed', '15.92', '3.0000'),
(355, 6, 'bw9-121', 'Max Potion', 'https://assets.tcgdex.net/en/bw/bw9/121/high.webp', 'legendary', 'Secret Rare', 'Plasma Freeze', '32.51', '3.0000'),
(356, 6, 'g1-17', 'Blastoise EX', 'https://assets.tcgdex.net/en/xy/g1/17/high.webp', 'epic', 'Ultra Rare', 'Generations', '10.41', '30.0000'),
(357, 6, 'bw8-136', 'Charizard', 'https://assets.tcgdex.net/en/bw/bw8/136/high.webp', 'legendary', 'Secret Rare', 'Plasma Storm', '589.25', '3.0000'),
(358, 6, 'bw7-151', 'Terrakion', 'https://assets.tcgdex.net/en/bw/bw7/151/high.webp', 'legendary', 'Secret Rare', 'Boundaries Crossed', '260.00', '3.0000'),
(359, 6, 'bw9-119', 'Garbodor', 'https://assets.tcgdex.net/en/bw/bw9/119/high.webp', 'legendary', 'Secret Rare', 'Plasma Freeze', '299.99', '3.0000'),
(360, 6, 'hgss1-106', 'Blissey', 'https://assets.tcgdex.net/en/hgss/hgss1/106/high.webp', 'legendary', 'Rare PRIME', 'HeartGold SoulSilver', '0.85', '10.0000');

-- --------------------------------------------------------

--
-- Table structure for table `crate_battle_rooms`
--

CREATE TABLE `crate_battle_rooms` (
  `id` int NOT NULL,
  `room_code` varchar(8) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'waiting',
  `host_id` int NOT NULL,
  `guest_id` int DEFAULT NULL,
  `host_username` varchar(64) DEFAULT NULL,
  `guest_username` varchar(64) DEFAULT NULL,
  `crates_json` text NOT NULL,
  `wager_total` decimal(12,2) NOT NULL,
  `host_paid` tinyint(1) NOT NULL DEFAULT '0',
  `guest_paid` tinyint(1) NOT NULL DEFAULT '0',
  `host_pulls_json` text,
  `guest_pulls_json` text,
  `host_total_value` decimal(12,2) DEFAULT NULL,
  `guest_total_value` decimal(12,2) DEFAULT NULL,
  `winner_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `favorites`
--

CREATE TABLE `favorites` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `card_id` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `favorites`
--

INSERT INTO `favorites` (`id`, `user_id`, `card_id`, `created_at`) VALUES
(45, 24, 'sv03-152', '2026-06-03 09:37:02'),
(46, 24, 'base1-6', '2026-06-03 09:37:10'),
(48, 24, 'base1-15', '2026-06-03 09:37:12'),
(51, 24, 'base1-23', '2026-06-03 09:37:53'),
(53, 24, 'ex6-105', '2026-06-09 07:12:15');

-- --------------------------------------------------------

--
-- Table structure for table `marketplace`
--

CREATE TABLE `marketplace` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `market_price` decimal(10,2) NOT NULL,
  `card_id` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `marketplace`
--

INSERT INTO `marketplace` (`id`, `user_id`, `market_price`, `card_id`, `created_at`) VALUES
(80, 24, '31.54', 'base1-3', '2026-05-28 07:12:51'),
(81, 24, '31.54', 'base1-3', '2026-05-28 07:12:52'),
(83, 24, '31.54', 'base1-3', '2026-05-28 07:12:53'),
(84, 24, '31.54', 'base1-3', '2026-05-28 07:12:53'),
(85, 24, '31.54', 'base1-3', '2026-05-28 07:12:54'),
(86, 24, '31.54', 'base1-3', '2026-05-28 07:18:54'),
(87, 24, '31.54', 'base1-3', '2026-05-28 07:18:54'),
(88, 24, '31.54', 'base1-3', '2026-05-28 07:18:55'),
(89, 24, '31.54', 'base1-3', '2026-05-28 07:18:56'),
(106, 24, '65.09', 'sm1-142', '2026-06-03 06:25:14'),
(107, 24, '0.02', 'base2-42', '2026-06-03 06:26:39'),
(108, 24, '0.02', 'base2-51', '2026-06-03 06:26:43'),
(109, 24, '28.32', 'base1-3', '2026-06-10 06:38:04'),
(110, 24, '28.32', 'base1-3', '2026-06-10 06:38:05'),
(111, 24, '28.32', 'base1-3', '2026-06-10 06:38:05'),
(112, 24, '28.32', 'base1-3', '2026-06-10 06:38:06'),
(113, 24, '28.32', 'base1-3', '2026-06-10 06:38:06'),
(114, 24, '28.32', 'base1-3', '2026-06-10 06:38:06'),
(115, 24, '28.32', 'base1-3', '2026-06-10 06:38:06'),
(116, 24, '28.32', 'base1-3', '2026-06-10 06:38:06'),
(117, 24, '28.32', 'base1-3', '2026-06-10 06:38:06'),
(118, 24, '28.32', 'base1-3', '2026-06-10 06:38:07'),
(119, 24, '28.32', 'base1-3', '2026-06-10 06:38:07'),
(120, 24, '28.32', 'base1-3', '2026-06-10 06:38:07'),
(121, 24, '69.80', 'base1-6', '2026-06-10 07:09:33'),
(122, 24, '6.48', 'sm9-168', '2026-06-11 08:51:55'),
(123, 24, '102.56', 'bw7-151', '2026-06-15 07:01:10');

-- --------------------------------------------------------

--
-- Table structure for table `packs`
--

CREATE TABLE `packs` (
  `id` varchar(64) NOT NULL,
  `name` varchar(255) NOT NULL,
  `photo` varchar(512) DEFAULT NULL,
  `is_free` tinyint(1) NOT NULL DEFAULT '0',
  `is_carousel` tinyint(1) NOT NULL DEFAULT '0',
  `price` float(10,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `packs`
--

INSERT INTO `packs` (`id`, `name`, `photo`, `is_free`, `is_carousel`, `price`) VALUES
('base1', 'Base Set', '/images/fullpacks/base/base1.png', 0, 1, 50.00),
('base2', 'Jungle', '/images/fullpacks/base/base2.png', 0, 0, 50.00),
('base3', 'Fossil', '/images/fullpacks/base/base3.png', 0, 0, 50.00),
('base4', 'Base Set 2', '/images/fullpacks/base/base4.png', 0, 0, 50.00),
('base5', 'Team Rocket', '/images/fullpacks/base/base5.png', 0, 0, 50.00),
('bw1', 'Black & White', '/images/fullpacks/black&white/bw1.png', 0, 0, 2.00),
('bw10', 'Plasma Blast', '/images/fullpacks/black&white/bw10.png', 0, 0, 4.00),
('bw11', 'Legendary Treasures', '/images/fullpacks/black&white/bw11.png', 0, 0, 25.00),
('bw2', 'Emerging Powers', '/images/fullpacks/black&white/bw2.png', 0, 0, 2.00),
('bw3', 'Noble Victories', '/images/fullpacks/black&white/bw3.png', 0, 0, 3.00),
('bw4', 'Next Destinies', '/images/fullpacks/black&white/bw4.png', 0, 0, 6.00),
('bw5', 'Dark Explorers', '/images/fullpacks/black&white/bw5.png', 0, 0, 4.00),
('bw6', 'Dragons Exalted', '/images/fullpacks/black&white/bw6.png', 0, 0, 3.00),
('bw7', 'Boundaries Crossed', '/images/fullpacks/black&white/bw7.png', 0, 0, 3.50),
('bw8', 'Plasma Storm', '/images/fullpacks/black&white/bw8.png', 0, 0, 8.00),
('bw9', 'Plasma Freeze', '/images/fullpacks/black&white/bw9.png', 0, 0, 10.00),
('col1', 'Call of Legends', '/images/fullpacks/calloflegends/col1.png', 0, 0, 22.00),
('dp1', 'Diamond & Pearl', '/images/fullpacks/diamond&pearl/dp1.png', 0, 0, 4.00),
('dp2', 'Mysterious Treasures', '/images/fullpacks/diamond&pearl/dp2.png', 0, 0, 5.00),
('dp3', 'Secret Wonders', '/images/fullpacks/diamond&pearl/dp3.png', 0, 0, 3.00),
('dp5', 'Majestic Dawn', '/images/fullpacks/diamond&pearl/dp5.png', 0, 0, 6.00),
('dp6', 'Legends Awakened', '/images/fullpacks/diamond&pearl/dp6.png', 0, 0, 4.00),
('dp7', 'Stormfront', '/images/fullpacks/diamond&pearl/dp7.png', 0, 0, 11.00),
('ecard1', 'Expedition Base Set', '/images/fullpacks/e-card/ecard1.png', 0, 0, 110.00),
('ex1', 'Ruby & Sapphire', '/images/fullpacks/ex/ex1.png', 0, 0, 13.00),
('ex10', 'Unseen Forces', '/images/fullpacks/ex/ex10.png', 0, 0, 18.00),
('ex11', 'Delta Species', '/images/fullpacks/ex/ex11.png', 0, 0, 23.00),
('ex12', 'Legend Maker', '/images/fullpacks/ex/ex12.png', 0, 0, 11.00),
('ex13', 'Holon Phantoms', '/images/fullpacks/ex/ex13.png', 0, 0, 14.00),
('ex14', 'Crystal Guardians', '/images/fullpacks/ex/ex14.png', 0, 0, 16.00),
('ex15', 'Dragon Frontiers', '/images/fullpacks/ex/ex15.png', 0, 0, 15.00),
('ex16', 'Power Keepers', '/images/fullpacks/ex/ex16.png', 0, 0, 8.00),
('ex2', 'Sandstorm', '/images/fullpacks/ex/ex2.png', 0, 0, 22.00),
('ex3', 'Dragon', '/images/fullpacks/ex/ex3.png', 0, 0, 40.00),
('ex4', 'Team Magma vs Team Aqua', '/images/fullpacks/ex/ex4.png', 0, 0, 17.00),
('ex5', 'Hidden Legends', '/images/fullpacks/ex/ex5.png', 0, 0, 12.00),
('ex6', 'FireRed & LeafGreen', '/images/fullpacks/ex/ex6.png', 0, 0, 21.00),
('ex7', 'Team Rocket Returns', '/images/fullpacks/ex/ex7.png', 0, 0, 45.00),
('ex8', 'Deoxys', '/images/fullpacks/ex/ex8.png', 0, 0, 13.00),
('ex9', 'Emerald', '/images/fullpacks/ex/ex9.png', 0, 0, 13.00),
('g1', 'Generations', '/images/fullpacks/xy/g1.png', 0, 0, 10.00),
('gym1', 'Gym Heroes', '/images/fullpacks/gym/gym1.png', 0, 0, 62.00),
('gym2', 'Gym Challenge', '/images/fullpacks/gym/gym2.png', 0, 0, 80.00),
('hgss1', 'HeartGold & SoulSilver', '/images/fullpacks/heartgold&soulsilver/hgss1.png', 0, 0, 16.00),
('hgss2', 'Unleashed', '/images/fullpacks/heartgold&soulsilver/hgss2.png', 0, 0, 16.00),
('hgss3', 'Undaunted', '/images/fullpacks/heartgold&soulsilver/hgss3.png', 0, 0, 16.00),
('hgss4', 'Triumphant', '/images/fullpacks/heartgold&soulsilver/hgss4.png', 0, 0, 11.00),
('lc', 'Legendary Collection', '/images/fullpacks/legendary-collection/lc.png', 0, 0, 18.00),
('me01', 'Mega Evolution', '/images/fullpacks/mega-evolution/me01.png', 0, 0, 8.00),
('me02', 'Phantasmal Flames', '/images/fullpacks/mega-evolution/me02.png', 0, 0, 8.00),
('me02.5', 'Ascended Heroes', '/images/fullpacks/mega-evolution/me02.5.png', 0, 0, 8.00),
('me03', 'Perfect Order', '/images/fullpacks/mega-evolution/me03.png', 0, 0, 8.00),
('neo1', 'Neo Genesis', '/images/fullpacks/neo/neo1.png', 0, 0, 16.00),
('neo2', 'Neo Discovery', '/images/fullpacks/neo/neo2.png', 0, 0, 90.00),
('neo3', 'Neo Revelation', '/images/fullpacks/neo/neo3.png', 0, 0, 55.00),
('neo4', 'Neo Destiny', '/images/fullpacks/neo/neo4.png', 0, 0, 75.00),
('pl3', 'Supreme Victors', '/images/fullpacks/platinum/pl3.png', 0, 0, 5.00),
('pl4', 'Arceus', '/images/fullpacks/platinum/pl4.png', 0, 0, 7.00),
('sm1', 'Sun & Moon', '/images/fullpacks/sun&moon/sm1.png', 0, 0, 6.00),
('sm10', 'Unbroken Bonds', '/images/fullpacks/sun&moon/sm10.png', 0, 0, 9.00),
('sm11', 'Unified Minds', '/images/fullpacks/sun&moon/sm11.png', 0, 0, 10.00),
('sm115', 'Hidden Fates', '/images/fullpacks/sun&moon/sm11.5.png', 0, 0, 4.00),
('sm12', 'Cosmic Eclipse', '/images/fullpacks/sun&moon/sm12.png', 0, 0, 18.00),
('sm3', 'Burning Shadows', '/images/fullpacks/sun&moon/sm3.png', 0, 1, 32.00),
('sm4', 'Crimson Invasion', '/images/fullpacks/sun&moon/sm4.png', 0, 0, 11.00),
('sm5', 'Ultra Prism', '/images/fullpacks/sun&moon/sm5.png', 0, 0, 4.00),
('sm7', 'Celestial Storm', '/images/fullpacks/sun&moon/sm7.png', 0, 0, 24.00),
('sm8', 'Lost Thunder', '/images/fullpacks/sun&moon/sm8.png', 0, 0, 5.00),
('sm9', 'Team Up', '/images/fullpacks/sun&moon/sm9.png', 0, 0, 6.00),
('sv01', 'Scarlet & Violet', '/images/fullpacks/scarlet&violet/sv1.png', 0, 0, 10.00),
('sv02', 'Paldea Evolved', '/images/fullpacks/scarlet&violet/sv2.png', 0, 0, 6.00),
('sv03', 'Obsidian Flames', '/images/fullpacks/scarlet&violet/sv3.png', 0, 0, 2.00),
('sv03.5', '151', '/images/fullpacks/scarlet&violet/sv3.5.png', 0, 1, 14.00),
('sv04', 'Paradox Rift', '/images/fullpacks/scarlet&violet/sv4.png', 0, 0, 5.00),
('sv04.5', 'Paldean Fates', '/images/fullpacks/scarlet&violet/sv4.5.png', 0, 0, 5.00),
('sv05', 'Temporal Forces', '/images/fullpacks/scarlet&violet/sv5.png', 0, 0, 9.00),
('sv06', 'Twilight Masquerade', '/images/fullpacks/scarlet&violet/sv6.png', 0, 0, 9.00),
('sv06.5', 'Shrouded Fable', '/images/fullpacks/scarlet&violet/sv6.5.png', 0, 0, 53.00),
('sv07', 'Stellar Crown', '/images/fullpacks/scarlet&violet/sv7.png', 0, 0, 3.00),
('sv08', 'Surging Sparks', '/images/fullpacks/scarlet&violet/sv8.png', 0, 0, 9.00),
('sv08.5', 'Prismatic Evolutions', '/images/fullpacks/scarlet&violet/sv08.5.png', 0, 0, 50.00),
('sv09', 'Journey Together', '/images/fullpacks/scarlet&violet/sv09.png', 0, 0, 4.00),
('sv10', 'Destined Rivals', '/images/fullpacks/scarlet&violet/sv10.png', 0, 0, 7.00),
('sv10.5b', 'Black Bolt', '/images/fullpacks/scarlet&violet/sv10.5b.png', 0, 0, 11.00),
('sv10.5w', 'White Flare', '/images/fullpacks/scarlet&violet/sv10.5w.png', 0, 1, 11.00),
('swsh1', 'Sword & Shield', '/images/fullpacks/sword&shield/swsh1.png', 0, 0, 2.00),
('swsh10', 'Astral Radiance', '/images/fullpacks/sword&shield/swsh10.png', 0, 0, 8.00),
('swsh10.5', 'PokÃ©mon GO', '/images/fullpacks/sword&shield/pgo.png', 0, 0, 1.50),
('swsh11', 'Lost Origin', '/images/fullpacks/sword&shield/swsh11.png', 0, 0, 2.00),
('swsh12', 'Silver Tempest', '/images/fullpacks/sword&shield/swsh12.png', 0, 0, 5.00),
('swsh12.5', 'Crown Zenith', '/images/fullpacks/sword&shield/swsh12.5.png', 0, 0, 12.00),
('swsh2', 'Rebel Clash', '/images/fullpacks/sword&shield/swsh2.png', 0, 0, 3.50),
('swsh3', 'Darkness Ablaze', '/images/fullpacks/sword&shield/swsh3.png', 0, 1, 3.00),
('swsh3.5', 'Champion\'s Path', '/images/fullpacks/sword&shield/swsh3.5.png', 0, 0, 6.50),
('swsh4', 'Vivid Voltage', '/images/fullpacks/sword&shield/swsh4.png', 0, 0, 2.00),
('swsh4.5', 'Shining Fates', '/images/fullpacks/sword&shield/swsh4.5.png', 0, 0, 3.20),
('swsh5', 'Battle Styles', '/images/fullpacks/sword&shield/swsh5.png', 0, 0, 4.00),
('swsh6', 'Chilling Reign', '/images/fullpacks/sword&shield/swsh6.png', 0, 0, 11.00),
('swsh7', 'Evolving Skies', '/images/fullpacks/sword&shield/swsh7.png', 0, 1, 16.50),
('swsh8', 'Fusion Strike', '/images/fullpacks/sword&shield/swsh8.png', 0, 0, 9.00),
('swsh9', 'Brilliant Stars', '/images/fullpacks/sword&shield/swsh9.png', 0, 0, 4.00),
('xy1', 'XY', '/images/fullpacks/xy/xy1.png', 0, 0, 2.00),
('xy10', 'BREAKthrough', '/images/fullpacks/xy/xy10.png', 0, 0, 4.00),
('xy11', 'Fates Collide', '/images/fullpacks/xy/xy11.png', 0, 0, 3.00),
('xy12', 'Steam Siege', '/images/fullpacks/xy/xy12.png', 0, 0, 5.00),
('xy2', 'Flashfire', '/images/fullpacks/xy/xy2.png', 0, 0, 2.00),
('xy3', 'Furious Fists', '/images/fullpacks/xy/xy3.png', 0, 0, 2.00),
('xy4', 'Phantom Forces', '/images/fullpacks/xy/xy4.png', 0, 0, 4.00),
('xy5', 'Primal Clash', '/images/fullpacks/xy/xy5.png', 0, 0, 3.00),
('xy6', 'Roaring Skies', '/images/fullpacks/xy/xy6.png', 0, 0, 3.50),
('xy7', 'Ancient Origins', '/images/fullpacks/xy/xy7.png', 0, 0, 7.50),
('xy9', 'BREAKpoint', '/images/fullpacks/xy/xy9.png', 0, 0, 3.75);

-- --------------------------------------------------------

--
-- Table structure for table `raffles`
--

CREATE TABLE `raffles` (
  `id` int NOT NULL,
  `hour_key` varchar(13) NOT NULL,
  `prize_type` enum('coins','wheel_ticket') NOT NULL,
  `prize_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `winner_user_id` int DEFAULT NULL,
  `drawn_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `raffles`
--

INSERT INTO `raffles` (`id`, `hour_key`, `prize_type`, `prize_amount`, `winner_user_id`, `drawn_at`, `created_at`) VALUES
(1, '2026-06-09-08', 'coins', '82.00', 25, '2026-06-09 11:07:12', '2026-06-09 10:11:11'),
(2, '2026-06-09-09', 'coins', '98.00', NULL, '2026-06-10 09:12:12', '2026-06-09 11:07:12'),
(3, '2026-06-09-10', 'wheel_ticket', '1.00', 24, '2026-06-09 13:16:58', '2026-06-09 12:15:29'),
(4, '2026-06-09-11', 'coins', '32.00', NULL, '2026-06-10 09:12:12', '2026-06-09 13:16:58'),
(5, '2026-06-09-12', 'coins', '47.00', 24, '2026-06-10 09:09:45', '2026-06-09 14:17:54'),
(6, '2026-06-10-06', 'coins', '33.00', 24, '2026-06-10 09:09:45', '2026-06-10 08:10:52'),
(7, '2026-06-10-07', 'coins', '72.00', NULL, NULL, '2026-06-10 09:09:45'),
(8, '2026-06-10-08', 'coins', '98.00', NULL, NULL, '2026-06-10 10:00:50'),
(9, '2026-06-10-11', 'coins', '71.00', NULL, NULL, '2026-06-10 13:16:21'),
(10, '2026-06-11-08', 'coins', '48.00', NULL, NULL, '2026-06-11 10:53:16'),
(11, '2026-06-15-06', 'wheel_ticket', '1.00', NULL, NULL, '2026-06-15 08:56:08'),
(12, '2026-06-15-07', 'wheel_ticket', '1.00', NULL, NULL, '2026-06-15 09:00:09'),
(13, '2026-06-15-08', 'wheel_ticket', '1.00', NULL, NULL, '2026-06-15 10:05:49'),
(14, '2026-06-15-09', 'wheel_ticket', '1.00', NULL, NULL, '2026-06-15 11:16:30');

-- --------------------------------------------------------

--
-- Table structure for table `raffle_entries`
--

CREATE TABLE `raffle_entries` (
  `id` int NOT NULL,
  `raffle_id` int NOT NULL,
  `user_id` int NOT NULL,
  `tickets` int NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `raffle_entries`
--

INSERT INTO `raffle_entries` (`id`, `raffle_id`, `user_id`, `tickets`) VALUES
(1, 1, 24, 28),
(6, 1, 25, 429),
(19, 3, 24, 1),
(20, 5, 24, 5),
(21, 6, 24, 7),
(24, 7, 24, 36),
(28, 7, 25, 8),
(30, 8, 24, 6),
(36, 9, 24, 32),
(39, 10, 24, 13),
(42, 11, 24, 112),
(60, 12, 24, 30),
(69, 13, 24, 2),
(71, 13, 29, 23),
(78, 14, 29, 11);

-- --------------------------------------------------------

--
-- Table structure for table `trades`
--

CREATE TABLE `trades` (
  `id` int NOT NULL,
  `initiator_id` int NOT NULL,
  `receiver_id` int NOT NULL,
  `status` enum('pending','negotiating','completed','declined','cancelled') NOT NULL DEFAULT 'pending',
  `initiator_coins` decimal(14,2) NOT NULL DEFAULT '0.00',
  `receiver_coins` decimal(14,2) NOT NULL DEFAULT '0.00',
  `initiator_ready` tinyint(1) NOT NULL DEFAULT '0',
  `receiver_ready` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `trades`
--

INSERT INTO `trades` (`id`, `initiator_id`, `receiver_id`, `status`, `initiator_coins`, `receiver_coins`, `initiator_ready`, `receiver_ready`, `created_at`, `updated_at`, `completed_at`) VALUES
(1, 25, 24, 'completed', '0.00', '0.00', 0, 0, '2026-06-09 08:51:00', '2026-06-09 08:54:07', '2026-06-09 08:54:07'),
(2, 25, 24, 'completed', '0.00', '0.00', 0, 0, '2026-06-09 08:54:40', '2026-06-09 08:55:24', '2026-06-09 08:55:24'),
(3, 24, 25, 'completed', '0.00', '0.00', 0, 0, '2026-06-09 08:55:42', '2026-06-09 08:56:30', '2026-06-09 08:56:30'),
(4, 24, 25, 'cancelled', '0.00', '0.00', 0, 0, '2026-06-09 08:56:37', '2026-06-09 09:44:53', NULL),
(5, 25, 24, 'cancelled', '0.00', '0.00', 0, 0, '2026-06-09 09:44:59', '2026-06-09 09:45:39', NULL),
(6, 24, 25, 'completed', '0.00', '0.00', 0, 0, '2026-06-09 09:59:35', '2026-06-09 10:00:42', '2026-06-09 10:00:42'),
(10, 24, 25, 'pending', '0.00', '0.00', 0, 0, '2026-06-09 12:41:19', '2026-06-09 12:41:19', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `trade_items`
--

CREATE TABLE `trade_items` (
  `id` int NOT NULL,
  `trade_id` int NOT NULL,
  `user_id` int NOT NULL,
  `card_id` varchar(64) NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `unit_price` decimal(12,2) NOT NULL DEFAULT '0.00'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `trade_items`
--

INSERT INTO `trade_items` (`id`, `trade_id`, `user_id`, `card_id`, `quantity`, `unit_price`) VALUES
(1, 1, 25, 'ex6-105', 1, '646.30'),
(3, 1, 25, 'g1-11', 1, '22.23'),
(5, 1, 24, 'ex5-29', 4, '14.39'),
(9, 1, 24, 'ex13-35', 1, '1.00'),
(10, 2, 25, 'ex5-29', 1, '14.39'),
(11, 2, 24, 'ex6-105', 1, '646.30'),
(12, 3, 24, 'g1-11', 1, '22.23'),
(13, 3, 24, 'gym1-80', 1, '7.00'),
(14, 3, 25, 'ex5-29', 1, '14.39'),
(15, 5, 25, 'ex13-35', 1, '1.00'),
(16, 5, 24, 'g1-11', 1, '22.23'),
(17, 5, 24, 'ex6-105', 1, '646.30'),
(18, 6, 24, 'g1-11', 1, '22.23'),
(19, 6, 25, 'g1-11', 1, '22.23'),
(24, 10, 24, 'base1-86', 1, '0.00'),
(25, 10, 25, 'sv08.5-033', 1, '0.00'),
(26, 10, 25, 'gym2-99', 1, '1.49');

-- --------------------------------------------------------

--
-- Table structure for table `upgrader_plays`
--

CREATE TABLE `upgrader_plays` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `bet_amount` decimal(12,2) NOT NULL,
  `target_card_id` varchar(64) NOT NULL,
  `target_price` decimal(12,2) NOT NULL,
  `win_chance` decimal(8,6) NOT NULL,
  `won` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `upgrader_plays`
--

INSERT INTO `upgrader_plays` (`id`, `user_id`, `bet_amount`, `target_card_id`, `target_price`, `win_chance`, `won`, `created_at`) VALUES
(1, 24, '10.00', 'g1-25', '39.94', '0.225338', 0, '2026-06-09 06:44:49'),
(2, 24, '10.00', 'dp2-123', '39.14', '0.229944', 1, '2026-06-09 06:44:59'),
(3, 24, '10.00', 'ex5-12', '20.82', '0.432277', 1, '2026-06-09 06:45:17'),
(4, 24, '50.00', 'bw10-104', '81.16', '0.554460', 1, '2026-06-09 06:49:41'),
(5, 24, '10.00', 'g1-24', '23.58', '0.381679', 1, '2026-06-09 06:49:56'),
(6, 24, '10.00', 'ex5-12', '20.82', '0.432277', 0, '2026-06-09 06:50:16'),
(7, 24, '10.00', 'base5-26', '39.32', '0.228891', 0, '2026-06-09 06:50:26'),
(8, 24, '10.00', 'ex12-5', '28.23', '0.318810', 0, '2026-06-09 06:50:33'),
(9, 24, '10.00', 'g1-11', '22.23', '0.404858', 1, '2026-06-09 06:50:41'),
(10, 24, '50.00', 'bw11-RC24', '222.29', '0.202438', 0, '2026-06-09 06:52:25'),
(11, 24, '100.00', 'ex6-105', '646.30', '0.139254', 0, '2026-06-09 06:53:00'),
(12, 24, '100.00', 'ex6-105', '646.30', '0.139254', 0, '2026-06-09 06:53:09'),
(13, 24, '100.00', 'ex6-105', '646.30', '0.139254', 0, '2026-06-09 06:53:15'),
(14, 24, '100.00', 'ex6-105', '646.30', '0.139254', 0, '2026-06-09 06:53:21'),
(15, 24, '100.00', 'ex6-105', '646.30', '0.139254', 1, '2026-06-09 06:53:27'),
(16, 24, '100.00', 'bw8-136', '589.25', '0.152737', 0, '2026-06-09 06:53:42'),
(17, 24, '100.00', 'bw7-151', '260.00', '0.346154', 0, '2026-06-09 06:53:48'),
(18, 24, '50.00', 'bw5-109', '244.26', '0.184230', 0, '2026-06-09 06:55:32'),
(19, 24, '50.00', 'dp5-97', '97.41', '0.461965', 1, '2026-06-09 06:55:39'),
(20, 24, '50.00', 'dp5-98', '113.55', '0.396301', 0, '2026-06-09 06:55:46'),
(21, 24, '50.00', 'dp5-97', '97.41', '0.461965', 0, '2026-06-09 06:55:52'),
(22, 24, '50.00', 'dp5-97', '97.41', '0.461965', 0, '2026-06-09 06:55:58'),
(23, 24, '50.00', 'dp5-98', '113.55', '0.396301', 0, '2026-06-09 06:56:04'),
(24, 24, '50.00', 'dp5-97', '97.41', '0.461965', 0, '2026-06-09 06:56:09'),
(25, 24, '50.00', 'dp5-98', '113.55', '0.396301', 0, '2026-06-09 06:56:15'),
(26, 24, '50.00', 'bw10-104', '81.16', '0.554460', 1, '2026-06-09 06:56:21'),
(27, 24, '50.00', 'bw10-104', '81.16', '0.554460', 0, '2026-06-09 06:56:28'),
(28, 24, '100.00', 'ex6-105', '646.30', '0.139254', 0, '2026-06-09 07:02:09'),
(29, 24, '100.00', 'bw7-151', '260.00', '0.346154', 0, '2026-06-09 07:02:16'),
(30, 24, '100.00', 'dp1-120', '108.56', '0.750000', 0, '2026-06-09 07:02:27'),
(31, 24, '100.00', 'dp1-120', '108.56', '0.750000', 1, '2026-06-09 07:02:34'),
(32, 24, '50.00', 'bw7-150', '52.90', '0.750000', 0, '2026-06-09 07:02:50'),
(33, 24, '50.00', 'bw7-150', '52.90', '0.750000', 1, '2026-06-09 07:02:58'),
(34, 24, '500.00', 'ex6-105', '646.30', '0.696271', 0, '2026-06-09 07:07:37'),
(35, 24, '500.00', 'ex6-105', '646.30', '0.696271', 0, '2026-06-09 07:07:44'),
(36, 24, '500.00', 'ex6-105', '646.30', '0.696271', 1, '2026-06-09 07:07:51'),
(37, 24, '450.00', 'ex6-105', '646.30', '0.626644', 1, '2026-06-09 07:10:35'),
(38, 24, '500.00', 'ex6-105', '646.30', '0.696271', 1, '2026-06-09 07:11:13'),
(39, 24, '50.00', 'bw7-150', '52.90', '0.750000', 1, '2026-06-09 08:11:31'),
(40, 25, '50.00', 'bw7-150', '52.90', '0.750000', 1, '2026-06-09 08:17:01'),
(41, 25, '485.00', 'ex6-105', '646.30', '0.675383', 0, '2026-06-09 08:18:20'),
(42, 25, '485.00', 'ex6-105', '646.30', '0.675383', 1, '2026-06-09 08:18:27'),
(43, 25, '500.00', 'ex6-105', '646.30', '0.696271', 1, '2026-06-09 08:18:51'),
(44, 25, '500.00', 'ex6-105', '646.30', '0.696271', 0, '2026-06-09 08:18:57'),
(45, 25, '500.00', 'ex6-105', '646.30', '0.696271', 0, '2026-06-09 08:19:03'),
(46, 25, '500.00', 'ex6-105', '646.30', '0.696271', 1, '2026-06-09 08:19:28'),
(47, 25, '500.00', 'ex6-105', '646.30', '0.696271', 1, '2026-06-09 08:19:35'),
(48, 25, '500.00', 'ex6-105', '646.30', '0.696271', 0, '2026-06-09 08:19:41'),
(49, 24, '50.00', 'dp2-122', '53.76', '0.750000', 1, '2026-06-10 06:10:52'),
(50, 24, '50.00', 'bw7-150', '52.90', '0.750000', 1, '2026-06-10 11:16:21'),
(51, 24, '50.00', 'bw5-109', '244.26', '0.184230', 0, '2026-06-10 11:16:31'),
(52, 24, '225.00', 'ex6-105', '646.30', '0.313322', 1, '2026-06-10 11:16:54'),
(53, 29, '25.00', 'dp7-SH2', '31.83', '0.706880', 1, '2026-06-15 08:49:17');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int NOT NULL,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `user_coins` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `wheel_tickets` int NOT NULL DEFAULT '0',
  `last_free_wheel_at` datetime DEFAULT NULL,
  `total_wagered` decimal(14,2) NOT NULL DEFAULT '0.00',
  `biggest_win` decimal(14,2) NOT NULL DEFAULT '0.00',
  `user_level` int NOT NULL DEFAULT '1',
  `win_count` int NOT NULL DEFAULT '0',
  `upgrader_wins` int NOT NULL DEFAULT '0',
  `battles_won` int NOT NULL DEFAULT '0',
  `raffle_wager_carry` decimal(10,2) NOT NULL DEFAULT '0.00'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `email`, `password`, `user_coins`, `created_at`, `wheel_tickets`, `last_free_wheel_at`, `total_wagered`, `biggest_win`, `user_level`, `win_count`, `upgrader_wins`, `battles_won`, `raffle_wager_carry`) VALUES
(24, 'kaas', 'a@a.com', '$2y$10$64Bna9Plx3LBMgwMIMEvZe81dbFAHHpyN7EeolFXPkczhN59dwyKO', '2428.67', '2026-05-27 07:26:57', 0, NULL, '2958.25', '7.00', 1, 7, 4, 0, '8.25'),
(25, 'kutje', 'k.nl', '$2y$10$YGGBlAJqAbKz0V1mGDp7S.88w819evD/2OwkoV3AJtuvF.0PGjoF6', '8289.77', '2026-05-27 07:39:39', 0, '2026-06-03 11:24:49', '4378.00', '68.72', 5, 9, 5, 2, '8.00'),
(29, 'max', 'm.nl', '$2y$10$.vys39i7KqGxQ.312CHhk.VZ5XuCRLDcD3uc20eRjB6umGcmcKoA6', '298.03', '2026-06-15 08:48:05', 0, NULL, '340.00', '31.83', 1, 4, 1, 1, '0.00');

-- --------------------------------------------------------

--
-- Table structure for table `user_cards`
--

CREATE TABLE `user_cards` (
  `id` bigint UNSIGNED NOT NULL,
  `user_id` int DEFAULT NULL,
  `card_id` varchar(50) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `card_amount` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `user_cards`
--

INSERT INTO `user_cards` (`id`, `user_id`, `card_id`, `created_at`, `card_amount`) VALUES
(386, 25, 'base1-3', '2026-05-27 09:14:08', 10),
(388, 24, 'pl3-117', '2026-05-28 06:57:18', 20),
(389, 25, 'sv08.5-033', '2026-05-28 09:02:08', 1),
(390, 25, 'sv08.5-125', '2026-05-28 09:02:16', 1),
(395, 24, 'base1-39', '2026-06-03 06:44:56', 1),
(396, 24, 'base1-43', '2026-06-03 06:44:58', 1),
(397, 24, 'base1-48', '2026-06-03 06:44:59', 1),
(398, 24, 'base1-23', '2026-06-03 06:45:00', 1),
(399, 24, 'base1-33', '2026-06-03 06:45:01', 1),
(400, 24, 'base1-59', '2026-06-03 06:45:02', 1),
(401, 24, 'base1-52', '2026-06-03 06:45:03', 1),
(402, 24, 'base1-85', '2026-06-03 06:45:03', 1),
(403, 24, 'base1-97', '2026-06-03 06:45:04', 1),
(404, 24, 'base1-75', '2026-06-03 06:45:05', 1),
(405, 24, 'xy4-34', '2026-06-03 07:11:31', 2),
(406, 24, 'swsh4-16', '2026-06-03 07:11:31', 1),
(407, 24, 'swsh4-53', '2026-06-03 07:11:31', 1),
(408, 24, 'swsh4-170', '2026-06-03 07:11:31', 1),
(409, 24, 'swsh4-120', '2026-06-03 07:11:31', 1),
(410, 24, 'swsh3-72', '2026-06-03 07:11:31', 1),
(411, 24, 'swsh5-18', '2026-06-03 07:15:08', 1),
(412, 24, 'swsh3-54', '2026-06-03 07:15:08', 1),
(413, 24, 'swsh5-72', '2026-06-03 07:15:43', 1),
(414, 24, 'gym1-26', '2026-06-03 07:15:43', 1),
(415, 24, 'gym1-64', '2026-06-03 07:15:43', 1),
(416, 24, 'swsh3-13', '2026-06-03 07:15:43', 1),
(417, 24, 'xy4-113', '2026-06-03 07:15:43', 1),
(418, 24, 'base1-10', '2026-06-03 07:22:37', 1),
(419, 24, 'sv04-145', '2026-06-03 07:23:27', 1),
(420, 24, 'sv04-213', '2026-06-03 07:23:27', 1),
(421, 24, 'base1-15', '2026-06-03 07:23:27', 1),
(422, 24, 'sv04-037', '2026-06-03 07:23:27', 1),
(423, 24, 'sv04-216', '2026-06-03 07:23:27', 1),
(425, 25, 'xy11-64', '2026-06-03 07:29:25', 1),
(426, 25, 'sv03-095', '2026-06-03 07:29:25', 1),
(427, 24, 'base1-86', '2026-06-03 07:32:19', 1),
(428, 24, 'sv03-152', '2026-06-03 07:32:19', 1),
(430, 24, 'sv03-218', '2026-06-03 07:35:49', 1),
(431, 24, 'sv04-029', '2026-06-03 07:36:37', 1),
(432, 24, 'me02-068', '2026-06-03 07:36:37', 1),
(433, 25, 'sm9-124', '2026-06-03 07:37:10', 1),
(434, 25, 'xy11-53', '2026-06-03 07:37:10', 2),
(435, 25, 'sv04-223', '2026-06-03 08:06:35', 1),
(436, 25, 'sv04-236', '2026-06-03 08:06:35', 1),
(437, 25, 'sv04-262', '2026-06-03 08:06:35', 1),
(438, 25, 'me02-106', '2026-06-03 08:06:35', 1),
(439, 25, 'me02-114', '2026-06-03 08:06:35', 1),
(440, 25, 'me02-004', '2026-06-03 08:06:35', 1),
(441, 25, 'sv04-029', '2026-06-03 08:07:21', 1),
(442, 25, 'sv04-050', '2026-06-03 08:10:04', 1),
(443, 25, 'xy11-67', '2026-06-03 08:10:04', 1),
(444, 24, 'sm9-134', '2026-06-03 08:10:50', 1),
(445, 24, 'me02-017', '2026-06-03 08:10:50', 1),
(446, 24, 'bw8-138', '2026-06-03 08:53:53', 1),
(447, 24, 'bw10-101', '2026-06-03 08:53:53', 1),
(448, 25, 'gym1-80', '2026-06-03 09:30:29', 5),
(449, 25, 'bw3-54', '2026-06-03 09:30:32', 1),
(450, 25, 'gym2-99', '2026-06-03 09:34:14', 1),
(451, 25, 'bw11-RC7', '2026-06-03 09:48:24', 1),
(452, 24, 'gym1-80', '2026-06-03 09:51:51', 4),
(454, 24, 'gym2-99', '2026-06-03 09:52:09', 2),
(456, 24, 'bw11-RC7', '2026-06-03 10:02:03', 2),
(457, 24, 'base2-6', '2026-06-03 11:20:27', 1),
(458, 24, 'ex15-19', '2026-06-03 11:20:27', 1),
(462, 24, 'dp2-123', '2026-06-09 06:44:59', 1),
(463, 24, 'ex5-12', '2026-06-09 06:45:17', 1),
(464, 24, 'bw10-104', '2026-06-09 06:49:41', 2),
(465, 24, 'g1-24', '2026-06-09 06:49:56', 1),
(467, 24, 'ex6-105', '2026-06-09 06:53:27', 5),
(468, 24, 'dp5-97', '2026-06-09 06:55:39', 1),
(469, 24, 'dp1-120', '2026-06-09 07:02:34', 1),
(470, 24, 'bw7-150', '2026-06-09 07:02:58', 3),
(471, 25, 'bw7-150', '2026-06-09 08:17:01', 1),
(472, 25, 'ex13-35', '2026-06-09 08:17:14', 2),
(473, 25, 'dp5-98', '2026-06-09 08:17:50', 1),
(475, 25, 'ex6-105', '2026-06-09 08:18:26', 4),
(476, 25, 'ex5-29', '2026-06-09 08:54:07', 1),
(477, 24, 'ex5-29', '2026-06-09 08:55:24', 2),
(478, 25, 'g1-11', '2026-06-09 08:56:30', 1),
(479, 24, 'g1-11', '2026-06-09 10:00:42', 1),
(480, 27, 'ex5-29', '2026-06-09 10:02:24', 1),
(481, 27, 'bw11-RC7', '2026-06-09 10:12:11', 1),
(482, 27, 'base3-37', '2026-06-09 12:07:28', 1),
(483, 27, 'base3-35', '2026-06-09 12:07:32', 1),
(484, 27, 'base3-33', '2026-06-09 12:07:34', 1),
(485, 27, 'base3-62', '2026-06-09 12:07:35', 1),
(486, 27, 'base3-54', '2026-06-09 12:07:36', 1),
(487, 27, 'base3-42', '2026-06-09 12:07:38', 1),
(488, 27, 'base3-32', '2026-06-09 12:07:38', 1),
(489, 27, 'base3-61', '2026-06-09 12:07:39', 1),
(490, 27, 'base3-44', '2026-06-09 12:07:40', 1),
(491, 24, 'dp2-122', '2026-06-10 06:10:52', 1),
(492, 24, 'base1-60', '2026-06-10 06:11:35', 1),
(493, 25, 'g1-24', '2026-06-10 07:25:16', 1),
(494, 25, 'dp6-142', '2026-06-10 07:25:16', 1),
(495, 24, 'base1-3', '2026-06-11 06:45:10', 5),
(496, 24, 'sv03-214', '2026-06-11 08:51:07', 1),
(497, 24, 'xy9-71', '2026-06-11 08:54:53', 1),
(498, 24, 'sm115-54', '2026-06-11 08:56:45', 1),
(499, 24, 'bw9-116', '2026-06-15 06:56:17', 2),
(501, 24, 'ex10-18', '2026-06-15 06:58:26', 1),
(502, 24, 'bw2-24', '2026-06-15 06:58:56', 1),
(503, 24, 'bw11-5', '2026-06-15 06:59:05', 1),
(504, 24, 'g1-RC29', '2026-06-15 06:59:59', 1),
(505, 24, 'g1-RC6', '2026-06-15 07:00:09', 1),
(506, 24, 'bw11-RC22', '2026-06-15 07:00:26', 1),
(507, 29, 'ex13-35', '2026-06-15 08:48:59', 1),
(509, 29, 'bw3-68', '2026-06-15 08:53:20', 2),
(510, 29, 'ex14-98', '2026-06-15 08:53:20', 1),
(511, 29, 'dp1-82', '2026-06-15 08:53:20', 1),
(512, 29, 'base4-43', '2026-06-15 08:53:20', 1),
(513, 29, 'bw8-101', '2026-06-15 08:53:20', 1),
(514, 29, 'bw1-2', '2026-06-15 09:07:45', 1),
(515, 29, 'bw1-33', '2026-06-15 09:07:46', 1),
(516, 29, 'bw1-68', '2026-06-15 09:07:47', 1),
(517, 29, 'bw1-52', '2026-06-15 09:07:48', 1),
(518, 29, 'bw1-75', '2026-06-15 09:07:48', 1),
(519, 29, 'bw1-7', '2026-06-15 09:07:49', 1),
(520, 29, 'bw1-72', '2026-06-15 09:07:50', 1),
(521, 29, 'bw1-9', '2026-06-15 09:07:51', 1),
(522, 29, 'bw1-106', '2026-06-15 09:07:51', 1),
(523, 29, 'bw1-83', '2026-06-15 09:07:52', 1),
(524, 29, 'swsh10.5-002', '2026-06-15 09:16:10', 1),
(525, 29, 'swsh10.5-021', '2026-06-15 09:16:11', 1),
(526, 29, 'swsh10.5-042', '2026-06-15 09:16:11', 1),
(527, 29, 'swsh10.5-070', '2026-06-15 09:16:11', 1),
(528, 29, 'swsh10.5-036', '2026-06-15 09:16:11', 1),
(529, 29, 'swsh10.5-015', '2026-06-15 09:16:11', 1),
(530, 29, 'swsh10.5-032', '2026-06-15 09:16:11', 1),
(531, 29, 'swsh10.5-066', '2026-06-15 09:16:11', 1),
(532, 29, 'swsh10.5-068', '2026-06-15 09:16:11', 1),
(533, 29, 'swsh10.5-029', '2026-06-15 09:16:11', 1),
(534, 29, 'swsh10.5-067', '2026-06-15 09:16:33', 1),
(535, 29, 'swsh10.5-013', '2026-06-15 09:16:33', 1),
(536, 29, 'swsh10.5-057', '2026-06-15 09:16:33', 1),
(537, 29, 'swsh10.5-016', '2026-06-15 09:16:33', 1),
(538, 29, 'swsh10.5-009', '2026-06-15 09:16:33', 1),
(539, 29, 'swsh10.5-027', '2026-06-15 09:16:33', 1),
(540, 29, 'swsh10.5-001', '2026-06-15 09:16:33', 1),
(541, 29, 'swsh10.5-041', '2026-06-15 09:16:33', 1),
(542, 29, 'swsh10.5-063', '2026-06-15 09:16:33', 1),
(543, 29, 'swsh10.5-017', '2026-06-15 09:16:33', 1),
(544, 29, 'base2-41', '2026-06-15 09:17:04', 1),
(545, 29, 'base2-37', '2026-06-15 09:17:04', 1),
(546, 29, 'base2-53', '2026-06-15 09:17:04', 1),
(547, 29, 'base2-48', '2026-06-15 09:17:04', 1),
(548, 29, 'base2-55', '2026-06-15 09:17:04', 1),
(549, 29, 'base2-60', '2026-06-15 09:17:04', 1),
(550, 29, 'base2-61', '2026-06-15 09:17:04', 1),
(551, 29, 'base2-49', '2026-06-15 09:17:04', 1),
(552, 29, 'base2-44', '2026-06-15 09:17:04', 1),
(553, 29, 'base2-9', '2026-06-15 09:17:04', 1),
(554, 29, 'base1-91', '2026-06-15 09:17:40', 1),
(555, 29, 'base1-40', '2026-06-15 09:17:40', 1),
(556, 29, 'base1-65', '2026-06-15 09:17:40', 1),
(557, 29, 'base1-58', '2026-06-15 09:17:40', 1),
(558, 29, 'base1-88', '2026-06-15 09:17:40', 1),
(559, 29, 'base1-52', '2026-06-15 09:17:40', 1),
(560, 29, 'base1-61', '2026-06-15 09:17:40', 1),
(561, 29, 'base1-94', '2026-06-15 09:17:40', 1),
(562, 29, 'base1-101', '2026-06-15 09:17:40', 1),
(563, 29, 'base1-11', '2026-06-15 09:17:41', 1);

-- --------------------------------------------------------

--
-- Table structure for table `user_packs`
--

CREATE TABLE `user_packs` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `tcgdex_set_id` varchar(64) DEFAULT NULL,
  `set_name` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `user_packs`
--

INSERT INTO `user_packs` (`id`, `user_id`, `tcgdex_set_id`, `set_name`, `created_at`) VALUES
(221, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:52:54'),
(222, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:52:56'),
(223, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:52:58'),
(224, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:52:59'),
(225, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:11'),
(226, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:12'),
(229, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:12'),
(230, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:12'),
(231, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:12'),
(232, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:12'),
(233, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:12'),
(234, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:12'),
(235, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:12'),
(236, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:13'),
(237, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:13'),
(238, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:13'),
(239, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:13'),
(240, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:13'),
(241, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:13'),
(242, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:13'),
(243, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:13'),
(244, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:13'),
(245, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:13'),
(246, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:13'),
(247, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:14'),
(248, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:14'),
(249, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:14'),
(250, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:14'),
(251, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:14'),
(252, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:14'),
(253, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:14'),
(254, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:14'),
(255, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:14'),
(256, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:14'),
(257, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:15'),
(258, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:15'),
(259, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:15'),
(260, 25, 'sv08.5', 'Prismatic Evolutions', '2026-05-28 10:53:15'),
(270, 25, 'base1', 'Base Set', '2026-05-28 11:13:05'),
(280, 25, 'swsh3.5', 'Champion\'s Path', '2026-06-03 11:39:51'),
(281, 25, 'sv02', 'Paldea Evolved', '2026-06-03 11:47:44'),
(282, 25, 'sv02', 'Paldea Evolved', '2026-06-03 11:49:11'),
(297, 25, 'base2', 'Jungle', '2026-06-09 10:14:36');

-- --------------------------------------------------------

--
-- Table structure for table `wheel_spins`
--

CREATE TABLE `wheel_spins` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `segment_id` int NOT NULL,
  `payment_type` varchar(16) NOT NULL,
  `reward_type` varchar(24) NOT NULL,
  `reward_json` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `wheel_spins`
--

INSERT INTO `wheel_spins` (`id`, `user_id`, `segment_id`, `payment_type`, `reward_type`, `reward_json`, `created_at`) VALUES
(1, 25, 1, 'free', 'coins', '{\"type\":\"coins\",\"amount\":0.5,\"message\":\"+0.5 coins\"}', '2026-06-03 09:24:49'),
(2, 25, 1, 'coins', 'coins', '{\"type\":\"coins\",\"amount\":12.61,\"message\":\"+12.61 coins\"}', '2026-06-03 09:30:20'),
(3, 25, 3, 'coins', 'card', '{\"type\":\"card\",\"card\":{\"id\":\"gym1-80\",\"name\":\"Lt. Surge\'s Magnemite\",\"image\":\"https:\\/\\/assets.tcgdex.net\\/en\\/gym\\/gym1\\/80\\/high.webp\",\"rarity\":\"Common\",\"price\":7},\"message\":\"You won Lt. Surge\'s Magnemite (\\u22487.00 coins value)!\"}', '2026-06-03 09:30:29'),
(4, 25, 0, 'coins', 'nothing', '{\"type\":\"nothing\",\"message\":\"No prize this time.\"}', '2026-06-03 09:30:30'),
(5, 25, 7, 'coins', 'tickets', '{\"type\":\"tickets\",\"amount\":1,\"message\":\"+1 ticket(s)\"}', '2026-06-03 09:30:31'),
(6, 25, 4, 'coins', 'card', '{\"type\":\"card\",\"card\":{\"id\":\"bw3-54\",\"name\":\"Elgyem\",\"image\":\"https:\\/\\/assets.tcgdex.net\\/en\\/bw\\/bw3\\/54\\/high.webp\",\"rarity\":\"Common\",\"price\":0.02},\"message\":\"You won Elgyem (\\u22480.02 coins value)!\"}', '2026-06-03 09:30:32'),
(7, 25, 3, 'ticket', 'card', '{\"type\":\"card\",\"card\":{\"id\":\"gym2-99\",\"name\":\"Sabrina\'s Psyduck\",\"image\":\"https:\\/\\/assets.tcgdex.net\\/en\\/gym\\/gym2\\/99\\/high.webp\",\"rarity\":\"Common\",\"price\":1.49},\"message\":\"You won Sabrina\'s Psyduck (\\u22481.49 coins value)!\"}', '2026-06-03 09:34:14'),
(8, 25, 3, 'coins', 'card', '{\"type\":\"card\",\"card\":{\"id\":\"gym1-80\",\"name\":\"Lt. Surge\'s Magnemite\",\"image\":\"https:\\/\\/assets.tcgdex.net\\/en\\/gym\\/gym1\\/80\\/high.webp\",\"rarity\":\"Common\",\"price\":7},\"message\":\"You won Lt. Surge\'s Magnemite (\\u22487.00 coins value)!\"}', '2026-06-03 09:34:26'),
(9, 25, 84, 'coins', 'pack', '{\"type\":\"pack\",\"pack\":{\"setId\":\"swsh3.5\",\"name\":\"Champion\'s Path\",\"image\":\"\\/images\\/fullpacks\\/sword&shield\\/swsh3.5.png\",\"shopPrice\":4},\"message\":\"Shop pack \\\"Champion\'s Path\\\" added to your inventory!\",\"bigWin\":true}', '2026-06-03 09:39:51'),
(10, 25, 7, 'coins', 'card', '{\"type\":\"card\",\"card\":{\"id\":\"gym1-80\",\"name\":\"Lt. Surge\'s Magnemite\",\"image\":\"https:\\/\\/assets.tcgdex.net\\/en\\/gym\\/gym1\\/80\\/high.webp\",\"rarity\":\"Common\",\"price\":7},\"message\":\"You won Lt. Surge\'s Magnemite (\\u22487.00 coins value)!\"}', '2026-06-03 09:42:58'),
(11, 25, 4, 'coins', 'tickets', '{\"type\":\"tickets\",\"amount\":1,\"message\":\"+1 ticket(s)\"}', '2026-06-03 09:47:38'),
(12, 25, 12, 'ticket', 'pack', '{\"type\":\"pack\",\"pack\":{\"setId\":\"sv02\",\"name\":\"Paldea Evolved\",\"image\":\"\\/images\\/fullpacks\\/scarlet&violet\\/sv2.png\",\"shopPrice\":5},\"message\":\"Shop pack \\\"Paldea Evolved\\\" added to your inventory!\",\"bigWin\":true}', '2026-06-03 09:47:44'),
(13, 25, 4, 'coins', 'tickets', '{\"type\":\"tickets\",\"amount\":1,\"message\":\"+1 ticket(s)\"}', '2026-06-03 09:47:59'),
(14, 25, 3, 'ticket', 'coins', '{\"type\":\"coins\",\"amount\":100,\"message\":\"+100 coins\"}', '2026-06-03 09:48:04'),
(15, 25, 9, 'coins', 'card', '{\"type\":\"card\",\"card\":{\"id\":\"bw11-RC7\",\"name\":\"Pikachu\",\"image\":\"https:\\/\\/assets.tcgdex.net\\/en\\/bw\\/bw11\\/RC7\\/high.webp\",\"rarity\":\"Uncommon\",\"price\":25},\"message\":\"You won Pikachu (\\u224825.00 coins value)!\"}', '2026-06-03 09:48:24'),
(16, 25, 1, 'coins', 'coins', '{\"type\":\"coins\",\"amount\":15,\"message\":\"+15 coins\"}', '2026-06-03 09:48:59'),
(17, 25, 1, 'coins', 'coins', '{\"type\":\"coins\",\"amount\":15,\"message\":\"+15 coins\"}', '2026-06-03 09:49:05'),
(18, 25, 12, 'coins', 'pack', '{\"type\":\"pack\",\"pack\":{\"setId\":\"sv02\",\"name\":\"Paldea Evolved\",\"image\":\"\\/images\\/fullpacks\\/scarlet&violet\\/sv2.png\",\"shopPrice\":5},\"message\":\"Shop pack \\\"Paldea Evolved\\\" added to your inventory!\",\"bigWin\":true}', '2026-06-03 09:49:11'),
(19, 24, 11, 'coins', 'pack', '{\"type\":\"pack\",\"pack\":{\"setId\":\"ex11\",\"name\":\"Delta Species\",\"image\":\"\\/images\\/fullpacks\\/ex\\/ex11.png\",\"shopPrice\":4},\"message\":\"Shop pack \\\"Delta Species\\\" added to your inventory!\",\"bigWin\":true}', '2026-06-03 09:50:52'),
(20, 24, 7, 'coins', 'card', '{\"type\":\"card\",\"card\":{\"id\":\"gym1-80\",\"name\":\"Lt. Surge\'s Magnemite\",\"image\":\"https:\\/\\/assets.tcgdex.net\\/en\\/gym\\/gym1\\/80\\/high.webp\",\"rarity\":\"Common\",\"price\":7},\"message\":\"You won Lt. Surge\'s Magnemite (\\u22487.00 coins value)!\"}', '2026-06-03 09:51:51'),
(21, 24, 2, 'coins', 'coins', '{\"type\":\"coins\",\"amount\":60,\"message\":\"+60 coins\"}', '2026-06-03 09:51:58'),
(22, 24, 2, 'coins', 'coins', '{\"type\":\"coins\",\"amount\":60,\"message\":\"+60 coins\"}', '2026-06-03 09:52:04'),
(23, 24, 8, 'coins', 'card', '{\"type\":\"card\",\"card\":{\"id\":\"ex5-29\",\"name\":\"Beldum\",\"image\":\"https:\\/\\/assets.tcgdex.net\\/en\\/ex\\/ex5\\/29\\/high.webp\",\"rarity\":\"Uncommon\",\"price\":14.39},\"message\":\"You won Beldum (\\u224814.39 coins value)!\"}', '2026-06-03 09:52:05'),
(24, 24, 2, 'coins', 'coins', '{\"type\":\"coins\",\"amount\":60,\"message\":\"+60 coins\"}', '2026-06-03 09:52:06'),
(25, 24, 3, 'coins', 'coins', '{\"type\":\"coins\",\"amount\":100,\"message\":\"+100 coins\"}', '2026-06-03 09:52:07'),
(26, 24, 8, 'coins', 'card', '{\"type\":\"card\",\"card\":{\"id\":\"ex5-29\",\"name\":\"Beldum\",\"image\":\"https:\\/\\/assets.tcgdex.net\\/en\\/ex\\/ex5\\/29\\/high.webp\",\"rarity\":\"Uncommon\",\"price\":14.39},\"message\":\"You won Beldum (\\u224814.39 coins value)!\"}', '2026-06-03 09:52:07'),
(27, 24, 1, 'coins', 'coins', '{\"type\":\"coins\",\"amount\":15,\"message\":\"+15 coins\"}', '2026-06-03 09:52:08'),
(28, 24, 11, 'coins', 'pack', '{\"type\":\"pack\",\"pack\":{\"setId\":\"ex11\",\"name\":\"Delta Species\",\"image\":\"\\/images\\/fullpacks\\/ex\\/ex11.png\",\"shopPrice\":4},\"message\":\"Shop pack \\\"Delta Species\\\" added to your inventory!\",\"bigWin\":true}', '2026-06-03 09:52:08'),
(29, 24, 1, 'coins', 'coins', '{\"type\":\"coins\",\"amount\":15,\"message\":\"+15 coins\"}', '2026-06-03 09:52:09'),
(30, 24, 6, 'coins', 'card', '{\"type\":\"card\",\"card\":{\"id\":\"gym2-99\",\"name\":\"Sabrina\'s Psyduck\",\"image\":\"https:\\/\\/assets.tcgdex.net\\/en\\/gym\\/gym2\\/99\\/high.webp\",\"rarity\":\"Common\",\"price\":1.49},\"message\":\"You won Sabrina\'s Psyduck (\\u22481.49 coins value)!\"}', '2026-06-03 09:52:09'),
(31, 24, 8, 'coins', 'card', '{\"type\":\"card\",\"card\":{\"id\":\"ex5-29\",\"name\":\"Beldum\",\"image\":\"https:\\/\\/assets.tcgdex.net\\/en\\/ex\\/ex5\\/29\\/high.webp\",\"rarity\":\"Uncommon\",\"price\":14.39},\"message\":\"You won Beldum (\\u224814.39 coins value)!\"}', '2026-06-03 09:52:10'),
(32, 24, 4, 'coins', 'tickets', '{\"type\":\"tickets\",\"amount\":1,\"message\":\"+1 ticket(s)\"}', '2026-06-03 09:52:16'),
(33, 24, 5, 'ticket', 'card', '{\"type\":\"card\",\"card\":{\"id\":\"ex13-35\",\"name\":\"Aerodactyl \\u03b4\",\"image\":\"https:\\/\\/assets.tcgdex.net\\/en\\/ex\\/ex13\\/35\\/high.webp\",\"rarity\":\"Uncommon\",\"price\":1},\"message\":\"You won Aerodactyl \\u03b4 (\\u22481.00 coins value)!\"}', '2026-06-03 09:52:22'),
(34, 24, 10, 'coins', 'pack', '{\"type\":\"pack\",\"pack\":{\"setId\":\"ex15\",\"name\":\"Dragon Frontiers\",\"image\":\"\\/images\\/fullpacks\\/ex\\/ex15.png\",\"shopPrice\":4},\"message\":\"Shop pack \\\"Dragon Frontiers\\\" added to your inventory!\",\"bigWin\":true}', '2026-06-03 09:52:28'),
(35, 24, 7, 'coins', 'card', '{\"type\":\"card\",\"card\":{\"id\":\"gym1-80\",\"name\":\"Lt. Surge\'s Magnemite\",\"image\":\"https:\\/\\/assets.tcgdex.net\\/en\\/gym\\/gym1\\/80\\/high.webp\",\"rarity\":\"Common\",\"price\":7},\"message\":\"You won Lt. Surge\'s Magnemite (\\u22487.00 coins value)!\"}', '2026-06-03 10:00:54'),
(36, 24, 2, 'coins', 'coins', '{\"type\":\"coins\",\"amount\":60,\"message\":\"+60 coins\"}', '2026-06-03 10:02:00'),
(37, 24, 9, 'coins', 'card', '{\"type\":\"card\",\"card\":{\"id\":\"bw11-RC7\",\"name\":\"Pikachu\",\"image\":\"https:\\/\\/assets.tcgdex.net\\/en\\/bw\\/bw11\\/RC7\\/high.webp\",\"rarity\":\"Uncommon\",\"price\":25},\"message\":\"You won Pikachu (\\u224825.00 coins value)!\"}', '2026-06-03 10:02:03'),
(38, 24, 2, 'coins', 'coins', '{\"type\":\"coins\",\"amount\":60,\"message\":\"+60 coins\"}', '2026-06-03 10:02:09'),
(39, 24, 9, 'coins', 'card', '{\"type\":\"card\",\"card\":{\"id\":\"bw11-RC7\",\"name\":\"Pikachu\",\"image\":\"https:\\/\\/assets.tcgdex.net\\/en\\/bw\\/bw11\\/RC7\\/high.webp\",\"rarity\":\"Uncommon\",\"price\":25},\"message\":\"You won Pikachu (\\u224825.00 coins value)!\"}', '2026-06-03 10:02:15'),
(40, 24, 0, 'coins', 'nothing', '{\"type\":\"nothing\",\"message\":\"No prize this time.\"}', '2026-06-03 10:02:21'),
(41, 24, 2, 'coins', 'coins', '{\"type\":\"coins\",\"amount\":60,\"message\":\"+60 coins\"}', '2026-06-03 10:02:30'),
(42, 24, 2, 'coins', 'coins', '{\"type\":\"coins\",\"amount\":60,\"message\":\"+60 coins\"}', '2026-06-03 10:11:31'),
(43, 24, 12, 'coins', 'pack', '{\"type\":\"pack\",\"pack\":{\"setId\":\"sv02\",\"name\":\"Paldea Evolved\",\"image\":\"\\/images\\/fullpacks\\/scarlet&violet\\/sv2.png\",\"shopPrice\":5},\"message\":\"Shop pack \\\"Paldea Evolved\\\" added to your inventory!\",\"bigWin\":true}', '2026-06-03 10:11:40'),
(44, 24, 2, 'coins', 'coins', '{\"type\":\"coins\",\"amount\":60,\"message\":\"+60 coins\"}', '2026-06-03 10:11:52'),
(45, 24, 4, 'coins', 'tickets', '{\"type\":\"tickets\",\"amount\":1,\"message\":\"+1 ticket(s)\"}', '2026-06-03 10:12:03'),
(46, 24, 7, 'ticket', 'card', '{\"type\":\"card\",\"card\":{\"id\":\"gym1-80\",\"name\":\"Lt. Surge\'s Magnemite\",\"image\":\"https:\\/\\/assets.tcgdex.net\\/en\\/gym\\/gym1\\/80\\/high.webp\",\"rarity\":\"Common\",\"price\":7},\"message\":\"You won Lt. Surge\'s Magnemite (\\u22487.00 coins value)!\"}', '2026-06-03 10:12:09'),
(47, 24, 2, 'coins', 'coins', '{\"type\":\"coins\",\"amount\":60,\"message\":\"+60 coins\"}', '2026-06-03 10:12:15'),
(48, 24, 8, 'coins', 'card', '{\"type\":\"card\",\"card\":{\"id\":\"ex5-29\",\"name\":\"Beldum\",\"image\":\"https:\\/\\/assets.tcgdex.net\\/en\\/ex\\/ex5\\/29\\/high.webp\",\"rarity\":\"Uncommon\",\"price\":14.39},\"message\":\"You won Beldum (\\u224814.39 coins value)!\"}', '2026-06-03 10:12:20'),
(49, 24, 13, 'coins', 'card', '{\"type\":\"card\",\"card\":{\"id\":\"bw11-RC7\",\"name\":\"Pikachu\",\"image\":\"https:\\/\\/assets.tcgdex.net\\/en\\/bw\\/bw11\\/RC7\\/high.webp\",\"rarity\":\"Uncommon\",\"price\":25},\"message\":\"You won Pikachu (\\u224825.00 coins value)!\",\"bigWin\":true}', '2026-06-03 10:12:27'),
(50, 24, 6, 'coins', 'card', '{\"type\":\"card\",\"card\":{\"id\":\"gym2-99\",\"name\":\"Sabrina\'s Psyduck\",\"image\":\"https:\\/\\/assets.tcgdex.net\\/en\\/gym\\/gym2\\/99\\/high.webp\",\"rarity\":\"Common\",\"price\":1.49},\"message\":\"You won Sabrina\'s Psyduck (\\u22481.49 coins value)!\"}', '2026-06-03 11:21:23'),
(51, 27, 7, 'coins', 'card', '{\"type\":\"card\",\"card\":{\"id\":\"gym1-80\",\"name\":\"Lt. Surge\'s Magnemite\",\"image\":\"https:\\/\\/assets.tcgdex.net\\/en\\/gym\\/gym1\\/80\\/high.webp\",\"rarity\":\"Common\",\"price\":7},\"message\":\"You won Lt. Surge\'s Magnemite (\\u22487.00 coins value)!\"}', '2026-06-08 07:31:10'),
(52, 24, 3, 'coins', 'coins', '{\"type\":\"coins\",\"amount\":100,\"message\":\"+100 coins\"}', '2026-06-09 07:57:06'),
(53, 24, 11, 'coins', 'pack', '{\"type\":\"pack\",\"pack\":{\"setId\":\"ex11\",\"name\":\"Delta Species\",\"image\":\"\\/images\\/fullpacks\\/ex\\/ex11.png\",\"shopPrice\":4},\"message\":\"Shop pack \\\"Delta Species\\\" added to your inventory!\",\"bigWin\":true}', '2026-06-09 08:11:11'),
(54, 24, 7, 'coins', 'card', '{\"type\":\"card\",\"card\":{\"id\":\"gym1-80\",\"name\":\"Lt. Surge\'s Magnemite\",\"image\":\"https:\\/\\/assets.tcgdex.net\\/en\\/gym\\/gym1\\/80\\/high.webp\",\"rarity\":\"Common\",\"price\":7},\"message\":\"You won Lt. Surge\'s Magnemite (\\u22487.00 coins value)!\"}', '2026-06-09 08:11:57'),
(55, 24, 0, 'coins', 'nothing', '{\"type\":\"nothing\",\"message\":\"No prize this time.\"}', '2026-06-09 08:11:58'),
(56, 25, 4, 'coins', 'tickets', '{\"type\":\"tickets\",\"amount\":1,\"message\":\"+1 ticket(s)\"}', '2026-06-09 08:17:08'),
(57, 25, 5, 'ticket', 'card', '{\"type\":\"card\",\"card\":{\"id\":\"ex13-35\",\"name\":\"Aerodactyl \\u03b4\",\"image\":\"https:\\/\\/assets.tcgdex.net\\/en\\/ex\\/ex13\\/35\\/high.webp\",\"rarity\":\"Uncommon\",\"price\":1},\"message\":\"You won Aerodactyl \\u03b4 (\\u22481.00 coins value)!\"}', '2026-06-09 08:17:14'),
(58, 24, 7, 'ticket', 'card', '{\"type\":\"card\",\"card\":{\"id\":\"gym1-80\",\"name\":\"Lt. Surge\'s Magnemite\",\"image\":\"https:\\/\\/assets.tcgdex.net\\/en\\/gym\\/gym1\\/80\\/high.webp\",\"rarity\":\"Common\",\"price\":7},\"message\":\"You won Lt. Surge\'s Magnemite (\\u22487.00 coins value)!\"}', '2026-06-09 12:18:40'),
(59, 29, 5, 'coins', 'card', '{\"type\":\"card\",\"card\":{\"id\":\"ex13-35\",\"name\":\"Aerodactyl \\u03b4\",\"image\":\"https:\\/\\/assets.tcgdex.net\\/en\\/ex\\/ex13\\/35\\/high.webp\",\"rarity\":\"Uncommon\",\"price\":1},\"message\":\"You won Aerodactyl \\u03b4 (\\u22481.00 coins value)!\"}', '2026-06-15 08:48:59');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `battle_crates`
--
ALTER TABLE `battle_crates`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`),
  ADD KEY `idx_tier` (`tier`),
  ADD KEY `idx_sort` (`sort_order`);

--
-- Indexes for table `battle_crate_items`
--
ALTER TABLE `battle_crate_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_crate` (`crate_id`),
  ADD KEY `idx_card` (`card_id`);

--
-- Indexes for table `crate_battle_rooms`
--
ALTER TABLE `crate_battle_rooms`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `room_code` (`room_code`),
  ADD KEY `idx_room_code` (`room_code`),
  ADD KEY `idx_status` (`status`);

--
-- Indexes for table `favorites`
--
ALTER TABLE `favorites`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_favorite` (`user_id`,`card_id`);

--
-- Indexes for table `marketplace`
--
ALTER TABLE `marketplace`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `packs`
--
ALTER TABLE `packs`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `raffles`
--
ALTER TABLE `raffles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_raffle_hour` (`hour_key`),
  ADD KEY `idx_raffle_drawn` (`drawn_at`),
  ADD KEY `fk_raffle_winner` (`winner_user_id`);

--
-- Indexes for table `raffle_entries`
--
ALTER TABLE `raffle_entries`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_raffle_user` (`raffle_id`,`user_id`),
  ADD KEY `idx_raffle_entries_user` (`user_id`);

--
-- Indexes for table `trades`
--
ALTER TABLE `trades`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_trade_initiator` (`initiator_id`,`status`),
  ADD KEY `idx_trade_receiver` (`receiver_id`,`status`);

--
-- Indexes for table `trade_items`
--
ALTER TABLE `trade_items`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_trade_user_card` (`trade_id`,`user_id`,`card_id`),
  ADD KEY `idx_trade_items_trade` (`trade_id`),
  ADD KEY `fk_trade_items_user` (`user_id`);

--
-- Indexes for table `upgrader_plays`
--
ALTER TABLE `upgrader_plays`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_time` (`user_id`,`created_at`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `username` (`username`);

--
-- Indexes for table `user_cards`
--
ALTER TABLE `user_cards`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `id` (`id`),
  ADD UNIQUE KEY `unique_user_card` (`user_id`,`card_id`);

--
-- Indexes for table `user_packs`
--
ALTER TABLE `user_packs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_packs_user_id` (`user_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `wheel_spins`
--
ALTER TABLE `wheel_spins`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_time` (`user_id`,`created_at`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `battle_crates`
--
ALTER TABLE `battle_crates`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `battle_crate_items`
--
ALTER TABLE `battle_crate_items`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=361;

--
-- AUTO_INCREMENT for table `crate_battle_rooms`
--
ALTER TABLE `crate_battle_rooms`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT for table `favorites`
--
ALTER TABLE `favorites`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=54;

--
-- AUTO_INCREMENT for table `marketplace`
--
ALTER TABLE `marketplace`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=124;

--
-- AUTO_INCREMENT for table `raffles`
--
ALTER TABLE `raffles`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT for table `raffle_entries`
--
ALTER TABLE `raffle_entries`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=81;

--
-- AUTO_INCREMENT for table `trades`
--
ALTER TABLE `trades`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `trade_items`
--
ALTER TABLE `trade_items`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- AUTO_INCREMENT for table `upgrader_plays`
--
ALTER TABLE `upgrader_plays`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=54;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=30;

--
-- AUTO_INCREMENT for table `user_cards`
--
ALTER TABLE `user_cards`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=564;

--
-- AUTO_INCREMENT for table `user_packs`
--
ALTER TABLE `user_packs`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=359;

--
-- AUTO_INCREMENT for table `wheel_spins`
--
ALTER TABLE `wheel_spins`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=60;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `battle_crate_items`
--
ALTER TABLE `battle_crate_items`
  ADD CONSTRAINT `battle_crate_items_ibfk_1` FOREIGN KEY (`crate_id`) REFERENCES `battle_crates` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `favorites`
--
ALTER TABLE `favorites`
  ADD CONSTRAINT `favorites_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `raffles`
--
ALTER TABLE `raffles`
  ADD CONSTRAINT `fk_raffle_winner` FOREIGN KEY (`winner_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `raffle_entries`
--
ALTER TABLE `raffle_entries`
  ADD CONSTRAINT `fk_entry_raffle` FOREIGN KEY (`raffle_id`) REFERENCES `raffles` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_entry_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `trades`
--
ALTER TABLE `trades`
  ADD CONSTRAINT `fk_trade_initiator` FOREIGN KEY (`initiator_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_trade_receiver` FOREIGN KEY (`receiver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `trade_items`
--
ALTER TABLE `trade_items`
  ADD CONSTRAINT `fk_trade_items_trade` FOREIGN KEY (`trade_id`) REFERENCES `trades` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_trade_items_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `user_packs`
--
ALTER TABLE `user_packs`
  ADD CONSTRAINT `fk_user_packs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
