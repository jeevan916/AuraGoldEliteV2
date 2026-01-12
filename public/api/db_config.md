<?php
/**
 * DATABASE CONFIGURATION
 * Loads credentials from .env file for security and flexibility.
 */

/**
 * Custom .env loader for environments where putenv/getenv is preferred 
 * and external libraries like phpdotenv are not available.
 */
function loadEnv($dir) {
    // Search order: Current Dir -> Parent -> Grandparent -> Great-Grandparent
    // This ensures it finds the .env even if the api folder is nested (e.g., builds/api/)
    $searchPaths = [
        $dir . '/.env',
        dirname($dir) . '/.env',
        dirname(dirname($dir)) . '/.env',
        dirname(dirname(dirname($dir))) . '/.env'
    ];

    foreach ($searchPaths as $path) {
        if (file_exists($path)) {
            $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                // Skip comments
                if (strpos(trim($line), '#') === 0) continue;
                
                $parts = explode('=', $line, 2);
                if (count($parts) === 2) {
                    $name = trim($parts[0]);
                    $value = trim($parts[1]);
                    // Remove surrounding quotes if they exist
                    $value = trim($value, '"\''); 
                    
                    $_ENV[$name] = $value;
                    putenv("$name=$value");
                }
            }
            return true; // Successfully loaded
        }
    }
    return false; // No .env found
}

// Attempt to load .env relative to this file
$envLoaded = loadEnv(__DIR__);

// Retrieve values from environment
$db_host = getenv('DB_HOST') ?: 'localhost';
$db_name = getenv('DB_NAME') ?: 'u477692720_AuraGoldElite';
$db_user = getenv('DB_USER') ?: 'u477692720_jeevan1';
$db_pass = getenv('DB_PASS') ?: '';

// Error handling for missing configuration
if (!$envLoaded && empty(getenv('DB_PASS'))) {
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode([
        "error" => ".env file not found.",
        "hint" => "Ensure the .env file exists in your public_html or builds folder."
    ]);
    exit;
}

if ($db_pass === 'YOUR_DB_PASSWORD' || empty($db_pass)) {
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode([
        "error" => "Database password is not configured.",
        "hint" => "Open your .env file and replace 'YOUR_DB_PASSWORD' with your actual database password."
    ]);
    exit;
}

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8", $db_user, $db_pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode([
        "error" => "Database Connection Failed",
        "details" => $e->getMessage()
    ]);
    exit;
}
?>