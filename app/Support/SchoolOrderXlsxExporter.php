<?php

namespace App\Support;

use Illuminate\Support\Collection;
use ZipArchive;

class SchoolOrderXlsxExporter
{
    private const CATEGORIES = ['Uniform', 'Sweater', 'Sport Uniform', 'TVET', 'Tourism', 'Polo', 'T-shirt', 'Rain Coat', 'Jumper'];

    public static function create(string $factoryName, Collection $orders, array $filters, string $path): void
    {
        $headers = ['Order number', 'School', 'District', 'Sector', 'Order date', 'Due date', ...self::CATEGORIES, 'Total quantity', 'Delivered', 'Remaining', 'Currency', 'Total amount', 'Status', 'Contact'];
        $rows = [];
        foreach ($orders as $order) {
            $delivered = (int) $order->lines->sum('quantity_delivered');
            $categoryTotals = collect(self::CATEGORIES)->map(fn (string $category) => self::categoryTotal($order->lines, $category))->all();
            $rows[] = [$order->document_number, $order->school?->name ?: $order->customer_name, $order->school?->district, $order->school?->sector, optional($order->document_date)->format('Y-m-d'), optional($order->due_date)->format('Y-m-d'), ...$categoryTotals, (int) $order->item_count, $delivered, max(0, (int) $order->item_count - $delivered), $order->currency_code ?: 'RWF', (float) $order->total_amount, ucfirst(str_replace('_', ' ', $order->status)), $order->school?->phone ?: $order->customer_email];
        }

        $zip = new ZipArchive();
        if ($zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) throw new \RuntimeException('Unable to create Excel export.');
        $zip->addFromString('[Content_Types].xml', self::contentTypes());
        $zip->addFromString('_rels/.rels', self::rootRelationships());
        $zip->addFromString('xl/workbook.xml', self::workbook());
        $zip->addFromString('xl/_rels/workbook.xml.rels', self::workbookRelationships());
        $zip->addFromString('xl/styles.xml', self::styles());
        $zip->addFromString('xl/worksheets/sheet1.xml', self::sheet($factoryName, $headers, $rows, $filters));
        $zip->close();
    }

    private static function categoryTotal(Collection $lines, string $category): int
    {
        $aliases = ['TVET' => ['tvet', 'overall', 'overcoat'], 'Sport Uniform' => ['sport', 'sport uniform'], 'Rain Coat' => ['rain coat', 'raincoat'], 'Polo' => ['polo', 'polo lacoste'], 'T-shirt' => ['t-shirt', 't shirt']];
        $names = $aliases[$category] ?? [strtolower($category)];
        return (int) $lines->filter(fn ($line) => in_array(strtolower((string) $line->garment_category), $names, true))->sum('quantity_ordered');
    }

    private static function sheet(string $factory, array $headers, array $rows, array $filters): string
    {
        $lastColumn = self::column(count($headers));
        $sheetRows = [self::row(1, [["{$factory} — School Order Quantity Report", 1]], count($headers)), self::row(2, [['Period', 2], [$filters['period'] ?? 'all', 0], ['Status', 2], [$filters['status'] ?: 'All', 0], ['District', 2], [$filters['district'] ?: 'All', 0], ['Sector', 2], [$filters['sector'] ?: 'All', 0]]), self::row(4, array_map(fn ($value) => [$value, 2], $headers))];
        foreach ($rows as $index => $values) $sheetRows[] = self::row($index + 5, array_map(fn ($value, $column) => [$value, in_array($column, [...range(6, 17), 19], true) ? 3 : 0], $values, array_keys($values)));
        $lastRow = max(4, count($rows) + 4);
        $widths = [16, 25, 14, 16, 12, 12, 11, 11, 14, 10, 10, 10, 10, 11, 11, 12, 11, 11, 11, 10, 14, 14, 16];
        $cols = '<cols>'.collect($widths)->map(fn ($width, $index) => '<col min="'.($index + 1).'" max="'.($index + 1).'" width="'.$width.'" customWidth="1"/>')->implode('').'</cols>';
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'.$cols.'<sheetData>'.implode('', $sheetRows).'</sheetData><autoFilter ref="A4:'.$lastColumn.$lastRow.'"/><pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/></worksheet>';
    }

    private static function row(int $number, array $cells, ?int $mergeAcross = null): string
    {
        $xml = '<row r="'.$number.'">';
        foreach ($cells as $index => [$value, $style]) { $ref = self::column($index + 1).$number; $xml .= $style === 3 && is_numeric($value) ? '<c r="'.$ref.'" s="'.$style.'"><v>'.$value.'</v></c>' : '<c r="'.$ref.'" s="'.$style.'" t="inlineStr"><is><t xml:space="preserve">'.htmlspecialchars((string) ($value ?? ''), ENT_XML1).'</t></is></c>'; }
        return $xml.'</row>';
    }

    private static function column(int $number): string { $name = ''; while ($number > 0) { $number--; $name = chr(65 + $number % 26).$name; $number = intdiv($number, 26); } return $name; }
    private static function contentTypes(): string { return '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'; }
    private static function rootRelationships(): string { return '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'; }
    private static function workbook(): string { return '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="School Orders" sheetId="1" r:id="rId1"/></sheets></workbook>'; }
    private static function workbookRelationships(): string { return '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'; }
    private static function styles(): string { return '<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="16"/><color rgb="FF1649A3"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1649A3"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FF94A3B8"/></left><right style="thin"><color rgb="FF94A3B8"/></right><top style="thin"><color rgb="FF94A3B8"/></top><bottom style="thin"><color rgb="FF94A3B8"/></bottom></border></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="4"><xf fontId="0" fillId="0" borderId="1" applyBorder="1"><alignment vertical="center"/></xf><xf fontId="1" fillId="0" borderId="0" applyFont="1"/><xf fontId="2" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf fontId="0" fillId="0" borderId="1" applyBorder="1"><alignment horizontal="center"/></xf></cellXfs></styleSheet>'; }
}
