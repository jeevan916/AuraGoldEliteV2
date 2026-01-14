<?php
require_once 'db_config.php';

header('Content-Type: application/json');

try {
    $stmt = $pdo->query("SELECT VERSION() as version");
    $row = $stmt->fetch();
    echo json_encode([
        'success' => true,
        'message' => 'Database connection successful',
        'db_version' => $row['version'],
        'host' => getenv('DB_HOST')
    ]);
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>