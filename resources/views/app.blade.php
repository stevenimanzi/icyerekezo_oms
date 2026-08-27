<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta name="theme-color" content="#2563eb">
    @php($systemName = \App\Models\SystemSetting::valueFor('system_name', 'ICYEREKEZO OMS'))
    @php($systemLogo = \App\Models\SystemSetting::valueFor('logo_url', '/assets/images/icyerekezo_oms_logo.svg'))
    <title>{{ $systemName }}</title>
    
    <!-- SEO Meta Tags -->
    <meta name="description" content="ICYEREKEZO OMS is the leading Factory Management System in Rwanda. Streamline order management, garment manufacturing, production tracking, and logistics with our comprehensive ERP solution.">
    <meta name="keywords" content="factory management system in rwanda, order management system, garment manufacturing software, production tracking software, school uniform manufacturing, ERP for factories, logistics software rwanda, textile factory management, Icyerekezo OMS, factory software rwanda">
    <meta name="author" content="Steven IMANZI">
    
    <!-- Open Graph / Social Media -->
    <meta property="og:type" content="website">
    <meta property="og:title" content="{{ $systemName }} - Factory Management System in Rwanda">
    <meta property="og:description" content="Streamline your factory operations, orders, and manufacturing processes with the best factory management system in Rwanda.">
    <meta property="og:image" content="{{ $systemLogo }}">
    <meta property="og:site_name" content="{{ $systemName }}">
    
    <link rel="icon" href="{{ $systemLogo }}">
    <link rel="apple-touch-icon" href="/assets/images/pwa/apple-touch-icon.png">
    <link rel="manifest" href="/manifest.json">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <meta name="apple-mobile-web-app-title" content="{{ $systemName }}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app.tsx'])
</head>
<body>
    <div id="app"></div>
    <script>
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
        }
    </script>
</body>
</html>
