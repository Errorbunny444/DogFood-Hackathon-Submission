/**
 * Production-ready, responsive, brand-aligned email templates for DOGFOOD Hackathon Platform.
 */

function wrapLayout(title: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f17; color: #e2e8f0; margin: 0; padding: 24px; }
    .container { max-width: 600px; margin: 0 auto; background: #131b2e; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; }
    .header { background: #1e293b; padding: 24px; text-align: center; border-bottom: 1px solid #334155; }
    .logo { font-size: 22px; font-weight: 800; color: #38bdf8; letter-spacing: -0.5px; }
    .content { padding: 32px 28px; line-height: 1.6; color: #cbd5e1; font-size: 15px; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .box { background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; padding: 16px; margin: 18px 0; font-family: monospace; font-size: 13px; color: #94a3b8; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">⚡ DOGFOOD Platform</div>
    </div>
    <div class="content">
      ${bodyContent}
    </div>
    <div class="footer">
      This is an automated notification from the DOGFOOD Hackathon Platform.<br>
      Auditable • Reproducible • Defensible
    </div>
  </div>
</body>
</html>`;
}

export function renderEmailVerificationEmail(params: { name: string; verifyUrl: string }) {
  const subject = 'Verify your email for DOGFOOD Hackathon Platform';
  const text = `Hello ${params.name},\n\nPlease verify your email by opening the following link:\n${params.verifyUrl}\n\nThis link will expire in 24 hours.`;
  const html = wrapLayout(
    subject,
    `<h2>Verify Your Email</h2>
    <p>Hi ${params.name},</p>
    <p>Thanks for creating an account on the DOGFOOD Hackathon Platform. Please click the button below to verify your email address:</p>
    <p style="text-align: center;">
      <a href="${params.verifyUrl}" class="btn">Verify Email Address</a>
    </p>
    <p style="font-size: 13px; color: #94a3b8;">Or copy and paste this URL into your browser:<br>
      <a href="${params.verifyUrl}" style="color: #38bdf8; word-break: break-all;">${params.verifyUrl}</a>
    </p>`
  );
  return { subject, text, html };
}

export function renderPasswordResetEmail(params: { name: string; resetUrl: string }) {
  const subject = 'Reset your password — DOGFOOD Hackathon Platform';
  const text = `Hello ${params.name},\n\nYou requested a password reset. Open the link below to set a new password:\n${params.resetUrl}\n\nIf you did not request this, you can safely ignore this email.`;
  const html = wrapLayout(
    subject,
    `<h2>Reset Your Password</h2>
    <p>Hi ${params.name},</p>
    <p>We received a request to reset your password. Click the button below to choose a new password:</p>
    <p style="text-align: center;">
      <a href="${params.resetUrl}" class="btn">Reset Password</a>
    </p>
    <p style="font-size: 13px; color: #94a3b8;">If you did not make this request, you can safely ignore this email. The reset link expires in 1 hour.</p>`
  );
  return { subject, text, html };
}

export function renderTeamInviteEmail(params: { inviterName: string; teamName: string; eventTitle: string; inviteUrl: string }) {
  const subject = `Join team "${params.teamName}" for ${params.eventTitle}`;
  const text = `${params.inviterName} has invited you to join team "${params.teamName}" for the hackathon "${params.eventTitle}".\n\nAccept invitation: ${params.inviteUrl}`;
  const html = wrapLayout(
    subject,
    `<h2>You've Been Invited to a Team!</h2>
    <p><strong>${params.inviterName}</strong> has invited you to join <strong>"${params.teamName}"</strong> for <strong>${params.eventTitle}</strong>.</p>
    <p style="text-align: center;">
      <a href="${params.inviteUrl}" class="btn">View & Accept Invitation</a>
    </p>
    <p style="font-size: 13px; color: #94a3b8;">Or open this link: <a href="${params.inviteUrl}" style="color: #38bdf8;">${params.inviteUrl}</a></p>`
  );
  return { subject, text, html };
}

export function renderJudgeAssignedEmail(params: { judgeName: string; eventTitle: string; projectCount: number; judgingUrl: string }) {
  const subject = `Judging assignments ready for ${params.eventTitle}`;
  const text = `Hello ${params.judgeName},\n\nYou have been assigned ${params.projectCount} project(s) to review for "${params.eventTitle}".\n\nAccess your judging queue: ${params.judgingUrl}`;
  const html = wrapLayout(
    subject,
    `<h2>Judging Queue Ready</h2>
    <p>Hi ${params.judgeName},</p>
    <p>You have been assigned <strong>${params.projectCount} project(s)</strong> to evaluate for <strong>${params.eventTitle}</strong>.</p>
    <p>Your scores are isolated and confidential. When you submit your reviews, you can also declare any conflicts of interest if needed.</p>
    <p style="text-align: center;">
      <a href="${params.judgingUrl}" class="btn">Open Judging Dashboard</a>
    </p>`
  );
  return { subject, text, html };
}

export function renderSubmissionReceiptEmail(params: {
  projectTitle: string;
  eventTitle: string;
  receiptId: string;
  submittedAt: string;
  sha256: string;
}) {
  const subject = `Submission Receipt: ${params.projectTitle} [${params.receiptId.slice(0, 8)}]`;
  const text = `Your project "${params.projectTitle}" was successfully submitted to "${params.eventTitle}".\n\nReceipt ID: ${params.receiptId}\nSubmitted At: ${params.submittedAt}\nCryptographic Digest (SHA-256): ${params.sha256}\n\nKeep this email for your audit records.`;
  const html = wrapLayout(
    subject,
    `<h2>Submission Confirmed! 🎉</h2>
    <p>Your project <strong>${params.projectTitle}</strong> has been successfully submitted to <strong>${params.eventTitle}</strong>.</p>
    <p>Below is your immutable cryptographic proof of submission:</p>
    <div class="box">
      <strong>Receipt ID:</strong> ${params.receiptId}<br>
      <strong>Timestamp:</strong> ${params.submittedAt}<br>
      <strong>SHA-256 Digest:</strong><br>${params.sha256}
    </div>
    <p style="font-size: 13px; color: #94a3b8;">This receipt is stored in the tamper-evident audit log. You can present this hash to organizers to verify your submission integrity at any time.</p>`
  );
  return { subject, text, html };
}

export function renderResultsPublishedEmail(params: { eventTitle: string; resultsUrl: string }) {
  const subject = `Final Results Published: ${params.eventTitle}`;
  const text = `The final results and leaderboard for "${params.eventTitle}" have been officially published!\n\nView results: ${params.resultsUrl}`;
  const html = wrapLayout(
    subject,
    `<h2>Results Are Live! 🏆</h2>
    <p>The organizers of <strong>${params.eventTitle}</strong> have officially published the judging results, rankings, and awards.</p>
    <p style="text-align: center;">
      <a href="${params.resultsUrl}" class="btn">View Public Leaderboard</a>
    </p>`
  );
  return { subject, text, html };
}
