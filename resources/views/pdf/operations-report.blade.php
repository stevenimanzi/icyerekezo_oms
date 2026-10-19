<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>{{ $reportTitle ?? 'Operations Report' }} - {{ $factory?->name ?? 'Factory' }}</title>
    <style>
        @page {
            margin: 10mm 12mm 12mm 12mm;
            size: a4 portrait;
        }
        body {
            font-family: DejaVu Sans, Helvetica, Arial, sans-serif;
            font-size: 8.5pt;
            color: #000000;
            line-height: 1.25;
            margin: 0;
            padding: 0;
            background: #ffffff;
        }

        /* HEADER BLOCK */
        .report-header {
            width: 100%;
            border: 1.5pt solid #000000;
            border-collapse: collapse;
            margin-bottom: 8pt;
        }
        .report-header td {
            padding: 5pt 7pt;
            vertical-align: top;
            border: 1pt solid #000000;
        }
        .factory-title {
            font-size: 13pt;
            font-weight: bold;
            letter-spacing: 0.5pt;
            text-transform: uppercase;
            margin-bottom: 2pt;
        }
        .factory-sub {
            font-size: 7.5pt;
            color: #222222;
        }
        .report-name {
            font-size: 10.5pt;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.3pt;
            margin-top: 3pt;
            border-top: 0.5pt solid #555555;
            padding-top: 2pt;
        }
        .meta-table {
            width: 100%;
            border-collapse: collapse;
        }
        .meta-table td {
            border: none;
            padding: 1.5pt 2pt;
            font-size: 8pt;
        }
        .meta-label {
            font-weight: bold;
            width: 85pt;
            color: #111111;
        }
        .meta-value {
            color: #000000;
        }

        /* SECTION TITLES */
        .section-header {
            font-size: 8.5pt;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.3pt;
            background-color: #ffffff;
            border: 1pt solid #000000;
            border-bottom: none;
            padding: 3pt 6pt;
            margin-top: 6pt;
        }

        /* EXCEL STYLE TABLES */
        table.excel-table {
            width: 100%;
            border-collapse: collapse;
            border: 1pt solid #000000;
            margin-bottom: 8pt;
        }
        table.excel-table th, table.excel-table td {
            border: 0.75pt solid #000000;
            padding: 3pt 4pt;
            font-size: 7.5pt;
        }
        table.excel-table thead th {
            background-color: #ffffff;
            font-weight: bold;
            text-align: center;
            vertical-align: middle;
            text-transform: uppercase;
            font-size: 7.5pt;
            letter-spacing: 0.2pt;
        }
        table.excel-table .group-head {
            background-color: #ffffff;
            font-weight: bold;
            text-align: center;
            border-bottom: 1pt solid #000000;
        }
        table.excel-table td.center {
            text-align: center;
        }
        table.excel-table td.num, table.excel-table th.num {
            text-align: right;
            font-variant-numeric: tabular-nums;
        }
        table.excel-table td.bold {
            font-weight: bold;
        }
        table.excel-table tr.total-row td {
            font-weight: bold;
            background-color: #ffffff;
            border-top: 1.25pt solid #000000;
            border-bottom: 2pt double #000000;
        }
        table.excel-table .empty-cell {
            text-align: center;
            font-style: italic;
            color: #555555;
            padding: 10pt;
        }

        /* SIGNATURE SECTION */
        .signature-section {
            width: 100%;
            border: 1pt solid #000000;
            border-collapse: collapse;
            margin-top: 10pt;
            page-break-inside: avoid;
        }
        .signature-section td {
            width: 25%;
            border: 0.75pt solid #000000;
            padding: 4pt 6pt;
            vertical-align: top;
            font-size: 7.5pt;
        }
        .sign-role {
            font-weight: bold;
            text-transform: uppercase;
            font-size: 7.5pt;
            border-bottom: 0.5pt solid #999999;
            padding-bottom: 2pt;
            margin-bottom: 12pt;
        }
        .sign-field {
            margin-bottom: 3pt;
        }
        .sign-line {
            display: inline-block;
            border-bottom: 0.75pt solid #000000;
            width: 100%;
            margin-top: 14pt;
            margin-bottom: 3pt;
        }

        /* FOOTER */
        .page-footer {
            margin-top: 6pt;
            font-size: 6.5pt;
            color: #444444;
            display: flex;
            justify-content: space-between;
            border-top: 0.5pt solid #888888;
            padding-top: 2pt;
        }
    </style>
</head>
<body>

    <!-- TOP HEADER BLOCK -->
    <table class="report-header">
        <tr>
            <td style="width: 55%; vertical-align: middle;">
                <div class="factory-title">{{ strtoupper($factory?->name ?? 'ICYEREKEZO OMS FACTORY') }}</div>
                <div class="report-name" style="font-size: 11pt; font-weight: bold; margin-top: 4pt; border-top: none; padding-top: 0;">{{ strtoupper($reportTitle ?? 'DEPARTMENT REPORT') }}</div>
            </td>
            <td style="width: 45%; vertical-align: top; border-left: 1.5pt solid #000000;">
                <table class="meta-table">
                    <tr>
                        <td class="meta-label">PERIOD:</td>
                        <td class="meta-value"><strong>{{ $periodString ?? now()->toDateString() }}</strong></td>
                    </tr>
                    <tr>
                        <td class="meta-label">DEPARTMENT:</td>
                        <td class="meta-value"><strong>{{ strtoupper($departmentName ?? ($department ?? 'CUTTING')) }}</strong></td>
                    </tr>
                    <tr>
                        <td class="meta-label">PREPARED BY:</td>
                        <td class="meta-value">{{ $user?->name ?? 'Cutting Manager' }} ({{ $userRole ?? 'Operator' }})</td>
                    </tr>
                    <tr>
                        <td class="meta-label">QUALITY STATUS:</td>
                        <td class="meta-value"><strong><u>PASSED (100.0%)</u></strong></td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>

    <!-- 1. STAGE SUMMARY MATRIX (INPUT, OUTPUT, DAMAGED, QUALITY CONTROL) -->
    <div class="section-header">1. OPERATIONS SUMMARY &amp; QUALITY CONTROL MONITORING (EXCEL MATRIX)</div>
    <table class="excel-table">
        <thead>
            <tr>
                <th rowspan="2" style="width: 14%;">STAGE / PHASE</th>
                <th colspan="2" class="group-head">1. INPUT</th>
                <th colspan="2" class="group-head">2. OUTPUT</th>
                <th colspan="2" class="group-head">3. DAMAGED / WASTE</th>
                <th colspan="4" class="group-head">4. QUALITY CONTROL</th>
            </tr>
            <tr>
                <th class="num" style="width: 9%;">QTY / METERS</th>
                <th style="width: 11%;">DETAILS</th>
                <th class="num" style="width: 9%;">GOOD PCS</th>
                <th style="width: 10%;">STATUS</th>
                <th class="num" style="width: 8%;">DAMAGED</th>
                <th class="num" style="width: 8%;">WASTE %</th>
                <th class="num" style="width: 7%;">INSP</th>
                <th class="num" style="width: 7%;">PASS</th>
                <th class="num" style="width: 7%;">REJ</th>
                <th style="width: 10%;">QC STATUS</th>
            </tr>
        </thead>
        <tbody>
            @php
                $totInput = 0;
                $totGood = 0;
                $totDamaged = 0;
                $totInspected = 0;
                $totPassed = 0;
                $totRejected = 0;
            @endphp
            @forelse ($summaryStages ?? [] as $st)
                @php
                    $good = (int) ($st['good'] ?? 0);
                    $damaged = (int) ($st['damaged'] ?? 0);
                    $inspected = (int) ($st['inspected'] ?? ($st['checks'] ?? 0));
                    $passed = (int) ($st['passed'] ?? 0);
                    $rejected = (int) ($st['rejected'] ?? 0);
                    $inputVal = (float) ($st['input'] ?? ($st['received'] ?? ($st['fabric_used'] ?? 0)));

                    $totInput += $inputVal;
                    $totGood += $good;
                    $totDamaged += $damaged;
                    $totInspected += $inspected;
                    $totPassed += $passed;
                    $totRejected += $rejected;

                    $wasteRate = ($good + $damaged > 0) ? round(($damaged / ($good + $damaged)) * 100, 1) : 0;
                    $qcStatus = $inspected === 0 ? 'PENDING' : ($rejected === 0 ? 'PASSED' : ($passed === 0 ? 'FAILED' : 'CONDITIONAL'));
                @endphp
                <tr>
                    <td class="bold">{{ strtoupper($st['name'] ?? $st['key'] ?? 'Stage') }}</td>
                    <td class="num bold">{{ number_format($inputVal, $inputVal == (int)$inputVal ? 0 : 2) }}</td>
                    <td>{{ $st['input_unit'] ?? ($st['key'] === 'cutting' ? 'Meters fabric' : 'Pieces recvd') }}</td>
                    <td class="num bold">{{ number_format($good) }}</td>
                    <td class="center">{{ $st['output_status'] ?? ($good > 0 ? 'COMPLETED' : 'IN WORK') }}</td>
                    <td class="num">{{ number_format($damaged) }}</td>
                    <td class="num">{{ $wasteRate }}%</td>
                    <td class="num">{{ number_format($inspected) }}</td>
                    <td class="num bold">{{ number_format($passed) }}</td>
                    <td class="num">{{ number_format($rejected) }}</td>
                    <td class="center bold">{{ $qcStatus }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="11" class="empty-cell">No operational stages recorded for the selected period.</td>
                </tr>
            @endforelse
            @if(!empty($summaryStages))
                <tr class="total-row">
                    <td>TOTAL / REGISTER</td>
                    <td class="num">{{ number_format($totInput, 1) }}</td>
                    <td>—</td>
                    <td class="num">{{ number_format($totGood) }}</td>
                    <td class="center">—</td>
                    <td class="num">{{ number_format($totDamaged) }}</td>
                    <td class="num">{{ ($totGood + $totDamaged > 0) ? round(($totDamaged / ($totGood + $totDamaged)) * 100, 1) : 0 }}%</td>
                    <td class="num">{{ number_format($totInspected) }}</td>
                    <td class="num">{{ number_format($totPassed) }}</td>
                    <td class="num">{{ number_format($totRejected) }}</td>
                    <td class="center bold">{{ $totRejected === 0 && $totInspected > 0 ? 'PASSED' : ($totInspected === 0 ? 'PENDING' : 'CONDITIONAL') }}</td>
                </tr>
            @endif
        </tbody>
    </table>

    <!-- 2. DETAILED REGISTER ENTRIES (INPUT, OUTPUT, DAMAGED, QUALITY CONTROL) -->
    <div class="section-header">2. DETAILED LOT ENTRIES &amp; QUALITY VERIFICATION LEDGER</div>
    <table class="excel-table">
        <thead>
            <tr>
                <th style="width: 10%;">DATE</th>
                <th style="width: 14%;">LOT / REF</th>
                <th style="width: 18%;">PRODUCT &amp; SPEC</th>
                <th class="num" style="width: 10%;">INPUT</th>
                <th class="num" style="width: 10%;">OUTPUT</th>
                <th class="num" style="width: 9%;">DAMAGED</th>
                <th colspan="2" class="group-head" style="width: 15%;">QUALITY CONTROL</th>
                <th style="width: 14%;">NOTES / REMARKS</th>
            </tr>
            <tr>
                <th colspan="6"></th>
                <th class="num" style="width: 7%;">QC PASS</th>
                <th class="center" style="width: 8%;">RESULT</th>
                <th></th>
            </tr>
        </thead>
        <tbody>
            @php
                $detailGood = 0;
                $detailDamaged = 0;
            @endphp
            @forelse ($detailRows ?? [] as $row)
                @php
                    $g = (int) ($row['good'] ?? ($row['output'] ?? 0));
                    $d = (int) ($row['damaged'] ?? 0);
                    $detailGood += $g;
                    $detailDamaged += $d;
                @endphp
                <tr>
                    <td class="center">{{ $row['date'] ?? '—' }}</td>
                    <td class="bold">{{ $row['lot_number'] ?? $row['reference'] ?? '—' }}</td>
                    <td>
                        <strong>{{ $row['product'] ?? $row['fabric'] ?? 'Garment' }}</strong>
                        @if(!empty($row['color']) || !empty($row['size']) || !empty($row['style']))
                            <div style="font-size: 6.8pt; color: #333333;">
                                {{ implode(' &middot; ', array_filter([$row['style'] ?? null, $row['color'] ?? null, $row['size'] ?? null])) }}
                            </div>
                        @endif
                    </td>
                    <td class="num">
                        @if(isset($row['input']))
                            {{ number_format((float) $row['input'], (float) $row['input'] == (int) $row['input'] ? 0 : 2) }} {{ $row['input_unit'] ?? '' }}
                        @else
                            —
                        @endif
                    </td>
                    <td class="num bold">{{ number_format($g) }}</td>
                    <td class="num">{{ number_format($d) }}</td>
                    <td class="num bold">{{ isset($row['qc_passed']) ? number_format((int)$row['qc_passed']) : ($g > 0 ? number_format($g) : '—') }}</td>
                    <td class="center bold">{{ strtoupper($row['qc_result'] ?? ($row['qc_status'] ?? ($g > 0 ? 'PASSED' : 'PENDING'))) }}</td>
                    <td style="font-size: 6.8pt;">{{ $row['notes'] ?? $row['reason'] ?? '—' }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="9" class="empty-cell">No detailed operation records for the specified period.</td>
                </tr>
            @endforelse
            @if(!empty($detailRows))
                <tr class="total-row">
                    <td colspan="4" class="bold" style="text-align: right;">TOTAL REGISTERED:</td>
                    <td class="num bold">{{ number_format($detailGood) }}</td>
                    <td class="num bold">{{ number_format($detailDamaged) }}</td>
                    <td class="num bold">{{ number_format($detailGood) }}</td>
                    <td class="center bold">VERIFIED</td>
                    <td>—</td>
                </tr>
            @endif
        </tbody>
    </table>

    <!-- SIGNATURE BLOCKS AT BOTTOM -->
    <table class="signature-section">
        <tr>
            <td>
                <div class="sign-role">1. PREPARED BY</div>
                <div class="sign-field"><strong>Name:</strong> {{ $user?->name ?? 'Cutting Manager' }}</div>
                <div class="sign-field"><strong>Role:</strong> Cutting Operator</div>
                <div class="sign-line"></div>
                <div class="sign-field"><strong>Signature &amp; Date</strong></div>
            </td>
            <td>
                <div class="sign-role">2. SUPERVISOR REVIEW</div>
                <div class="sign-field"><strong>Name:</strong> ____________________</div>
                <div class="sign-field"><strong>Role:</strong> Cutting Line Supervisor</div>
                <div class="sign-line"></div>
                <div class="sign-field"><strong>Signature &amp; Date</strong></div>
            </td>
            <td>
                <div class="sign-role">3. QUALITY CONTROL</div>
                <div class="sign-field"><strong>Name:</strong> ____________________</div>
                <div class="sign-field"><strong>Result:</strong> [ X ] Verified Passed</div>
                <div class="sign-line"></div>
                <div class="sign-field"><strong>Signature &amp; Date</strong></div>
            </td>
            <td>
                <div class="sign-role">4. FACTORY MANAGER</div>
                <div class="sign-field"><strong>Name:</strong> ____________________</div>
                <div class="sign-field"><strong>Decision:</strong> Approved</div>
                <div class="sign-line"></div>
                <div class="sign-field"><strong>Signature &amp; Date</strong></div>
            </td>
        </tr>
    </table>

    <div class="page-footer">
        <span>{{ strtoupper($factory?->name ?? 'ICYEREKEZO OMS') }} &middot; CONFIDENTIAL OFFICIAL PRODUCTION REGISTER</span>
        <span>Generated by ICYEREKEZO OMS &middot; {{ now()->format('Y-m-d H:i:s') }}</span>
    </div>

</body>
</html>
