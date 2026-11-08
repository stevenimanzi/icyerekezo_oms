<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Payslips {{ $run->period }}</title>
    <style>
        @page { margin: 18mm 16mm; }
        body { font-family: DejaVu Sans, Helvetica, Arial, sans-serif; font-size: 9pt; color: #0f172a; margin: 0; }
        .slip { page-break-after: always; }
        .slip:last-child { page-break-after: auto; }
        .head { width: 100%; border-collapse: collapse; border-bottom: 2.2pt solid #1e3a8a; }
        .head td { padding: 0 0 8pt 0; vertical-align: bottom; }
        .factory { font-size: 10pt; font-weight: bold; letter-spacing: 1pt; text-transform: uppercase; color: #1e3a8a; }
        .title { font-size: 18pt; font-weight: bold; margin-top: 3pt; }
        .right { text-align: right; font-size: 8pt; color: #64748b; }
        .who { width: 100%; border-collapse: collapse; margin-top: 14pt; }
        .who td { padding: 5pt 8pt; border: 0.6pt solid #cbd5e1; background: #f8fafc; width: 25%; vertical-align: top; }
        .who .l { font-size: 6.8pt; text-transform: uppercase; letter-spacing: .5pt; color: #64748b; font-weight: bold; }
        .who .v { font-size: 10pt; font-weight: bold; margin-top: 2pt; }
        table.pay { width: 100%; border-collapse: collapse; margin-top: 16pt; }
        table.pay th { background: #1e3a8a; color: #fff; text-align: left; font-size: 8pt; text-transform: uppercase; padding: 6pt 8pt; }
        table.pay td { padding: 6pt 8pt; border-bottom: 0.6pt solid #e2e8f0; }
        .num { text-align: right; white-space: nowrap; }
        tr.sub td { background: #f1f5f9; font-weight: bold; }
        tr.net td { background: #e2e8f0; font-weight: bold; font-size: 11pt; border-top: 1.4pt solid #1e3a8a; }
        .note { margin-top: 12pt; font-size: 8pt; color: #475569; }
        .sign { width: 100%; margin-top: 40pt; border-collapse: collapse; }
        .sign td { width: 50%; padding-top: 22pt; border-top: 0.6pt solid #94a3b8; font-size: 8pt; color: #64748b; }
        .foot { margin-top: 18pt; font-size: 7pt; color: #94a3b8; text-align: center; }
    </style>
</head>
<body>
@foreach ($lines as $line)
    <div class="slip">
        <table class="head">
            <tr>
                <td>
                    <div class="factory">{{ $factory?->name ?? 'ICYEREKEZO OMS' }}</div>
                    <div class="title">Payslip</div>
                </td>
                <td class="right">
                    {{ \Carbon\Carbon::parse($run->period . '-01')->format('F Y') }}<br>
                    {{ $run->run_number }}
                </td>
            </tr>
        </table>

        <table class="who">
            <tr>
                <td><div class="l">Employee</div><div class="v">{{ $line->employee_name }}</div></td>
                <td><div class="l">Employee number</div><div class="v">{{ $line->employee_number ?: '—' }}</div></td>
                <td><div class="l">Job title</div><div class="v">{{ $line->job_title ?: '—' }}</div></td>
                <td><div class="l">Days not worked</div><div class="v">{{ $line->absent_days }}</div></td>
            </tr>
        </table>

        <table class="pay">
            <thead><tr><th>Description</th><th class="num">Amount ({{ $currency }})</th></tr></thead>
            <tbody>
                <tr><td>Basic salary</td><td class="num">{{ number_format((float) $line->base_salary, 0) }}</td></tr>
                <tr><td>Overtime ({{ rtrim(rtrim(number_format((float) $line->overtime_hours, 2), '0'), '.') ?: '0' }} hours)</td><td class="num">{{ number_format((float) $line->overtime_pay, 0) }}</td></tr>
                <tr><td>Allowances and bonus</td><td class="num">{{ number_format((float) $line->allowances, 0) }}</td></tr>
                <tr class="sub"><td>Gross pay</td><td class="num">{{ number_format((float) $line->gross_pay, 0) }}</td></tr>
                <tr><td>Days not worked ({{ $line->absent_days }})</td><td class="num">- {{ number_format((float) $line->absence_deduction, 0) }}</td></tr>
                <tr><td>Tax and social contributions ({{ rtrim(rtrim(number_format((float) $run->statutory_rate, 2), '0'), '.') ?: '0' }}%)</td><td class="num">- {{ number_format((float) $line->statutory_deduction, 0) }}</td></tr>
                <tr><td>Other deductions</td><td class="num">- {{ number_format((float) $line->other_deductions, 0) }}</td></tr>
                <tr class="net"><td>Net pay</td><td class="num">{{ number_format((float) $line->net_pay, 0) }}</td></tr>
            </tbody>
        </table>

        @if ($line->note)
            <div class="note">Note: {{ $line->note }}</div>
        @endif

        <table class="sign">
            <tr><td>Prepared by HR</td><td style="padding-left: 14pt">Employee signature</td></tr>
        </table>
        <div class="foot">{{ $factory?->name }} · Payslip {{ $run->run_number }} · Printed {{ now()->format('d M Y, H:i') }}</div>
    </div>
@endforeach
</body>
</html>
