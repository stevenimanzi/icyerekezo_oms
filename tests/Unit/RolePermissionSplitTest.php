<?php

namespace Tests\Unit;

use App\Support\Catalogs\PermissionCatalog;
use App\Support\Catalogs\RoleTemplateCatalog;
use Tests\TestCase;

class RolePermissionSplitTest extends TestCase
{
    public function test_packaging_can_pack_but_not_fulfil_or_deliver(): void
    {
        $patterns = RoleTemplateCatalog::TEMPLATES['packaging-operator'][2];

        $this->assertContains('sales.pack', $patterns);
        $this->assertNotContains('sales.fulfill', $patterns);
        $this->assertNotContains('logistics.*', $patterns);
    }

    public function test_logistics_delivers_but_cannot_pack_or_fulfil(): void
    {
        $patterns = RoleTemplateCatalog::TEMPLATES['logistics-officer'][2];

        $this->assertContains('logistics.*', $patterns);
        $this->assertNotContains('sales.fulfill', $patterns);
        $this->assertNotContains('sales.pack', $patterns);
    }

    public function test_every_template_permission_exists_in_the_catalog(): void
    {
        $known = collect(PermissionCatalog::MODULES)
            ->flatMap(fn (array $actions, string $module) => collect($actions)->map(fn ($action) => "$module.$action"))
            ->all();

        foreach (RoleTemplateCatalog::TEMPLATES as $slug => [, , $patterns]) {
            foreach ($patterns as $pattern) {
                if ($pattern === '*') {
                    continue;
                }
                $matches = str_contains($pattern, '*')
                    ? preg_grep('/^' . str_replace('\*', '.*', preg_quote($pattern, '/')) . '$/', $known)
                    : array_intersect([$pattern], $known);

                $this->assertNotEmpty(
                    $matches,
                    "Role [$slug] grants [$pattern], which matches no permission in PermissionCatalog.",
                );
            }
        }
    }
}
