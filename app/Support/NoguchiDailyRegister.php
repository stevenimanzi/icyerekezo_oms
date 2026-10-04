<?php

namespace App\Support;

use Carbon\Carbon;

/**
 * The Noguchi daily register (warehouse, cutting, production, finishing, stock) built from the report data.
 * This mirrors the on-screen sheet (resources/js/pages/shared/NoguchiDailySheet.tsx) so the Excel export
 * shows exactly what the page shows.
 */
final class NoguchiDailyRegister
{
    /** Entry groups: cell kinds, widths in px and the columns that merge vertically when equal. */
    public const GROUPS = [
        0 => ['kinds' => ['center', 'cnum'], 'widths' => [80, 64], 'merge' => []],
        1 => ['kinds' => ['cnum', 'cnum'], 'widths' => [136, 62], 'merge' => []],
        2 => ['kinds' => ['center', 'cnum'], 'widths' => [73, 59], 'merge' => []],
        3 => ['kinds' => ['cnum', 'cnum'], 'widths' => [82, 55], 'merge' => []],
        4 => ['kinds' => ['center', 'center', 'center', 'size', 'num'], 'widths' => [80, 67, 64, 46, 53], 'merge' => [0, 2]],
        5 => ['kinds' => ['center', 'center', 'size', 'num'], 'widths' => [77, 60, 54, 50], 'merge' => [0, 1]],
        6 => ['kinds' => ['center', 'center', 'size', 'num'], 'widths' => [85, 60, 54, 56], 'merge' => [0, 1]],
        7 => ['kinds' => ['center', 'center', 'size', 'num'], 'widths' => [76, 60, 46, 64], 'merge' => [0, 1]],
        8 => ['kinds' => ['center', 'center', 'size', 'num'], 'widths' => [59, 60, 46, 47], 'merge' => [0, 1]],
        9 => ['kinds' => ['center', 'center', 'size', 'num'], 'widths' => [80, 60, 48, 47], 'merge' => [0, 1]],
    ];

    /** Sections in sheet order. row5/row6 heads are [label, colSpan, rowSpan]; row7 labels fill the columns left open by row 6. */
    public const SECTIONS = [
        'wh' => ['title' => 'WAREHOUSE', 'fill' => '2E75B5', 'dark' => false, 'groups' => [0, 1, 2, 3],
            'row5' => [['INPUT', 4, 1], ['OUTPUT', 4, 1]],
            'row6' => [['FABRIC', 2, 1], ['ACCESSORIES', 2, 1], ['FABRIC', 2, 1], ['ACCESSORIES', 2, 1]],
            'row7' => ['COLOR', 'METER', 'COLOR', 'QTY', 'COLOR', 'METER', 'COLOR', 'QTY']],
        'cut' => ['title' => 'CUTTING', 'fill' => '92D050', 'dark' => true, 'groups' => [4],
            'row5' => [['INPUT', 2, 1], ['OUTPUT', 3, 1]],
            'row6' => [['FABRIC', 2, 1], ['STYLE', 1, 2], ['SIZE', 1, 2], ['QTY', 1, 2]],
            'row7' => ['COLOR', 'METERS']],
        'prod' => ['title' => 'PRODUCTION', 'fill' => 'C55A11', 'dark' => false, 'groups' => [5, 6],
            'row5' => [['INPUT', 4, 1], ['OUTPUT', 4, 1]],
            'row6' => [['STYLE', 2, 1], ['SIZE', 1, 2], ['QTY', 1, 2], ['STYLE', 2, 1], ['SIZE', 1, 2], ['QTY', 1, 2]],
            'row7' => ['COLOR', 'STYLE', 'COLOR', 'STYLE']],
        'fin' => ['title' => 'FINISHING', 'fill' => '8F3EC4', 'dark' => false, 'groups' => [7, 8],
            'row5' => [['INPUT', 4, 1], ['OUTPUT', 4, 1]],
            'row6' => [['STYLE', 2, 1], ['SIZE', 1, 2], ['QTY', 1, 2], ['STYLE', 2, 1], ['SIZE', 1, 2], ['QTY', 1, 2]],
            'row7' => ['COLOR', 'STYLE', 'COLOR', 'STYLE']],
        'stock' => ['title' => 'WAREHOUSE', 'fill' => '0070C0', 'dark' => false, 'groups' => [9],
            'row5' => [['QTY IN STOCK', 4, 1]],
            'row6' => [['STYLE', 2, 1], ['SIZE', 1, 2], ['QTY', 1, 2]],
            'row7' => ['COLOR', 'STYLE']],
    ];

    private const DEPARTMENT_TAG = '/^\s*\[(cut|cutting|sewing|finishing|packing)/i';
    private const DEPARTMENT_WAREHOUSE = '/cutting|sewing|finishing|packing/i';
    private const CUT_OUTPUT = '/(\d[\d,.]*)\s*x\s*(.+?)(?:\s*\/\s*(.+?))?\s*\(([^)]+)\)\s*produced/i';

    /** Which register sections belong to the chosen department (all of them when none is chosen). */
    public static function sectionsFor(?string $department): array
    {
        $value = strtolower(trim((string) $department));
        if ($value === '') return array_keys(self::SECTIONS);
        if (preg_match('/raw|warehouse|store/', $value)) return ['wh', 'stock'];
        if (preg_match('/cut/', $value)) return ['cut'];
        if (preg_match('/sew|produc/', $value)) return ['prod'];
        if (preg_match('/finish|packag|packing/', $value)) return ['fin'];

        return [];
    }

    /** One entry per date, each with the ten entry groups (lists of raw cell values). */
    public static function days(array $data, string $department = ''): array
    {
        $timezone = $data['factory']['timezone'] ?? config('app.timezone');
        $local = fn ($value) => Carbon::parse($value)->setTimezone($timezone)->toDateString();

        $inventory = self::withoutReversals($data['inventory'] ?? []);
        $production = $data['production'] ?? [];
        $stock = $data['stock_register'] ?? [];

        $warehouse = array_values(array_filter($inventory, fn ($row) => ($department === '' || empty($row['performer_department']) || $row['performer_department'] === $department)
            && (float) $row['quantity_delta'] !== 0.0
            && ($row['type'] ?? '') !== 'production_output'
            && ! preg_match(self::DEPARTMENT_TAG, (string) ($row['reason'] ?? ''))
            && ! preg_match(self::DEPARTMENT_WAREHOUSE, (string) ($row['warehouse_name'] ?? ''))));
        $cuttingLedger = array_values(array_filter($inventory, fn ($row) => preg_match('/\[cut output\]/i', (string) ($row['reason'] ?? ''))
            && ($row['type'] ?? '') === 'issue' && (float) $row['quantity_delta'] < 0));

        $dates = array_values(array_unique(array_merge(
            array_map(fn ($row) => $local($row['occurred_at']), $warehouse),
            array_map(fn ($row) => $local($row['occurred_at']), $cuttingLedger),
            array_map(fn ($row) => $local($row['updated_at']), $production),
        )));
        sort($dates);
        if (! $dates) return [];
        $lastDay = end($dates);

        $closingStock = [];
        foreach ($stock as $row) {
            if ((float) $row['closing_balance'] <= 0 || preg_match(self::DEPARTMENT_WAREHOUSE, (string) ($row['warehouse'] ?? ''))) continue;
            $closingStock[] = self::isAccessory($row['item'])
                ? ['', self::accessoryName($row['item']), '', (float) $row['closing_balance']]
                : [self::colorOf($row['item']), '', '', (float) $row['closing_balance']];
        }

        $days = [];
        foreach ($dates as $date) {
            $dayInventory = array_filter($warehouse, fn ($row) => $local($row['occurred_at']) === $date);
            $dayProduction = array_filter($production, fn ($row) => $local($row['updated_at']) === $date);
            $movement = fn (string $direction, bool $accessory) => array_values(array_map(
                fn ($row) => [$accessory ? self::accessoryName($row['item_name']) : self::colorOf($row['item_name']), abs((float) $row['quantity_delta'])],
                array_filter($dayInventory, fn ($row) => ($direction === 'in' ? (float) $row['quantity_delta'] > 0 : (float) $row['quantity_delta'] < 0)
                    && self::isAccessory($row['item_name']) === $accessory),
            ));

            $cutting = [];
            foreach ($cuttingLedger as $row) {
                if ($local($row['occurred_at']) !== $date) continue;
                $meters = abs((float) $row['quantity_delta']);
                if (preg_match(self::CUT_OUTPUT, (string) $row['reason'], $m)) {
                    $cutting[] = [trim($m[3] !== '' ? $m[3] : self::colorOf($row['item_name'])), $meters, trim($m[2]), trim($m[4]), (float) str_replace(',', '', $m[1])];
                } else {
                    $cutting[] = [self::colorOf($row['item_name']), $meters, '', '', ''];
                }
            }
            foreach ($dayProduction as $row) {
                if (self::stageArea((string) $row['stage_name']) !== 'cutting') continue;
                $p = self::parseProduct($row['product_name'] ?? '', self::colorOf($row['fabric_name'] ?? ''));
                $cutting[] = [$p['color'], (float) $row['input_quantity'], $p['style'], $p['size'], (float) $row['output_quantity']];
            }

            $stage = function (string $area, string $field) use ($dayProduction) {
                $rows = [];
                foreach ($dayProduction as $row) {
                    if (self::stageArea((string) $row['stage_name']) !== $area || (float) $row[$field] <= 0) continue;
                    $p = self::parseProduct($row['product_name'] ?? '', self::colorOf($row['fabric_name'] ?? ''));
                    $rows[] = [$p['color'], $p['style'], $p['size'], (float) $row[$field]];
                }

                return $rows;
            };

            $days[] = ['date' => $date, 'groups' => [
                $movement('in', false), $movement('in', true), $movement('out', false), $movement('out', true),
                self::arrange($cutting, 0, 2, 3),
                self::arrange($stage('production', 'input_quantity'), 0, 1, 2), self::arrange($stage('production', 'output_quantity'), 0, 1, 2),
                self::arrange($stage('finishing', 'input_quantity'), 0, 1, 2), self::arrange($stage('finishing', 'output_quantity'), 0, 1, 2),
                $date === $lastDay ? self::arrange($closingStock, 0, 1, 2) : [],
            ]];
        }

        return $days;
    }

    /**
     * For one group over $height rows: per column and line, the number of rows a merged block starting there covers
     * (0 = covered by the block above). Equal consecutive colours/styles merge and the last block stretches to the bottom.
     */
    public static function spans(array $rows, int $columns, array $mergeColumns, int $height): array
    {
        $result = array_fill(0, $columns, array_fill(0, $height, 0));
        for ($column = 0; $column < $columns; $column++) {
            if (! $rows) {
                $result[$column][0] = $height;
                continue;
            }
            $start = 0;
            $count = count($rows);
            for ($line = 1; $line <= $count; $line++) {
                $same = $line < $count && in_array($column, $mergeColumns, true);
                if ($same) {
                    foreach (array_filter($mergeColumns, fn ($m) => $m <= $column) as $m) {
                        if (($rows[$line][$m] ?? null) !== ($rows[$line - 1][$m] ?? null)) { $same = false; break; }
                    }
                }
                if (! $same) {
                    $result[$column][$start] = $line - $start;
                    $start = $line;
                }
            }
            if ($height > $count) {
                $lastStart = 0;
                foreach ($result[$column] as $i => $n) {
                    if ($n > 0 && $i < $count) $lastStart = $i;
                }
                $result[$column][$lastStart] += $height - $count;
            }
        }

        return $result;
    }

    private static function withoutReversals(array $rows): array
    {
        $cancelled = [];
        foreach ($rows as $row) {
            if (! empty($row['reverses_transaction_id'])) $cancelled[(int) $row['reverses_transaction_id']] = true;
            if (preg_match('/^REVERSAL of transaction\s+(\d+)/i', (string) ($row['reason'] ?? ''), $m)) $cancelled[(int) $m[1]] = true;
        }

        return array_values(array_filter($rows, fn ($row) => ! isset($cancelled[(int) $row['id']])
            && empty($row['reverses_transaction_id']) && ! preg_match('/^REVERSAL of transaction/i', (string) ($row['reason'] ?? ''))));
    }

    private static function clean(string $part): string
    {
        return preg_replace('/^[-–—|\/\s]+|[-–—|\/\s]+$/u', '', $part) ?? $part;
    }

    /** "Short - - M" -> style Short, size M; "Skirt - Navy Blue - XS" -> all three. */
    private static function parseProduct(string $name, string $fallbackColor = ''): array
    {
        $parts = array_values(array_filter(array_map([self::class, 'clean'], preg_split('/\s+[-–—|\/]\s+/u', $name) ?: []), fn ($p) => $p !== ''));
        $color = $size = '';
        if (count($parts) === 2) {
            if (mb_strlen($parts[1]) <= 4 || is_numeric($parts[1])) $size = $parts[1]; else $color = $parts[1];
        } elseif (count($parts) >= 3) {
            $color = $parts[1];
            $size = $parts[2];
        }

        return ['style' => $parts[0] ?? '', 'color' => $color !== '' ? $color : $fallbackColor, 'size' => $size];
    }

    private static function isAccessory(?string $name): bool
    {
        return (bool) preg_match('/thread|zip|button|elastic|label|accessor|sharpener/i', (string) $name);
    }

    private static function accessoryName(?string $name): string
    {
        return trim(preg_replace('/\s+[-–—]\s+/u', ' ', (string) $name) ?? '');
    }

    private static function colorOf(?string $name): string
    {
        $parsed = self::parseProduct((string) $name);

        return $parsed['color'] !== '' ? $parsed['color'] : (string) $name;
    }

    private static function stageArea(string $name): string
    {
        $value = strtolower($name);
        if (str_contains($value, 'cut')) return 'cutting';
        foreach (['finish', 'iron', 'press', 'quality', 'pack'] as $word) {
            if (str_contains($value, $word)) return 'finishing';
        }

        return 'production';
    }

    private static function sizeRank(string $value): int
    {
        $known = array_search(strtoupper($value), ['4XS', '3XS', '2XS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'], true);

        return $known === false ? 99 : $known;
    }

    private static function arrange(array $rows, int $color, int $style, int $size): array
    {
        usort($rows, fn ($x, $y) => strcasecmp((string) $x[$color], (string) $y[$color])
            ?: strcasecmp((string) $x[$style], (string) $y[$style])
            ?: self::sizeRank((string) $x[$size]) <=> self::sizeRank((string) $y[$size]));

        return $rows;
    }
}
