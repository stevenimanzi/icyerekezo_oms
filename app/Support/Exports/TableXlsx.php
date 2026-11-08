<?php

namespace App\Support\Exports;

use RuntimeException;
use ZipArchive;

/**
 * Writes a clean Excel workbook (one sheet per table) without any extra library.
 * Numbers stay numbers so people can add them up; text is stored as plain text, never as a formula.
 */
class TableXlsx
{
    // Cell styles (see styles.xml below).
    private const S_TEXT = 0;
    private const S_HEAD = 1;
    private const S_TITLE = 2;
    private const S_INT = 3;
    private const S_DEC = 4;
    private const S_BOLD = 5;
    private const S_NOTE = 6;
    private const S_BOLD_INT = 7;
    private const S_BOLD_DEC = 8;

    /**
     * @param array{title:string, subtitle?:string, factory:string, generated:string, summary?:array, tables:array} $doc
     */
    public static function create(array $doc, string $path): void
    {
        $zip = new ZipArchive();
        if ($zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('The Excel file could not be created.');
        }

        $sheets = [];
        $used = [];
        foreach ($doc['tables'] as $index => $table) {
            $name = self::sheetName($table['heading'] ?? ($doc['title'] ?? 'Report'), $index + 1, $used);
            $used[] = $name;
            $sheets[] = ['name' => $name, 'xml' => self::sheetXml($doc, $table, $index === 0)];
        }

        $sheetOverrides = '';
        $sheetRefs = '';
        $sheetRels = '';
        foreach ($sheets as $i => $sheet) {
            $n = $i + 1;
            $sheetOverrides .= '<Override PartName="/xl/worksheets/sheet' . $n . '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
            $sheetRefs .= '<sheet name="' . self::esc($sheet['name']) . '" sheetId="' . $n . '" r:id="rId' . $n . '"/>';
            $sheetRels .= '<Relationship Id="rId' . $n . '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' . $n . '.xml"/>';
            $zip->addFromString('xl/worksheets/sheet' . $n . '.xml', $sheet['xml']);
        }
        $styleRel = 'rId' . (count($sheets) + 1);

        $zip->addFromString(
            '[Content_Types].xml',
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' . $sheetOverrides . '</Types>',
        );
        $zip->addFromString(
            '_rels/.rels',
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
        );
        $zip->addFromString(
            'xl/workbook.xml',
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' . $sheetRefs . '</sheets></workbook>',
        );
        $zip->addFromString(
            'xl/_rels/workbook.xml.rels',
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' . $sheetRels . '<Relationship Id="' . $styleRel . '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
        );
        $zip->addFromString('xl/styles.xml', self::styles());
        $zip->close();
    }

    private static function sheetXml(array $doc, array $table, bool $first): string
    {
        $columns = $table['columns'];
        $rows = [];
        $r = 1;
        $cell = function (int $col, string $value, int $style, bool $number = false) use (&$r): string {
            $ref = self::col($col) . $r;
            if ($number) {
                return '<c r="' . $ref . '" s="' . $style . '"><v>' . $value . '</v></c>';
            }

            return '<c r="' . $ref . '" s="' . $style . '" t="inlineStr"><is><t xml:space="preserve">' . self::esc($value) . '</t></is></c>';
        };
        $line = function (array $cells, ?int $height = null) use (&$r, &$rows): void {
            $rows[] = '<row r="' . $r . '"' . ($height ? ' ht="' . $height . '" customHeight="1"' : '') . '>' . implode('', $cells) . '</row>';
            $r++;
        };

        $line([$cell(0, $doc['factory'], self::S_TITLE)], 22);
        $line([$cell(0, $doc['title'], self::S_BOLD)]);
        if (! empty($doc['subtitle'])) {
            $line([$cell(0, $doc['subtitle'], self::S_NOTE)]);
        }
        $line([$cell(0, $doc['generated'], self::S_NOTE)]);
        if ($first && ! empty($doc['summary'])) {
            $r++;
            foreach ($doc['summary'] as $item) {
                $line([$cell(0, (string) $item['label'], self::S_BOLD), $cell(1, (string) $item['value'], self::S_TEXT)]);
            }
        }
        $r++;
        if (! empty($table['heading'])) {
            $line([$cell(0, $table['heading'], self::S_BOLD)]);
        }
        $headRow = $r;
        $line(array_map(fn ($c, $i) => $cell($i, (string) $c['label'], self::S_HEAD), $columns, array_keys($columns)), 20);

        foreach ($table['rows'] as $row) {
            $cells = [];
            foreach ($columns as $i => $c) {
                $cells[] = self::dataCell($cell, $i, $c, $row[$i] ?? null, false);
            }
            $line($cells);
        }
        if (! empty($table['totals'])) {
            $cells = [];
            foreach ($columns as $i => $c) {
                $cells[] = self::dataCell($cell, $i, $c, $table['totals'][$i] ?? null, true);
            }
            $line($cells);
        }

        $widths = '';
        foreach ($columns as $i => $c) {
            $max = mb_strlen((string) $c['label']);
            foreach (array_slice($table['rows'], 0, 200) as $row) {
                $max = max($max, mb_strlen((string) ($row[$i] ?? '')));
            }
            $width = max(10, min(48, $max + 3));
            $widths .= '<col min="' . ($i + 1) . '" max="' . ($i + 1) . '" width="' . $width . '" customWidth="1"/>';
        }
        $lastCol = self::col(max(0, count($columns) - 1));

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="' . $headRow . '" topLeftCell="A' . ($headRow + 1) . '" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>' . $widths . '</cols><sheetData>' . implode('', $rows) . '</sheetData><autoFilter ref="A' . $headRow . ':' . $lastCol . ($headRow + max(1, count($table['rows']))) . '"/><pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>';
    }

    private static function dataCell(callable $cell, int $i, array $column, mixed $value, bool $bold): string
    {
        $kind = $column['kind'] ?? 'text';
        if (in_array($kind, ['money', 'number'], true) && is_numeric($value)) {
            $decimals = (int) ($column['decimals'] ?? ($kind === 'money' ? 0 : 0));
            $style = $decimals > 0 ? ($bold ? self::S_BOLD_DEC : self::S_DEC) : ($bold ? self::S_BOLD_INT : self::S_INT);

            return $cell($i, (string) (float) $value, $style, true);
        }

        return $cell($i, $value === null ? '' : (string) $value, $bold ? self::S_BOLD : self::S_TEXT);
    }

    private static function styles(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            . '<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0"/><numFmt numFmtId="165" formatCode="#,##0.00"/></numFmts>'
            . '<fonts count="5">'
            . '<font><sz val="10"/><name val="Calibri"/></font>'
            . '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>'
            . '<font><b/><sz val="15"/><color rgb="FF1E3A8A"/><name val="Calibri"/></font>'
            . '<font><b/><sz val="10"/><name val="Calibri"/></font>'
            . '<font><i/><sz val="9"/><color rgb="FF64748B"/><name val="Calibri"/></font>'
            . '</fonts>'
            . '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1E3A8A"/></patternFill></fill></fills>'
            . '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right><top style="thin"><color rgb="FFCBD5E1"/></top><bottom style="thin"><color rgb="FFCBD5E1"/></bottom><diagonal/></border></borders>'
            . '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            . '<cellXfs count="9">'
            . '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>'
            . '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
            . '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
            . '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>'
            . '<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>'
            . '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
            . '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
            . '<xf numFmtId="164" fontId="3" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>'
            . '<xf numFmtId="165" fontId="3" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>'
            . '</cellXfs></styleSheet>';
    }

    private static function col(int $index): string
    {
        $name = '';
        $index++;
        while ($index > 0) {
            $mod = ($index - 1) % 26;
            $name = chr(65 + $mod) . $name;
            $index = intdiv($index - 1, 26);
        }

        return $name;
    }

    private static function sheetName(string $raw, int $number, array $used): string
    {
        $name = trim(preg_replace('/[\\\\\/\?\*\[\]:]/', ' ', $raw) ?? '');
        $name = mb_substr($name !== '' ? $name : 'Sheet ' . $number, 0, 28);
        $base = $name;
        $i = 2;
        while (in_array($name, $used, true)) {
            $name = mb_substr($base, 0, 25) . ' ' . $i++;
        }

        return $name;
    }

    private static function esc(string $value): string
    {
        $value = preg_replace('/[^\x{9}\x{A}\x{D}\x{20}-\x{D7FF}\x{E000}-\x{FFFD}]/u', '', $value) ?? '';

        return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }
}
