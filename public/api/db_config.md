<?php
// DATABASE CONFIGURATION
// HOSTINGER MYSQL CREDENTIALS

$db_host = 'localhost';
$db_name = 'u477692720_AuraGoldElite';
$db_user = 'u477692720_jeevan1';
$db_pass = 'YOUR_DB_PASSWORD'; // <--- IMPORTANT: Update this with your actual Hostinger DB password

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8", $db_user, $db_pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    // Ensure we always return JSON, even on connection failure
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(["error" => "Database Connection Failed: " . $e->getMessage()]);
    exit;
}
?>