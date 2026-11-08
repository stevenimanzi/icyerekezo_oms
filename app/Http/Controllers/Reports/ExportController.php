<?php

namespace App\Http\Controllers\Reports;

use App\Http\Controllers\Controller;
use App\Support\Exports\TableXlsx;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Turns the report a person is looking at into a proper PDF document or an Excel workbook.
 * The page sends what it shows (title, totals, tables); the server adds the factory letterhead,
 * the date, who printed it, and lays everything out the same way for every report.
 */
class ExportController extends Controller
{
    private const MAX_ROWS = 5000;

    public function __invoke(Request $request, string $format): Response
    {
        abort_unless(in_array($format, ['pdf', 'xlsx'], true), 404);

        $data = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'subtitle' => ['nullable', 'string', 'max:240'],
            'summary' => ['nullable', 'array', 'max:12'],
            'summary.*.label' => ['required', 'string', 'max:60'],
            'summary.*.value' => ['nullable'],
            'tables' => ['required', 'array', 'min:1', 'max:8'],
            'tables.*.heading' => ['nullable', 'string', 'max:120'],
            'tables.*.columns' => ['required', 'array', 'min:1', 'max:18'],
            'tables.*.columns.*.label' => ['required', 'string', 'max:60'],
            'tables.*.columns.*.kind' => ['nullable', 'in:text,number,money,date'],
            'tables.*.columns.*.decimals' => ['nullable', 'integer', 'min:0', 'max:4'],
            'tables.*.rows' => ['present', 'array', 'max:' . self::MAX_ROWS],
            'tables.*.rows.*' => ['array'],
            'tables.*.totals' => ['nullable', 'array'],
        ]);

        $user = $request->user();
        $factory = $user->currentFactory;
        $doc = [
            'title' => $this->text($data['title']),
            'subtitle' => $this->text($data['subtitle'] ?? ''),
            'factory' => $this->text($factory?->name ?: 'ICYEREKEZO OMS'),
            'generated' => 'Printed ' . now()->format('d M Y, H:i') . ' by ' . $this->text($user->name),
            'summary' => collect($data['summary'] ?? [])
                ->map(fn ($item) => ['label' => $this->text($item['label']), 'value' => $this->text($item['value'] ?? '')])
                ->all(),
            'tables' => collect($data['tables'])->map(function ($table) {
                $columns = collect($table['columns'])->map(fn ($c) => [
                    'label' => $this->text($c['label']),
                    'kind' => $c['kind'] ?? 'text',
                    'decimals' => (int) ($c['decimals'] ?? 0),
                ])->values()->all();
                $count = count($columns);

                return [
                    'heading' => $this->text($table['heading'] ?? ''),
                    'columns' => $columns,
                    'rows' => collect($table['rows'])->map(fn ($row) => $this->cells($columns, $row))->all(),
                    'totals' => ! empty($table['totals']) ? $this->cells($columns, $table['totals']) : null,
                ];
            })->all(),
        ];

        $slug = Str::slug($doc['title']) ?: 'report';
        $name = $slug . '-' . now()->format('Y-m-d');

        if ($format === 'xlsx') {
            $path = tempnam(sys_get_temp_dir(), 'xl');
            TableXlsx::create($doc, $path);

            return response()
                ->download($path, $name . '.xlsx', ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
                ->deleteFileAfterSend(true);
        }

        $wide = collect($doc['tables'])->contains(fn ($t) => count($t['columns']) > 7);
        $pdf = Pdf::loadView('pdf.table-report', ['doc' => $doc, 'landscape' => $wide])
            ->setPaper('a4', $wide ? 'landscape' : 'portrait');

        return $pdf->download($name . '.pdf');
    }

    /** Numbers stay numbers; everything else becomes plain, trimmed text. */
    private function cells(array $columns, array $row): array
    {
        $out = [];
        foreach ($columns as $i => $column) {
            $value = array_values($row)[$i] ?? null;
            $numeric = in_array($column['kind'], ['money', 'number'], true);
            $out[] = $numeric && is_numeric($value) ? (float) $value : $this->text($value);
        }

        return $out;
    }

    private function text(mixed $value): string
    {
        if (is_array($value) || is_object($value)) {
            return '';
        }

        return Str::limit(trim(preg_replace('/\s+/u', ' ', (string) $value) ?? ''), 400, '…');
    }
}
