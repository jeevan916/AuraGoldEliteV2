
<?php
// PHP Database Configuration for Hostinger
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit;
}

// These should be updated manually on Hostinger or handled via environment variables if supported
$db_host = 'localhost';
$db_user = 'u123456789_aura'; 
$db_pass = 'YourSecurePasswordHere';
$db_name = 'u123456789_auragold';

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    header('Content-Type: application/json', true, 500);
    echo json_encode(['error' => 'Database Connection Failed', 'details' => $e->getMessage()]);
    exit;
}
?>
