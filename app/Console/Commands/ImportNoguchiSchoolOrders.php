<?php

namespace App\Console\Commands;

use App\Models\Factory;
use App\Models\SalesDocument;
use App\Models\School;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ImportNoguchiSchoolOrders extends Command
{
    protected $signature = 'noguchi:import-school-orders {file : Path to the legacy SQL export}';
    protected $description = 'Import NOGUCHI legacy school garment orders with pending status';

    public function handle(): int
    {
        $path = (string) $this->argument('file');
        if (! is_file($path) || ! is_readable($path)) {
            $this->error("Cannot read SQL export: {$path}");
            return self::FAILURE;
        }

        $factory = Factory::whereRaw('LOWER(TRIM(name)) = ?', ['noguchi holdings ltd'])
            ->where('industry_type', 'clothing_textiles')->first();
        if (! $factory) {
            $this->error('Active NOGUCHI HOLDINGS Ltd clothing factory was not found.');
            return self::FAILURE;
        }

        [$orders, $items, $schools] = $this->parse($path);
        $orders = collect($orders)->where('factory_id', 1)->keyBy('id');
        $items = collect($items)->where('factory_id', 1)->groupBy('order_id');
        $schools = collect($schools)->where('factory_id', 1)->keyBy('id');
        $importedOrders = 0;
        $importedLines = 0;

        DB::transaction(function () use ($factory, $orders, $items, $schools, &$importedOrders, &$importedLines) {
            foreach ($orders as $legacyId => $legacy) {
                $school = $schools->get($legacy['school_id']);
                $lines = $items->get($legacyId, collect());
                if ($lines->isEmpty()) continue;
                $schoolRecord = School::withoutGlobalScopes()->updateOrCreate(
                    ['factory_id' => $factory->id, 'legacy_id' => $legacy['school_id']],
                    ['name' => $school['school_name'] ?? 'Legacy school '.$legacy['school_id'], 'district' => $school['district'] ?? null, 'sector' => $school['sector'] ?? null, 'contact_name' => $school['contact_name'] ?? null, 'phone' => $school['phone'] ?? null],
                );

                $document = SalesDocument::withoutGlobalScopes()->updateOrCreate(
                    ['factory_id' => $factory->id, 'document_type' => 'customer_order', 'document_number' => 'LEGACY-NOGUCHI-'.str_pad((string) $legacyId, 4, '0', STR_PAD_LEFT)],
                    [
                        'school_id' => $schoolRecord->id,
                        'customer_name' => $schoolRecord->name,
                        'academic_year' => $legacy['academic_year'] ?: substr($legacy['order_date'], 0, 4),
                        'status' => 'pending',
                        'currency_code' => 'RWF',
                        'total_amount' => $legacy['total_amount'],
                        'paid_amount' => 0,
                        'item_count' => $lines->sum('quantity_ordered'),
                        'document_date' => substr($legacy['order_date'], 0, 10),
                        'due_date' => null,
                    ],
                );
                $document->lines()->delete();
                $document->lines()->createMany($lines->map(fn (array $line) => [
                    'factory_id' => $factory->id,
                    'class_level' => $line['class_level'],
                    'garment_category' => $line['category'] ?: 'Uniform',
                    'gender' => $line['gender'] ?: null,
                    'size' => $line['size'] ?: null,
                    'color' => $line['color'] ?: null,
                    'quantity_ordered' => $line['quantity_ordered'],
                    'quantity_packed' => $line['quantity_packed'],
                    'quantity_delivered' => $line['quantity_delivered'],
                    'quantity_rejected' => $line['quantity_rejected'],
                    'rejection_reason' => $line['rejection_reason'] ?: null,
                ])->all());
                $importedOrders++;
                $importedLines += $lines->count();
            }
        });

        $this->info("Imported {$importedOrders} pending school orders with {$importedLines} garment lines into {$factory->name}.");
        return self::SUCCESS;
    }

    private function parse(string $path): array
    {
        $orders = $items = $schools = [];
        $section = null;
        $handle = fopen($path, 'rb');
        if (! $handle) throw new RuntimeException("Unable to open {$path}");

        while (($line = fgets($handle)) !== false) {
            $line = trim($line);
            if (str_starts_with($line, 'INSERT INTO `orders`')) { $section = 'orders'; continue; }
            if (str_starts_with($line, 'INSERT INTO `order_items`')) { $section = 'items'; continue; }
            if (str_starts_with($line, 'INSERT INTO `schools`')) { $section = 'schools'; continue; }
            if (! str_starts_with($line, '(')) continue;
            $values = str_getcsv(substr(rtrim($line, ',;'), 1, -1), ',', "'", '\\');
            $values = array_map(fn ($value) => trim((string) $value), $values);

            if ($section === 'orders' && count($values) >= 8) {
                $orders[] = ['id' => (int) $values[0], 'school_id' => (int) $values[1], 'order_date' => $values[2], 'total_amount' => (float) $values[4], 'factory_id' => (int) $values[6], 'academic_year' => $this->nullable($values[7])];
            } elseif ($section === 'items' && count($values) >= 14) {
                $items[] = ['order_id' => (int) $values[1], 'class_level' => $values[2], 'category' => $values[3], 'gender' => $values[4], 'size' => $values[5], 'color' => $this->nullable($values[6]), 'quantity_ordered' => (int) $values[7], 'quantity_packed' => (int) $values[8], 'quantity_delivered' => (int) $values[9], 'quantity_rejected' => (int) $values[10], 'rejection_reason' => $this->nullable($values[11]), 'factory_id' => (int) $values[12]];
            } elseif ($section === 'schools' && count($values) >= 10) {
                $schools[] = ['id' => (int) $values[0], 'school_name' => $values[2], 'district' => $this->nullable($values[3]), 'sector' => $this->nullable($values[4]), 'contact_name' => $this->nullable($values[5]), 'phone' => $this->nullable($values[6]), 'factory_id' => (int) $values[7]];
            }
        }
        fclose($handle);

        return [$orders, $items, $schools];
    }

    private function nullable(string $value): ?string
    {
        return strtoupper($value) === 'NULL' ? null : $value;
    }
}
