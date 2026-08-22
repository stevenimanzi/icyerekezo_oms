<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Your ICYEREKEZO OMS subscription expires soon</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<!--[if mso]>
<style>* { font-family: 'Segoe UI', Arial, sans-serif !important; }</style>
<![endif]-->
</head>
<body style="margin:0; padding:0; background-color:#eef2fb; font-family:'Inter','Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef2fb; padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background-color:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 20px 45px rgba(15,32,79,0.08);">

        <tr>
          <td style="padding:32px 40px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:34px; height:34px; border-radius:10px; background:linear-gradient(145deg,#1b55dc,#467ff8); text-align:center; vertical-align:middle;">
                  <span style="color:#ffffff; font-size:16px; font-weight:700; line-height:34px;">I</span>
                </td>
                <td style="padding-left:10px; font-size:16px; font-weight:800; color:#0b1f4d; letter-spacing:-0.01em;">
                  ICYEREKEZO&nbsp;<span style="color:#2563eb;">OMS</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:28px 40px 0;">
            <p style="margin:0 0 6px; font-size:12px; font-weight:800; letter-spacing:0.14em; text-transform:uppercase; color:{{ $daysLeft <= 1 ? '#dc2626' : '#2563eb' }};">Subscription reminder</p>
            <h1 style="margin:0 0 12px; font-size:24px; line-height:1.3; color:#0b1f4d;">Hi {{ $recipientName }}, your subscription ends soon</h1>
            <p style="margin:0 0 26px; font-size:14px; line-height:1.6; color:#5b6b8c;">
              The {{ $planName }} subscription for <strong style="color:#0b1f4d;">{{ $factoryName }}</strong> ends on {{ $endsAt->format('l, F j, Y') }}. Renew before then to avoid losing access to your factory's data and workflows.
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:0 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f7ff; border:1px solid #dbe4fb; border-radius:16px;">
              <tr>
                <td align="center" style="padding:22px 20px;">
                  <span style="font-size:32px; font-weight:800; color:#12285e; font-family:'Inter','Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                    {{ $daysLeft }} {{ Str::plural('day', $daysLeft) }} left
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 40px 0;">
            <p style="margin:0; font-size:13px; line-height:1.65; color:#7a89a8;">
              Once the subscription ends, everyone on your team will lose access to {{ $factoryName }} until it is renewed. Contact your platform administrator or renew from Factory Settings to keep things running smoothly.
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:28px 40px 32px;">
            <hr style="border:none; border-top:1px solid #edf1fa; margin:0 0 20px;">
            <p style="margin:0; font-size:12px; color:#98a4bf;">
              Sent by ICYEREKEZO OMS &middot; Factory operations made clear.<br>
              Need help? Contact <a href="mailto:support@icyerekezooms.com" style="color:#2563eb; text-decoration:none;">support@icyerekezooms.com</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>
