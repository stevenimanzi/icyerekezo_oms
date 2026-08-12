<?php

namespace App\Support;

use ZipArchive;

class NoguchiDailyReportXlsxExporter
{
    public static function create(array $data, string $path): void
    {
        $inventory = $data['inventory'] ?? [];
        $production = $data['production'] ?? [];
        $stock = $data['stock_register'] ?? [];
        $dates = collect($inventory)->map(fn ($row) => substr((string) $row['occurred_at'], 0, 10))
            ->merge(collect($production)->map(fn ($row) => substr((string) $row['updated_at'], 0, 10)))->filter()->unique()->sort()->values();
        if ($dates->isEmpty()) $dates = collect([$data['report']['to']]);

        $rows = [];
        foreach ($dates as $index => $date) {
            $dayInventory = collect($inventory)->filter(fn ($row) => str_starts_with((string) $row['occurred_at'], $date));
            $dayProduction = collect($production)->filter(fn ($row) => str_starts_with((string) $row['updated_at'], $date));
            $inventoryGroup = fn (string $direction, string $kind) => $dayInventory->filter(fn ($row) => ($direction === 'in' ? (float) $row['quantity_delta'] > 0 : (float) $row['quantity_delta'] < 0) && self::itemKind($row['item_name']) === $kind);
            $stage = fn (string $area) => $dayProduction->filter(fn ($row) => self::stageArea($row['stage_name']) === $area);
            $closing = $index === $dates->count() - 1 ? collect($stock)->map(fn ($row) => ['id' => 'stock', 'item_name' => $row['item'], 'quantity_delta' => $row['closing_balance']]) : collect();
            $rows[] = [$date,
                ...self::fields($inventoryGroup('in', 'fabric'), ['color', 'quantity'], 'inventory'), ...self::fields($inventoryGroup('in', 'accessory'), ['color', 'quantity'], 'inventory'),
                ...self::fields($inventoryGroup('out', 'fabric'), ['color', 'quantity'], 'inventory'), ...self::fields($inventoryGroup('out', 'accessory'), ['color', 'quantity'], 'inventory'),
                ...self::fields($stage('cutting'), ['color', 'quantity']), ...self::fields($stage('cutting')),
                ...self::fields($stage('production')), ...self::fields($stage('production')),
                ...self::fields($stage('finishing')), ...self::fields($stage('finishing')),
                ...self::fields($closing, ['style', 'color', 'size', 'quantity'], 'inventory'),
            ];
        }

        $zip = new ZipArchive();
        if ($zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) throw new \RuntimeException('Unable to create the Noguchi daily Excel report.');
        $zip->addFromString('[Content_Types].xml', self::contentTypes());
        $zip->addFromString('_rels/.rels', self::rootRelationships());
        $zip->addFromString('xl/workbook.xml', self::workbook());
        $zip->addFromString('xl/_rels/workbook.xml.rels', self::workbookRelationships());
        $zip->addFromString('xl/styles.xml', self::styles());
        $zip->addFromString('xl/worksheets/sheet1.xml', self::sheet($data, $rows));
        $zip->close();
    }

    private static function fields($rows, array $fields = ['style', 'color', 'size', 'quantity'], string $mode = 'production'): array
    {
        return collect($fields)->map(function ($field) use ($rows, $mode) {
            if ($rows->isEmpty()) return '—';
            return $rows->map(function ($row) use ($field, $mode) {
                $parts = self::splitItem($row['item_name'] ?? $row['product_name'] ?? 'Unspecified');
                if ($field !== 'quantity') return $parts[$field];
                $value = $mode === 'inventory' ? $row['quantity_delta'] : ($row['output_quantity'] ?: $row['input_quantity']);
                return self::number(abs((float) $value));
            })->implode("\n");
        })->all();
    }

    private static function splitItem(string $name): array
    {
        $parts = preg_split('/\s[-–—|\/]\s/u', $name) ?: [];
        return ['style' => trim($parts[0] ?? $name), 'color' => trim($parts[1] ?? '—'), 'size' => trim($parts[2] ?? '—')];
    }

    private static function itemKind(string $name): string { return preg_match('/thread|zip|button|elastic|label|accessor/i', $name) ? 'accessory' : 'fabric'; }
    private static function number(float $value): string { return fmod($value, 1.0) === 0.0 ? number_format($value, 0, '.', ',') : rtrim(rtrim(number_format($value, 3, '.', ','), '0'), '.'); }
    private static function stageArea(string $name): string { $name = strtolower($name); if (str_contains($name, 'cut')) return 'cutting'; foreach (['finish', 'iron', 'press', 'quality', 'pack'] as $word) if (str_contains($name, $word)) return 'finishing'; return 'production'; }

    private static function sheet(array $data, array $dataRows): string
    {
        $rows = [
            self::row(1, [['NOGUCHI HOLDINGS LTD', 1]]),
            self::row(2, [['DAILY REPORT', 2]]),
            self::row(3, [["Period: {$data['report']['from']} to {$data['report']['to']}   |   Prepared by: {$data['report']['generated_by']}   |   Generated: {$data['report']['generated_at']}", 6]]),
            self::row(4, [['DATE', 3], ['WAREHOUSE', 3], ...array_fill(0, 7, ['', 3]), ['CUTTING', 3], ...array_fill(0, 5, ['', 3]), ['PRODUCTION', 3], ...array_fill(0, 7, ['', 3]), ['FINISHING', 3], ...array_fill(0, 7, ['', 3]), ['WAREHOUSE', 3], ...array_fill(0, 3, ['', 3])]),
            self::row(5, [['', 4], ['INPUT', 4], ...array_fill(0, 3, ['', 4]), ['OUTPUT', 4], ...array_fill(0, 3, ['', 4]), ['INPUT', 4], ['', 4], ['OUTPUT', 4], ...array_fill(0, 3, ['', 4]), ['INPUT', 4], ...array_fill(0, 3, ['', 4]), ['OUTPUT', 4], ...array_fill(0, 3, ['', 4]), ['INPUT', 4], ...array_fill(0, 3, ['', 4]), ['OUTPUT', 4], ...array_fill(0, 3, ['', 4]), ['QTY IN STOCK', 4], ...array_fill(0, 3, ['', 4])]),
            self::row(6, array_map(fn ($value) => [$value, 5], ['','COLOR','METERS','COLOR','QTY','COLOR','METERS','COLOR','QTY','COLOR','METERS','STYLE','COLOR','SIZE','QTY','STYLE','COLOR','SIZE','QTY','STYLE','COLOR','SIZE','QTY','STYLE','COLOR','SIZE','QTY','STYLE','COLOR','SIZE','QTY','STYLE','COLOR','SIZE','QTY'])),
        ];
        foreach ($dataRows as $index => $values) $rows[] = self::row($index + 7, array_map(fn ($value, $column) => [$value, $column === 0 ? 7 : 6], $values, array_keys($values)), 34);
        $lastRow = max(7, count($dataRows) + 6);
        $merges = ['A1:AI1','A2:AI2','A3:AI3','A4:A6','B4:I4','J4:O4','P4:W4','X4:AE4','AF4:AI4','B5:E5','F5:I5','J5:K5','L5:O5','P5:S5','T5:W5','X5:AA5','AB5:AE5','AF5:AI5'];
        $mergeXml = '<mergeCells count="'.count($merges).'">'.collect($merges)->map(fn ($ref) => '<mergeCell ref="'.$ref.'"/>')->implode('').'</mergeCells>';
        $cols = '<cols><col min="1" max="1" width="13" customWidth="1"/><col min="2" max="35" width="12" customWidth="1"/></cols>';
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:AI'.$lastRow.'"/><sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="6" topLeftCell="A7" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'.$cols.'<sheetData>'.implode('', $rows).'</sheetData>'.$mergeXml.'<printOptions horizontalCentered="1"/><pageMargins left="0.2" right="0.2" top="0.35" bottom="0.35" header="0.15" footer="0.15"/><pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter><center>NOGUCHI HOLDINGS LTD · DAILY REPORT</center><right>Page &amp;P of &amp;N</right></oddFooter></headerFooter></worksheet>';
    }

    private static function row(int $number, array $cells, int $lastColumn = 34): string
    {
        $xml = '<row r="'.$number.'"'.($number >= 7 ? ' ht="34" customHeight="1"' : '').'>';
        foreach ($cells as $index => [$value, $style]) { $ref = self::column($index + 1).$number; $xml .= '<c r="'.$ref.'" s="'.$style.'" t="inlineStr"><is><t xml:space="preserve">'.htmlspecialchars((string) $value, ENT_XML1).'</t></is></c>'; }
        for ($index = count($cells); $index <= $lastColumn; $index++) { $ref = self::column($index + 1).$number; $xml .= '<c r="'.$ref.'" s="6" t="inlineStr"><is><t></t></is></c>'; }
        return $xml.'</row>';
    }

    private static function column(int $number): string { $name = ''; while ($number > 0) { $number--; $name = chr(65 + $number % 26).$name; $number = intdiv($number, 26); } return $name; }
    private static function contentTypes(): string { return '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'; }
    private static function rootRelationships(): string { return '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'; }
    private static function workbook(): string { return '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Daily Report" sheetId="1" r:id="rId1"/></sheets></workbook>'; }
    private static function workbookRelationships(): string { return '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'; }
    private static function styles(): string
    {
        return '<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="5"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="18"/><name val="Arial"/></font><font><b/><u/><sz val="13"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FF173F8F"/><name val="Arial"/></font><font><b/><sz val="9"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/></patternFill></fill></fills><borders count="3"><border/><border><left style="thin"><color rgb="FF172554"/></left><right style="thin"><color rgb="FF172554"/></right><top style="thin"><color rgb="FF172554"/></top><bottom style="thin"><color rgb="FF172554"/></bottom></border><border><bottom style="medium"><color rgb="FF1D4ED8"/></bottom></border></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="8"><xf fontId="0"/><xf fontId="1" applyFont="1"><alignment horizontal="center"/></xf><xf fontId="2" applyFont="1"><alignment horizontal="center"/></xf><xf fontId="3" borderId="1" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf><xf fontId="4" borderId="1" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf><xf fontId="4" borderId="1" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf fontId="0" borderId="1" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf><xf fontId="4" borderId="1" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="top"/></xf></cellXfs></styleSheet>';
    }
}
