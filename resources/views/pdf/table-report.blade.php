<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>{{ $doc['title'] }} - {{ $doc['factory'] }}</title>
    <style>
        @page { margin: 16mm 12mm 16mm 12mm; }
        body { font-family: DejaVu Sans, Helvetica, Arial, sans-serif; font-size: 8.5pt; color: #0f172a; margin: 0; }
        .brand { width: 100%; border-collapse: collapse; border-bottom: 2.2pt solid #1e3a8a; }
        .brand td { padding: 0 0 7pt 0; vertical-align: bottom; }
        .factory { font-size: 9pt; font-weight: bold; letter-spacing: 1pt; text-transform: uppercase; color: #1e3a8a; }
        .title { font-size: 17pt; font-weight: bold; margin-top: 2pt; color: #0f172a; }
        .subtitle { font-size: 8.5pt; color: #475569; margin-top: 2pt; }
        .printed { text-align: right; font-size: 7.5pt; color: #64748b; }
        .summary { width: 100%; border-collapse: separate; border-spacing: 5pt 0; margin: 10pt -5pt 4pt -5pt; }
        .summary td { border: 0.8pt solid #cbd5e1; background: #f8fafc; padding: 6pt 8pt; vertical-align: top; }
        .summary .label { font-size: 6.8pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5pt; color: #64748b; }
        .summary .value { font-size: 12pt; font-weight: bold; margin-top: 2pt; color: #0f172a; }
        h2 { font-size: 10pt; margin: 14pt 0 5pt 0; color: #1e3a8a; }
        table.data { width: 100%; border-collapse: collapse; margin-top: 8pt; }
        table.data th { background: #1e3a8a; color: #ffffff; font-size: 7.4pt; text-transform: uppercase; letter-spacing: 0.3pt; padding: 5pt 5pt; border: 0.6pt solid #1e3a8a; text-align: left; }
        table.data td { padding: 4.5pt 5pt; border: 0.6pt solid #cbd5e1; font-size: 8pt; vertical-align: top; word-wrap: break-word; }
        table.data tr.alt td { background: #f1f5f9; }
        table.data tr.total td { background: #e2e8f0; font-weight: bold; border-top: 1.2pt solid #1e3a8a; }
        table.data thead { display: table-header-group; }
        table.data tr { page-break-inside: avoid; }
        .r { text-align: right; }
        .nw { white-space: nowrap; }
        .empty { text-align: center; color: #64748b; padding: 14pt; }
        .count { font-size: 7.5pt; color: #64748b; margin-top: 4pt; }
    </style>
</head>
<body>
    <script type="text/php">
        if (isset($pdf)) {
            $font = $fontMetrics->getFont('DejaVu Sans', 'normal');
            $w = $pdf->get_width();
            $h = $pdf->get_height();
            $pdf->page_text(34, $h - 28, "{{ addslashes($doc['factory']) }}  |  {{ addslashes($doc['title']) }}", $font, 7, [0.39, 0.45, 0.55]);
            $pdf->page_text($w - 90, $h - 28, "Page {PAGE_NUM} of {PAGE_COUNT}", $font, 7, [0.39, 0.45, 0.55]);
        }
    </script>

    <table class="brand">
        <tr>
            <td>
                <div class="factory">{{ $doc['factory'] }}</div>
                <div class="title">{{ $doc['title'] }}</div>
                @if ($doc['subtitle'])
                    <div class="subtitle">{{ $doc['subtitle'] }}</div>
                @endif
            </td>
            <td class="printed">{{ $doc['generated'] }}</td>
        </tr>
    </table>

    @if (! empty($doc['summary']))
        <table class="summary">
            @foreach (array_chunk($doc['summary'], 5) as $chunk)
                <tr>
                    @foreach ($chunk as $item)
                        <td style="width: {{ 100 / max(1, count($chunk)) }}%">
                            <div class="label">{{ $item['label'] }}</div>
                            <div class="value">{{ $item['value'] }}</div>
                        </td>
                    @endforeach
                </tr>
            @endforeach
        </table>
    @endif

    @foreach ($doc['tables'] as $table)
        @if ($table['heading'])
            <h2>{{ $table['heading'] }}</h2>
        @endif
        @php
            $format = function ($column, $value) {
                if (in_array($column['kind'], ['money', 'number'], true) && is_numeric($value)) {
                    return number_format((float) $value, (int) $column['decimals']);
                }

                return $value === null || $value === '' ? '—' : $value;
            };
        @endphp
        <table class="data">
            <thead>
                <tr>
                    @foreach ($table['columns'] as $column)
                        <th class="{{ in_array($column['kind'], ['money', 'number'], true) ? 'r' : '' }}">{{ $column['label'] }}</th>
                    @endforeach
                </tr>
            </thead>
            <tbody>
                @forelse ($table['rows'] as $i => $row)
                    <tr class="{{ $i % 2 ? 'alt' : '' }}">
                        @foreach ($table['columns'] as $c => $column)
                            <td class="{{ in_array($column['kind'], ['money', 'number'], true) ? 'r nw' : ($column['kind'] === 'date' ? 'nw' : '') }}">{{ $format($column, $row[$c] ?? null) }}</td>
                        @endforeach
                    </tr>
                @empty
                    <tr><td class="empty" colspan="{{ count($table['columns']) }}">Nothing to show for these dates and filters.</td></tr>
                @endforelse
                @if ($table['totals'])
                    <tr class="total">
                        @foreach ($table['columns'] as $c => $column)
                            <td class="{{ in_array($column['kind'], ['money', 'number'], true) ? 'r nw' : '' }}">{{ $format($column, $table['totals'][$c] ?? null) === '—' ? '' : $format($column, $table['totals'][$c] ?? null) }}</td>
                        @endforeach
                    </tr>
                @endif
            </tbody>
        </table>
        <div class="count">{{ count($table['rows']) }} {{ count($table['rows']) === 1 ? 'row' : 'rows' }}</div>
    @endforeach
</body>
</html>
