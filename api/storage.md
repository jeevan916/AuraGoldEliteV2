
<?php
require_once 'db_config.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    try {
        $stmt = $pdo->query("SELECT content FROM app_state WHERE id = 1");
        $row = $stmt->fetch();
        
        header('Content-Type: application/json');
        if ($row) {
            echo $row['content'];
        } else {
            echo json_encode(['orders' => [], 'lastUpdated' => 0]);
        }
    } catch (Exception $e) {
        header('Content-Type: application/json', true, 500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}

if ($method === 'POST') {
    try {
        $json = file_get_contents('php://input');
        $data = json_decode($json, true);
        
        if (!$data) {
            throw new Exception('Invalid JSON data');
        }

        // Upsert logic for a single row state storage
        $stmt = $pdo->prepare("INSERT INTO app_state (id, content, last_updated) 
                               VALUES (1, :content, :last_updated) 
                               ON DUPLICATE KEY UPDATE 
                               content = VALUES(content), 
                               last_updated = VALUES(last_updated)");
        
        $stmt->execute([
            ':content' => $json,
            ':last_updated' => round(microtime(true) * 1000)
        ]);

        header('Content-Type: application/json');
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        header('Content-Type: application/json', true, 500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}
?>
