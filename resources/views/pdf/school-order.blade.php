<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>School order {{ $document->document_number }}</title>
    <style>
        @page { margin: 25px 32px 42px; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #14213d; font-family: DejaVu Sans, sans-serif; font-size: 10px; }
        .header { width: 100%; border-bottom: 3px solid #2563eb; padding-bottom: 13px; margin-bottom: 16px; }
        .header td { vertical-align: middle; }
        .brand { width: 52px; height: 52px; text-align: center; border-radius: 12px; background: #2563eb; color: white; font-size: 18px; font-weight: bold; }
        .factory { padding-left: 12px; }
        .factory h1 { margin: 0 0 4px; font-size: 19px; }
        .factory p, .title p { margin: 2px 0; color: #64748b; }
        .title { text-align: right; }
        .title h2 { margin: 0 0 5px; color: #2563eb; font-size: 21px; }
        .title strong { font-size: 12px; }
        .grid { width: 100%; border-collapse: separate; border-spacing: 8px 0; margin: 0 -8px 17px; }
        .card { width: 50%; vertical-align: top; padding: 12px 14px; border: 1px solid #dbe3ef; border-radius: 8px; background: #f8fafc; }
        .card h3 { margin: 0 0 9px; color: #2563eb; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
        .info { width: 100%; border-collapse: collapse; }
        .info td { padding: 3px 0; }
        .info td:first-child { width: 38%; color: #64748b; }
        .summary { width: 100%; border-collapse: separate; border-spacing: 8px 0; margin: 0 -8px 17px; }
        .summary td { width: 20%; padding: 10px; text-align: center; border-radius: 7px; background: #eff6ff; }
        .summary small { display: block; margin-bottom: 4px; color: #64748b; text-transform: uppercase; }
        .summary strong { font-size: 14px; color: #1d4ed8; }
        h3.section { margin: 0 0 8px; font-size: 14px; }
        table.items { width: 100%; border-collapse: collapse; }
        .items th { padding: 8px 6px; color: white; background: #1e40af; text-align: left; font-size: 9px; }
        .items th.number, .items td.number { text-align: right; }
        .items td { padding: 7px 6px; border-bottom: 1px solid #dbe3ef; vertical-align: top; }
        .items tr:nth-child(even) td { background: #f8fafc; }
        .items tfoot td { padding-top: 9px; background: #eff6ff; border-top: 2px solid #2563eb; font-weight: bold; }
        .status { display: inline-block; padding: 4px 9px; border-radius: 12px; background: #fef3c7; color: #92400e; font-weight: bold; }
        .note { margin-top: 15px; padding: 10px 12px; border-left: 3px solid #2563eb; color: #475569; background: #f8fafc; }
        .footer { position: fixed; right: 0; bottom: -28px; left: 0; color: #64748b; font-size: 8px; border-top: 1px solid #dbe3ef; padding-top: 7px; }
        .footer .right { float: right; }
        .page-number:after { content: counter(page); }
    </style>
</head>
<body>
@php
    $statusLabels = ['pending' => 'Waiting for review', 'draft' => 'Waiting for review', 'submitted' => 'Waiting for review', 'confirmed' => 'Accepted', 'processing' => 'Being prepared', 'ready' => 'Ready to send', 'completed' => 'Delivered', 'rejected' => 'Rejected', 'cancelled' => 'Cancelled'];
    $ordered = (int) $document->lines->sum('quantity_ordered');
    $packed = (int) $document->lines->sum('quantity_packed');
    $delivered = (int) $document->lines->sum('quantity_delivered');
    $rejected = (int) $document->lines->sum('quantity_rejected');
    $remaining = max(0, $ordered - $delivered - $rejected);
@endphp
<table class="header"><tr>
    <td style="width:52px"><div class="brand">OMS</div></td>
    <td class="factory"><h1>{{ $factory->name }}</h1><p>{{ $factory->email }}{{ $factory->phone ? ' | '.$factory->phone : '' }}</p><p>School garment order management</p></td>
    <td class="title"><h2>ORDER DETAILS</h2><strong>{{ $document->document_number }}</strong><p>Printed {{ now()->format('d M Y, H:i') }}</p></td>
</tr></table>

<table class="grid"><tr>
    <td class="card"><h3>School information</h3><table class="info">
        <tr><td>School name</td><td><strong>{{ $document->school?->name ?? $document->customer_name }}</strong></td></tr>
        <tr><td>District</td><td>{{ $document->school?->district ?: 'Not provided' }}</td></tr>
        <tr><td>Sector</td><td>{{ $document->school?->sector ?: 'Not provided' }}</td></tr>
        <tr><td>Contact</td><td>{{ $document->school?->contact_name ?: 'Not provided' }}</td></tr>
        <tr><td>Phone / email</td><td>{{ collect([$document->school?->phone, $document->school?->email ?? $document->customer_email])->filter()->join(' / ') ?: 'Not provided' }}</td></tr>
    </table></td>
    <td class="card"><h3>Order information</h3><table class="info">
        <tr><td>Date received</td><td><strong>{{ $document->document_date?->format('d M Y') }}</strong></td></tr>
        <tr><td>Date needed</td><td>{{ $document->due_date?->format('d M Y') ?: 'Not set' }}</td></tr>
        <tr><td>Academic year</td><td>{{ $document->academic_year ?: 'Not set' }}</td></tr>
        <tr><td>Order status</td><td><span class="status">{{ $statusLabels[$document->status] ?? ucfirst($document->status) }}</span></td></tr>
        <tr><td>Total price</td><td><strong>{{ $document->currency_code }} {{ number_format((float) $document->total_amount, 0) }}</strong></td></tr>
    </table></td>
</tr></table>

<table class="summary"><tr>
    <td><small>Ordered</small><strong>{{ number_format($ordered) }}</strong></td>
    <td><small>Ready</small><strong>{{ number_format($packed) }}</strong></td>
    <td><small>Delivered</small><strong>{{ number_format($delivered) }}</strong></td>
    <td><small>Rejected</small><strong>{{ number_format($rejected) }}</strong></td>
    <td><small>Remaining</small><strong>{{ number_format($remaining) }}</strong></td>
</tr></table>

<h3 class="section">Clothes requested</h3>
<table class="items">
    <thead><tr><th>#</th><th>Class</th><th>Type of clothing</th><th>For</th><th>Size</th><th>Color</th><th class="number">Ordered</th><th class="number">Ready</th><th class="number">Delivered</th><th class="number">Rejected</th><th class="number">Remaining</th></tr></thead>
    <tbody>@foreach($document->lines as $index => $line)<tr>
        <td>{{ $index + 1 }}</td><td>{{ $line->class_level ?: '-' }}</td><td><strong>{{ $line->garment_category }}</strong></td><td>{{ $line->gender ?: '-' }}</td><td>{{ $line->size ?: '-' }}</td><td>{{ $line->color ?: '-' }}</td>
        <td class="number">{{ number_format($line->quantity_ordered) }}</td><td class="number">{{ number_format($line->quantity_packed) }}</td><td class="number">{{ number_format($line->quantity_delivered) }}</td><td class="number">{{ number_format($line->quantity_rejected) }}</td><td class="number">{{ number_format(max(0, $line->quantity_ordered - $line->quantity_delivered - $line->quantity_rejected)) }}</td>
    </tr>@endforeach</tbody>
    <tfoot><tr><td colspan="6">ORDER TOTALS</td><td class="number">{{ number_format($ordered) }}</td><td class="number">{{ number_format($packed) }}</td><td class="number">{{ number_format($delivered) }}</td><td class="number">{{ number_format($rejected) }}</td><td class="number">{{ number_format($remaining) }}</td></tr></tfoot>
</table>
<div class="note">This document shows the latest quantities recorded in ICYEREKEZO OMS at the time it was printed.</div>
<div class="footer"><span>{{ $factory->name }} | {{ $document->document_number }}</span><span class="right">Page <span class="page-number"></span></span></div>
</body>
</html>
