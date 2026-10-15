<?php

namespace Tests\Feature;

use App\Models\Factory;
use App\Models\Role;
use App\Models\User;
use App\Support\Catalogs\PermissionCatalog;
use App\Support\Catalogs\RoleTemplateCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Route;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Tests\TestCase;

class RouteCoverageTest extends TestCase
{
    use RefreshDatabase;

    private const PUBLIC_API_ROUTES = [
        'api/files',
        'api/auth/register',
        'api/auth/register-school',
        'api/auth/login',
        'api/auth/reset-password',
        'api/auth/verify-otp',
        'api/auth/forgot-password',
        'api/auth/resend-otp',
        'api/auth/school-registration-options',
    ];

    private function apiRoutes(): Collection
    {
        return collect(app('router')->getRoutes()->getRoutes())->filter(fn (Route $route) => str_starts_with($route->uri(), 'api/'));
    }

    private function concreteUri(Route $route): string
    {
        return preg_replace('/\{[^}]+\}/', '1', $route->uri());
    }

    private function methodOf(Route $route): string
    {
        return collect($route->methods())->first(fn (string $method) => $method !== 'HEAD');
    }

    public function test_every_route_handler_exists(): void
    {
        foreach (app('router')->getRoutes() as $route) {
            if ($route->getActionName() === 'Closure') {
                continue;
            }

            [$class, $method] = array_pad(explode('@', $route->getActionName()), 2, '__invoke');

            $this->assertTrue(class_exists($class), "Missing controller for {$route->uri()}");
            $this->assertTrue(method_exists($class, $method), "Missing method {$class}@{$method} for {$route->uri()}");
        }
    }

    public function test_every_protected_api_route_turns_visitors_away(): void
    {
        $checked = 0;

        foreach ($this->apiRoutes() as $route) {
            if (in_array($route->uri(), self::PUBLIC_API_ROUTES, true)) {
                continue;
            }

            $response = $this->json($this->methodOf($route), $this->concreteUri($route));

            $this->assertSame(401, $response->getStatusCode(), "{$this->methodOf($route)} {$route->uri()} did not return 401 for a visitor");
            $checked++;
        }

        $this->assertGreaterThan(100, $checked);
    }

    public function test_every_parameter_free_page_data_route_works_for_a_factory_administrator(): void
    {
        PermissionCatalog::seed();

        $factory = Factory::create([
            'uuid' => (string) Str::uuid(), 'name' => 'Coverage Works', 'slug' => 'coverage-works',
            'industry_type' => 'clothing', 'status' => 'active',
        ]);
        RoleTemplateCatalog::createFor($factory);

        $user = User::factory()->create(['current_factory_id' => $factory->id]);
        $user->factories()->attach($factory->id, ['is_owner' => true, 'is_active' => true]);
        $user->roles()->attach(Role::where(['factory_id' => $factory->id, 'slug' => 'factory-administrator'])->value('id'), ['factory_id' => $factory->id]);

        $failures = [];
        $checked = 0;

        foreach ($this->apiRoutes() as $route) {
            $isPageData = $this->methodOf($route) === 'GET' && ! str_contains($route->uri(), '{');
            $isPlatform = str_starts_with($route->uri(), 'api/platform/');

            if (! $isPageData || $isPlatform || in_array($route->uri(), self::PUBLIC_API_ROUTES, true)) {
                continue;
            }

            $status = $this->actingAs($user)->getJson($route->uri())->getStatusCode();
            $checked++;

            if ($status >= 500) {
                $failures[] = "GET {$route->uri()} returned {$status}";
            }
        }

        $this->assertSame([], $failures);
        $this->assertGreaterThan(30, $checked);
    }

    public function test_every_platform_page_data_route_works_for_a_platform_administrator(): void
    {
        $admin = User::factory()->create(['is_platform_admin' => true]);
        $failures = [];
        $checked = 0;

        foreach ($this->apiRoutes() as $route) {
            if ($this->methodOf($route) !== 'GET' || ! str_starts_with($route->uri(), 'api/platform/') || str_contains($route->uri(), '{')) {
                continue;
            }

            $status = $this->actingAs($admin)->getJson($route->uri())->getStatusCode();
            $checked++;

            if ($status >= 500) {
                $failures[] = "GET {$route->uri()} returned {$status}";
            }
        }

        $this->assertSame([], $failures);
        $this->assertGreaterThan(5, $checked);
    }

    public function test_platform_routes_are_closed_to_factory_members(): void
    {
        $factory = Factory::create([
            'uuid' => (string) Str::uuid(), 'name' => 'Member Works', 'slug' => 'member-works',
            'industry_type' => 'clothing', 'status' => 'active',
        ]);
        $member = User::factory()->create(['current_factory_id' => $factory->id]);

        foreach (['overview', 'factories', 'users', 'subscriptions', 'backups', 'audit-logs', 'settings'] as $path) {
            $this->actingAs($member)->getJson("/api/platform/{$path}")->assertForbidden();
        }
    }
}
