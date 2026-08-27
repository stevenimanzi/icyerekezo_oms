<!DOCTYPE html>
<html>
<head>
    <title>School Order Notification</title>
</head>
<body>
    <p>Dear {{ $document->customer_name }},</p>

    @if($eventType === 'placed')
        <p>Your order (<strong>{{ $document->document_number }}</strong>) has been successfully placed and is pending review by the factory.</p>
    @elseif($eventType === 'status_updated')
        <p>The status of your order (<strong>{{ $document->document_number }}</strong>) has been updated to: <strong>{{ ucfirst($document->status) }}</strong>.</p>
    @else
        <p>There is an update regarding your order (<strong>{{ $document->document_number }}</strong>).</p>
    @endif

    <p>Thank you for choosing us.</p>

    <p>Best regards,<br>
    Noguchi Holdings Ltd</p>
</body>
</html>
