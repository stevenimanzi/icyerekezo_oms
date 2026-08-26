<?php

/**
 * Laravel Entry Point (from project root)
 * 
 * This file allows you to serve the Laravel application from the root 
 * directory without needing to point your web server directly to the 
 * /public folder (commonly used for shared hosting environments).
 */

$uri = urldecode(
    parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH)
);

// Serve static files from the /public directory directly
if ($uri !== '/' && file_exists(__DIR__.'/public'.$uri)) {
    return false;
}

// Otherwise, load the standard Laravel application entry point
require_once __DIR__.'/public/index.php';
