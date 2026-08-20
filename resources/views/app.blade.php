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
    <link rel="icon" href="{{ $systemLogo }}">
    <link rel="apple-touch-icon" href="{{ $systemLogo }}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app.tsx'])
</head>
<body>
    <div id="app"></div>
</body>
</html>
