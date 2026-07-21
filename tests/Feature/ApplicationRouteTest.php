<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApplicationRouteTest extends TestCase
{
    use RefreshDatabase;

    public function test_role_aware_spa_urls_can_be_opened_directly(): void
    {
        $this->get('/admin/users')->assertOk()->assertSee('id="app"', false);
        $this->get('/cutting/reports')->assertOk()->assertSee('id="app"', false);
        $this->get('/warehouse/inventory')->assertOk()->assertSee('id="app"', false);
    }
}
