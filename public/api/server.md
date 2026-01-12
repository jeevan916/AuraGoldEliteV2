<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Check if config exists
if (!file_exists('db_config.php')) {
    http_response_code(500);
    echo json_encode(['error' => 'db_config.php missing']);
    exit;
}

require_once 'db_config.php';

// 1. Auto-Create Table if it doesn't exist
try {
    $tableSql = "CREATE TABLE IF NOT EXISTS app_storage (
        id INT PRIMARY KEY DEFAULT 1,
        data LONGTEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )";
    $pdo->exec($tableSql);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Table creation failed: ' . $e->getMessage()]);
    exit;
}

// 2. Handle Requests
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    try {
        $stmt = $pdo->prepare("SELECT data FROM app_storage WHERE id = 1");
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($row && $row['data']) {
            echo $row['data'];
        } else {
            // Return empty structure if no data yet
            echo json_encode(["orders" => [], "logs" => [], "templates" => [], "lastUpdated" => 0]);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Fetch failed: ' . $e->getMessage()]);
    }
} 
elseif ($method === 'POST') {
    $input = file_get_contents('php://input');
    if (!$input) {
        echo json_encode(['error' => 'No data received']);
        exit;
    }
    
    try {
        $stmt = $pdo->prepare("INSERT INTO app_storage (id, data) VALUES (1, ?) ON DUPLICATE KEY UPDATE data = ?");
        $result = $stmt->execute([$input, $input]);
        
        if ($result) {
            echo json_encode(['success' => true]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to save data']);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Save failed: ' . $e->getMessage()]);
    }
}
?>