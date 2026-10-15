<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RoutesSmokeTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_manifest_is_served_as_json(): void
    {
        $this->get('/manifest.json')
            ->assertOk()
            ->assertHeader('Content-Type', 'application/manifest+json')
            ->assertJsonStructure(['name', 'short_name', 'start_url', 'icons']);
    }

    public function test_every_domain_route_file_is_loaded_and_protected_from_visitors(): void
    {
        $protected = [
            '/api/auth/me',
            '/api/platform/overview',
            '/api/executive/dashboard',
            '/api/executive/owner-overview',
            '/api/factory/settings',
            '/api/team/workspaces',
            '/api/hr/overview',
            '/api/safety/overview',
            '/api/inventory/overview',
            '/api/procurement/overview',
            '/api/manufacturing/overview',
            '/api/quality/overview',
            '/api/machines/overview',
            '/api/sales/overview',
            '/api/school/overview',
            '/api/logistics/overview',
            '/api/finance/overview',
            '/api/reports',
        ];

        foreach ($protected as $uri) {
            $this->getJson($uri)->assertUnauthorized();
        }
    }

    public function test_public_auth_routes_are_reachable_without_login(): void
    {
        $this->postJson('/api/auth/login', [])->assertUnprocessable();
    }

    public function test_an_unknown_page_opens_the_app_shell(): void
    {
        $this->withoutVite()->get('/some/page/in/the/app')->assertOk();
    }

    public function test_an_unknown_api_url_is_not_found_instead_of_opening_the_app_shell(): void
    {
        $this->getJson('/api/does-not-exist')->assertNotFound();
    }
}
