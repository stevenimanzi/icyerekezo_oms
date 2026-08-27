<?php

namespace App\Mail;

use App\Models\SalesDocument;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class SchoolOrderNotificationMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public SalesDocument $document,
        public string $eventType
    ) {}

    public function envelope(): Envelope
    {
        $subject = match ($this->eventType) {
            'placed' => 'School Order Placed Successfully - ' . $this->document->document_number,
            'status_updated' => 'School Order Status Updated - ' . $this->document->document_number,
            default => 'School Order Notification - ' . $this->document->document_number,
        };

        return new Envelope(
            subject: $subject,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.school-order-notification',
            with: [
                'document' => $this->document,
                'eventType' => $this->eventType,
            ]
        );
    }
}
