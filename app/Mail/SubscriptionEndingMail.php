<?php

namespace App\Mail;

use App\Models\FactorySubscription;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Mail\Mailables\Address;

class SubscriptionEndingMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(public FactorySubscription $subscription)
    {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Action Required: Your Factory Subscription is Ending in 5 Days',
        );
    }

    public function content(): Content
    {
        return new Content(
            htmlString: "
            <div style='font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;'>
                <h2 style='color: #d97706;'>Subscription Expiring Soon</h2>
                <p>Hello,</p>
                <p>This is a friendly reminder that the subscription for <strong>{$this->subscription->factory->name}</strong> will expire in exactly <strong>5 days</strong> on <strong>{$this->subscription->ends_at->format('M d, Y')}</strong>.</p>
                <p>Please contact the platform administrator to renew your subscription and avoid any interruption to your factory operations.</p>
                <p>If your subscription is not renewed, your factory will be suspended and all users will lose access to the system.</p>
                <br>
                <p>Thank you,</p>
                <p><strong>ICYEREKEZO OMS</strong></p>
            </div>
            "
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
