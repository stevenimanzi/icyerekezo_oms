<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use RuntimeException;

abstract class TestCase extends BaseTestCase
{
    /**
     * The project .env points at a real MySQL database. RefreshDatabase wipes whatever
     * connection is configured, so refuse to boot unless it is in-memory SQLite. This runs
     * when the application is created, which is before any trait refreshes the database.
     */
    public function createApplication()
    {
        $app = parent::createApplication();

        $connection = $app['config']->get('database.default');
        $database = $app['config']->get("database.connections.{$connection}.database");

        if ($connection !== 'sqlite' || $database !== ':memory:') {
            throw new RuntimeException("Refusing to run tests against [{$connection}:{$database}]. Tests must use in-memory SQLite (see phpunit.xml).");
        }

        return $app;
    }
}
