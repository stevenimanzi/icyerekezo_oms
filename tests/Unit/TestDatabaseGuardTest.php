<?php

namespace Tests\Unit;

use Tests\TestCase;

class TestDatabaseGuardTest extends TestCase
{
    public function test_tests_run_on_in_memory_sqlite_never_the_real_database(): void
    {
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
    }
}
