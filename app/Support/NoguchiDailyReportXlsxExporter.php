<?php

namespace App\Support;

use ZipArchive;

/**
 * Excel export of the Noguchi daily report. It uses the same register data and layout as the report page:
 * DAILY REPORT bar, coloured section bars, INPUT/OUTPUT headings, one block of merged rows per date.
 */
class NoguchiDailyReportXlsxExporter
{
    // cell style ids (see styles())
    private const S_SUBTITLE = 1;
    private const S_HEADER = 7;
    private const S_CENTER = 8;
    private const S_LEFT = 9;
    private const S_NUM_RIGHT_INT = 10;
    private const S_NUM_RIGHT_DEC = 11;
    private const S_NUM_CENTER_INT = 12;
    private const S_NUM_CENTER_DEC = 13;
    private const S_GAP = 14;
    private const S_MESSAGE = 15;
    private const SECTION_STYLE = ['wh' => 2, 'cut' => 3, 'prod' => 4, 'fin' => 5, 'stock' => 6];

    private array $cells = [];
    private array $merges = [];

    public static function create(array $data, string $path): void
    {
        (new self())->build($data, $path);
    }

    private function build(array $data, string $path): void
    {
        $departmentId = $data['report']['department_id'] ?? null;
        $department = '';
        foreach ($data['filters']['departments'] ?? [] as $item) {
            if ((string) $item['id'] === (string) $departmentId) $department = (string) $item['name'];
        }
        $sections = NoguchiDailyRegister::sectionsFor($department);
        $days = $sections ? NoguchiDailyRegister::days($data, $department) : [];
        $days = array_values(array_filter($days, fn ($day) => $this->hasData($day, $sections)));
        $from = (string) $data['report']['from'];
        $period = str_starts_with($from, '2000-') ? 'All dates up to '.$data['report']['to'] : $from.' to '.$data['report']['to'];
        $subtitle = ' DAILY REPORT'.($department !== '' ? ' – '.$department : '').'   |   '.$period;

        $widths = [96];
        $this->cells = [];
        $this->merges = [];
        if (! $sections) {
            $this->put(1, 1, $subtitle, self::S_SUBTITLE);
            $this->put(3, 1, $department !== '' ? "{$department} has no entries in the daily register." : 'Nothing to show.', self::S_MESSAGE);
            $widths = [420];
        } else {
            [$columnMap, $widths] = $this->layout($sections);
            $total = count($widths);
            $this->merge(1, 1, 1, $total, $subtitle, self::S_SUBTITLE);
            $this->headings($sections, $columnMap, $total, $department);
            $row = 6;
            foreach ($days as $day) {
                $row = $this->dayBlock($day, $sections, $columnMap, $row);
            }
            if (! $days) {
                $this->put($row, 1, '', self::S_CENTER);
            }
        }

        $zip = new ZipArchive();
        if ($zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) throw new \RuntimeException('Unable to create the Noguchi daily Excel report.');
        $zip->addFromString('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>');
        $zip->addFromString('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
        $zip->addFromString('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Daily Report" sheetId="1" r:id="rId1"/></sheets></workbook>');
        $zip->addFromString('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
        $zip->addFromString('xl/styles.xml', $this->styles());
        $zip->addFromString('xl/worksheets/sheet1.xml', $this->sheet($widths, (bool) $sections));
        $zip->close();
    }

    private function hasData(array $day, array $sections): bool
    {
        foreach ($sections as $key) {
            foreach (NoguchiDailyRegister::SECTIONS[$key]['groups'] as $group) {
                if ($day['groups'][$group]) return true;
            }
        }

        return false;
    }

    /** Column numbers (1-based): the date column, then for each section a spacer and its groups. */
    private function layout(array $sections): array
    {
        $map = [];
        $widths = [96];
        $column = 2;
        foreach ($sections as $key) {
            $map[$key]['gap'] = $column++;
            $widths[] = 20;
            $map[$key]['start'] = $column;
            foreach (NoguchiDailyRegister::SECTIONS[$key]['groups'] as $group) {
                $map[$key]['groups'][$group] = $column;
                foreach (NoguchiDailyRegister::GROUPS[$group]['widths'] as $width) {
                    $widths[] = max($width, 64);
                    $column++;
                }
            }
            $map[$key]['end'] = $column - 1;
        }

        return [$map, $widths];
    }

    private function headings(array $sections, array $map, int $total, string $department = ''): void
    {
        // rows: 2 section bars, 3 INPUT/OUTPUT, 4 sub headings, 5 leaf headings
        $this->merge(2, 1, 2, 1, 'SECTIONS', self::S_HEADER);
        $this->merge(3, 1, 5, 1, 'DATE', self::S_HEADER);
        foreach ($sections as $key) {
            $spec = NoguchiDailyRegister::SECTIONS[$key];
            $c = $map[$key];
            $this->merge(2, $c['gap'], 5, $c['gap'], '', self::S_GAP);
            $title = match (true) {
                $key === 'prod' && (bool) preg_match('/sew/i', $department) => 'SEWING',
                $key === 'fin' && (bool) preg_match('/packag|packing/i', $department) => 'PACKAGING',
                default => $spec['title'],
            };
            $this->merge(2, $c['start'], 2, $c['end'], $title, self::SECTION_STYLE[$key]);
            $column = $c['start'];
            foreach ($spec['row5'] as [$label, $span]) {
                $this->merge(3, $column, 3, $column + $span - 1, $label, self::S_HEADER);
                $column += $span;
            }
            $column = $c['start'];
            $leaf = [];
            foreach ($spec['row6'] as [$label, $span, $rows]) {
                $this->merge(4, $column, 3 + $rows, $column + $span - 1, $label, self::S_HEADER);
                if ($rows === 1) {
                    for ($i = 0; $i < $span; $i++) $leaf[] = $column + $i;
                }
                $column += $span;
            }
            foreach ($spec['row7'] as $i => $label) {
                $this->put(5, $leaf[$i], $label, self::S_HEADER);
            }
        }
    }

    private function dayBlock(array $day, array $sections, array $map, int $row): int
    {
        $height = 1;
        foreach ($sections as $key) {
            foreach (NoguchiDailyRegister::SECTIONS[$key]['groups'] as $group) $height = max($height, count($day['groups'][$group]));
        }
        $this->merge($row, 1, $row + $height - 1, 1, date('j-M-y', strtotime($day['date'])), self::S_CENTER);
        foreach ($sections as $key) {
            $c = $map[$key];
            for ($line = 0; $line < $height; $line++) $this->put($row + $line, $c['gap'], '', self::S_GAP);
            foreach (NoguchiDailyRegister::SECTIONS[$key]['groups'] as $group) {
                $spec = NoguchiDailyRegister::GROUPS[$group];
                $rows = $day['groups'][$group];
                $layout = NoguchiDailyRegister::spans($rows, count($spec['kinds']), $spec['merge'], $height);
                foreach ($spec['kinds'] as $index => $kind) {
                    for ($line = 0; $line < $height; $line++) {
                        $span = $layout[$index][$line];
                        if (! $span) continue;
                        $value = $rows[$line][$index] ?? '';
                        $this->merge($row + $line, $c['groups'][$group] + $index, $row + $line + $span - 1, $c['groups'][$group] + $index, $value, $this->bodyStyle($kind, $value));
                    }
                }
            }
        }

        // a blank row separates the days, as in the factory sheet
        $blank = $row + $height;
        $this->put($blank, 1, '', self::S_CENTER);
        foreach ($sections as $key) {
            $c = $map[$key];
            $this->put($blank, $c['gap'], '', self::S_GAP);
            for ($column = $c['start']; $column <= $c['end']; $column++) $this->put($blank, $column, '', self::S_CENTER);
        }

        return $blank + 1;
    }

    private function bodyStyle(string $kind, $value): int
    {
        if (is_float($value) || is_int($value)) {
            $integer = fmod((float) $value, 1.0) === 0.0;
            if ($kind === 'num') return $integer ? self::S_NUM_RIGHT_INT : self::S_NUM_RIGHT_DEC;

            return $integer ? self::S_NUM_CENTER_INT : self::S_NUM_CENTER_DEC;
        }

        return $kind === 'size' ? self::S_LEFT : self::S_CENTER;
    }

    private function put(int $row, int $column, $value, int $style): void
    {
        $this->cells[$row][$column] = [$value, $style];
    }

    /** Merge a block, write its value in the top-left cell and give every covered cell the same border/fill. */
    private function merge(int $row1, int $col1, int $row2, int $col2, $value, int $style): void
    {
        for ($r = $row1; $r <= $row2; $r++) {
            for ($c = $col1; $c <= $col2; $c++) $this->put($r, $c, '', $style);
        }
        $this->put($row1, $col1, $value, $style);
        if ($row2 > $row1 || $col2 > $col1) $this->merges[] = $this->ref($row1, $col1).':'.$this->ref($row2, $col2);
    }

    private function ref(int $row, int $column): string
    {
        $name = '';
        for ($n = $column; $n > 0; $n = intdiv($n - 1, 26)) $name = chr(65 + ($n - 1) % 26).$name;

        return $name.$row;
    }

    private function sheet(array $widths, bool $frozen): string
    {
        ksort($this->cells);
        $rowsXml = '';
        $maxRow = 1;
        $maxColumn = 1;
        foreach ($this->cells as $rowNumber => $row) {
            ksort($row);
            $height = match (true) { $rowNumber === 1 => ' ht="26" customHeight="1"', $rowNumber >= 2 && $rowNumber <= 5 && $frozen => ' ht="21" customHeight="1"', default => '' };
            $rowsXml .= '<row r="'.$rowNumber.'"'.$height.'>';
            foreach ($row as $column => [$value, $style]) {
                $ref = $this->ref($rowNumber, $column);
                if (is_int($value) || is_float($value)) {
                    $rowsXml .= '<c r="'.$ref.'" s="'.$style.'"><v>'.$value.'</v></c>';
                } elseif ($value === '' || $value === null) {
                    $rowsXml .= '<c r="'.$ref.'" s="'.$style.'"/>';
                } else {
                    $rowsXml .= '<c r="'.$ref.'" s="'.$style.'" t="inlineStr"><is><t xml:space="preserve">'.htmlspecialchars((string) $value, ENT_XML1).'</t></is></c>';
                }
                $maxColumn = max($maxColumn, $column);
            }
            $rowsXml .= '</row>';
            $maxRow = max($maxRow, $rowNumber);
        }
        $cols = '<cols>'.implode('', array_map(fn ($width, $i) => '<col min="'.($i + 1).'" max="'.($i + 1).'" width="'.round($width / 7, 1).'" customWidth="1"/>', $widths, array_keys($widths))).'</cols>';
        $pane = $frozen ? '<pane xSplit="1" ySplit="5" topLeftCell="B6" activePane="bottomRight" state="frozen"/>' : '';
        $merge = $this->merges ? '<mergeCells count="'.count($this->merges).'">'.implode('', array_map(fn ($ref) => '<mergeCell ref="'.$ref.'"/>', $this->merges)).'</mergeCells>' : '';

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:'.$this->ref($maxRow, $maxColumn).'"/><sheetViews><sheetView showGridLines="0" workbookViewId="0">'.$pane.'</sheetView></sheetViews>'.$cols.'<sheetData>'.$rowsXml.'</sheetData>'.$merge.'<pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup orientation="landscape" paperSize="8" fitToWidth="1" fitToHeight="0"/></worksheet>';
    }

    private function styles(): string
    {
        $border = '<border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border>';
        $fill = fn (string $rgb) => '<fill><patternFill patternType="solid"><fgColor rgb="FF'.$rgb.'"/><bgColor indexed="64"/></patternFill></fill>';
        $xf = fn (int $font, int $fill, string $align, int $numFmt = 0) => '<xf numFmtId="'.$numFmt.'" fontId="'.$font.'" fillId="'.$fill.'" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"'.($numFmt ? ' applyNumberFormat="1"' : '').'><alignment '.$align.'/></xf>';
        $center = 'horizontal="center" vertical="center"';

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            .'<fonts count="5"><font><sz val="11"/><name val="Calibri"/></font><font><sz val="14"/><b/><name val="Calibri"/></font><font><sz val="12"/><b/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><sz val="12"/><b/><color rgb="FF1A2E05"/><name val="Calibri"/></font><font><sz val="11"/><b/><name val="Calibri"/></font></fonts>'
            .'<fills count="8"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'.$fill('2E75B5').$fill('92D050').$fill('C55A11').$fill('8F3EC4').$fill('0070C0').'</fills>'
            .'<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>'.$border.'</borders>'
            .'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            .'<cellXfs count="16">'
            .'<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'                       // 0 default
            .$xf(1, 0, 'horizontal="left" vertical="center"')                                        // 1 subtitle
            .$xf(2, 2, $center).$xf(3, 3, $center).$xf(2, 4, $center).$xf(2, 5, $center).$xf(2, 6, $center) // 2-6 section bars
            .$xf(4, 0, $center.' wrapText="1"')                                                      // 7 headings
            .$xf(0, 0, $center)                                                                      // 8 centered text
            .$xf(0, 0, 'horizontal="left" vertical="center"')                                        // 9 left text
            .$xf(0, 0, 'horizontal="right" vertical="center"', 3).$xf(0, 0, 'horizontal="right" vertical="center"', 4)   // 10-11 numbers right
            .$xf(0, 0, $center, 3).$xf(0, 0, $center, 4)                                             // 12-13 numbers centered
            .$xf(0, 0, $center)                                                                      // 14 spacer
            .$xf(1, 0, $center)                                                                      // 15 message
            .'</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
    }
}
