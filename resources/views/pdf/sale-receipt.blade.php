<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Receipt {{ $document->document_number }}</title>
    <style>
        @page { margin: 22px 26px; }
        body { font-family: DejaVu Sans, sans-serif; font-size: 10px; color: #1f2937; }
        h1 { margin: 0; font-size: 17px; color: #111827; }
        .muted { color: #6b7280; }
        .head { width: 100%; border-bottom: 2px solid #2563eb; padding-bottom: 8px; margin-bottom: 10px; }
        .head td { vertical-align: top; }
        .right { text-align: right; }
        .tag { display: inline-block; padding: 2px 8px; border-radius: 8px; background: #eff6ff; color: #1d4ed8; font-weight: bold; font-size: 9px; }
        .info { width: 100%; margin-bottom: 10px; }
        .info td { padding: 2px 0; }
        table.lines { width: 100%; border-collapse: collapse; margin-top: 6px; }
        table.lines th { background: #f3f4f6; color: #374151; font-size: 9px; text-align: left; padding: 6px 7px; border-bottom: 1px solid #d1d5db; }
        table.lines td { padding: 6px 7px; border-bottom: 1px solid #e5e7eb; }
        .totals { width: 55%; margin-left: 45%; margin-top: 10px; border-collapse: collapse; }
        .totals td { padding: 4px 7px; }
        .totals .grand td { border-top: 2px solid #111827; font-size: 12px; font-weight: bold; }
        .balance { color: #b91c1c; font-weight: bold; }
        .paid { color: #15803d; font-weight: bold; }
        .foot { margin-top: 18px; text-align: center; color: #6b7280; font-size: 9px; }
    </style>
</head>
<body>
@php
    $currency = $document->currency_code ?: 'RWF';
    $money = fn ($value) => $currency.' '.number_format((float) $value, 0);
    $subtotal = (float) $document->total_amount + (float) $document->discount_amount;
    $balance = (float) $document->total_amount - (float) $document->paid_amount;
@endphp

<table class="head">
    <tr>
        <td>
            <h1>{{ $factory?->name }}</h1>
            @if ($factory?->phone)<div class="muted">{{ $factory->phone }}</div>@endif
            @if ($factory?->email)<div class="muted">{{ $factory->email }}</div>@endif
        </td>
        <td class="right">
            <div class="tag">{{ $document->status === 'cancelled' ? 'CANCELLED' : 'RECEIPT' }}</div>
            <div style="margin-top:4px;font-size:13px;font-weight:bold;">{{ $document->document_number }}</div>
            <div class="muted">{{ $document->document_date?->format('d M Y') }}</div>
        </td>
    </tr>
</table>

<table class="info">
    <tr>
        <td><span class="muted">Customer:</span> <b>{{ $document->customer_name }}</b></td>
        <td class="right"><span class="muted">Served by:</span> {{ $document->creator?->name ?? '—' }}</td>
    </tr>
    @if ($document->customer_phone)
        <tr><td colspan="2"><span class="muted">Phone:</span> {{ $document->customer_phone }}</td></tr>
    @endif
</table>

<table class="lines">
    <thead>
        <tr>
            <th>Product</th>
            <th class="right">Qty</th>
            <th class="right">Unit price</th>
            <th class="right">Amount</th>
        </tr>
    </thead>
    <tbody>
        @foreach ($document->lines as $line)
            <tr>
                <td>{{ $line->item?->name ?? 'Item' }}</td>
                <td class="right">{{ $line->quantity_ordered }} {{ $line->item?->unit?->symbol }}</td>
                <td class="right">{{ number_format((float) $line->unit_price, 0) }}</td>
                <td class="right">{{ number_format((float) $line->line_total, 0) }}</td>
            </tr>
        @endforeach
    </tbody>
</table>

<table class="totals">
    <tr><td class="muted">Subtotal</td><td class="right">{{ $money($subtotal) }}</td></tr>
    @if ((float) $document->discount_amount > 0)
        <tr><td class="muted">Discount</td><td class="right">- {{ $money($document->discount_amount) }}</td></tr>
    @endif
    <tr class="grand"><td>Total</td><td class="right">{{ $money($document->total_amount) }}</td></tr>
    <tr><td class="muted">Paid</td><td class="right paid">{{ $money($document->paid_amount) }}</td></tr>
    @if ($balance > 0 && $document->status !== 'cancelled')
        <tr><td class="muted">Balance to pay</td><td class="right balance">{{ $money($balance) }}</td></tr>
    @endif
</table>

@if ($document->payments->count())
    <p class="muted" style="margin-top:14px;margin-bottom:3px;">Payments</p>
    @foreach ($document->payments as $payment)
        <div>{{ $payment->paid_on?->format('d M Y') }} · {{ ucwords(str_replace('_', ' ', $payment->method)) }} · {{ $money($payment->amount) }}@if ($payment->reference) · {{ $payment->reference }}@endif</div>
    @endforeach
@endif

@if ($document->notes)
    <p class="muted" style="margin-top:12px;">Note: {{ $document->notes }}</p>
@endif

<div class="foot">Thank you for your purchase.</div>
</body>
</html>
