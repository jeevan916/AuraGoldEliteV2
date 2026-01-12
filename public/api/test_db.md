<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

error_reporting(E_ALL);
ini_set('display_errors', 1);

$response = [
    "status" => "pending",
    "steps" => []
];

// Step 1: Check Config File
if (!file_exists('db_config.php')) {
    $response["status"] = "failed";
    $response["error"] = "db_config.php file is missing. Please rename db_config.md to db_config.php and update the password.";
    echo json_encode($response);
    exit;
}

$response["steps"]["config_file"] = "Found";

// Step 2: Connection
try {
    require_once 'db_config.php';
    if (!isset($pdo)) {
        throw new Exception("\$pdo variable not defined in db_config.php");
    }
    $response["steps"]["connection"] = "Success";
} catch (Exception $e) {
    $response["status"] = "failed";
    $response["error"] = "Connection Error: " . $e->getMessage();
    echo json_encode($response);
    exit;
}

// Step 3: Check Table
try {
    $stmt = $pdo->query("SHOW TABLES LIKE 'app_storage'");
    if ($stmt->rowCount() > 0) {
        $response["steps"]["table_check"] = "Table 'app_storage' exists";
        $response["status"] = "success";
        $response["message"] = "Database is connected and ready.";
    } else {
        $response["steps"]["table_check"] = "Table 'app_storage' NOT found";
        $response["status"] = "warning";
        $response["message"] = "Connected, but table missing. It will be created automatically when you load the app.";
    }
} catch (Exception $e) {
    $response["steps"]["table_check"] = "Error checking table: " . $e->getMessage();
}

echo json_encode($response);
?>