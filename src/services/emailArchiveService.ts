import { ProductionRelease, getReleaseItemPoints } from '@/types';
import { formatDate } from '@/utils';

export interface SendArchiveEmailResult {
  success: boolean;
  messageId: string;
  subject: string;
  recipients: string[];
}

/**
 * Generates structured, responsive, and readable HTML content for completed release archives.
 */
export function generateReleaseArchiveHtml(
  releases: ProductionRelease[],
  deletedBy: string,
  deletedByName: string,
  reason?: string
): string {
  const deletionTimestamp = new Date().toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'long',
  });

  const totalReleases = releases.length;
  const totalChanges = releases.reduce((acc, r) => acc + (r.items?.length || 0), 0);
  const totalPoints = releases.reduce(
    (acc, r) => acc + (r.items || []).reduce((ptAcc, it) => ptAcc + (getReleaseItemPoints(it).length), 0),
    0
  );

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Apex Tasks – Completed Release Verification Archive</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #09090b; color: #f4f4f5; margin: 0; padding: 24px; line-height: 1.5; }
    .container { max-width: 800px; margin: 0 auto; background-color: #18181b; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px 24px; text-align: left; }
    .header h1 { margin: 0 0 8px; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.025em; }
    .header p { margin: 0; font-size: 13px; color: #e0e7ff; }
    .meta-box { background-color: #27272a; border-bottom: 1px solid #3f3f46; padding: 18px 24px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; font-size: 12px; }
    .meta-box div { color: #a1a1aa; }
    .meta-box strong { color: #f4f4f5; }
    .content { padding: 24px; }
    .release-card { background-color: #1e1e24; border: 1px solid #3f3f46; border-radius: 12px; margin-bottom: 24px; overflow: hidden; }
    .release-header { background-color: #27272a; padding: 16px 20px; border-bottom: 1px solid #3f3f46; }
    .release-header h2 { margin: 0 0 4px; font-size: 16px; font-weight: 700; color: #a78bfa; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .badge-completed { background-color: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); }
    .badge-passed { background-color: rgba(16, 185, 129, 0.2); color: #34d399; }
    .badge-failed { background-color: rgba(239, 68, 68, 0.2); color: #f87171; }
    .badge-task { background-color: rgba(99, 102, 241, 0.2); color: #818cf8; font-family: monospace; border: 1px solid rgba(99, 102, 241, 0.4); padding: 2px 6px; }
    .change-item { padding: 18px 20px; border-bottom: 1px solid #27272a; }
    .change-item:last-child { border-bottom: none; }
    .change-title { font-size: 14px; font-weight: 700; color: #f4f4f5; margin-bottom: 6px; }
    .points-table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11px; }
    .points-table th { background-color: #27272a; text-align: left; padding: 8px 10px; color: #a1a1aa; font-weight: 600; text-transform: uppercase; font-size: 10px; }
    .points-table td { padding: 8px 10px; border-bottom: 1px solid #2e2e38; }
    .comment-bubble { background-color: #27272a; border-left: 3px solid #6366f1; padding: 6px 10px; margin-top: 6px; font-size: 11px; color: #cbd5e1; border-radius: 0 6px 6px 0; }
    .footer { text-align: center; padding: 24px; font-size: 11px; color: #71717a; border-top: 1px solid #27272a; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Apex Tasks – Completed Release Verification Archive</h1>
      <p>Official historical audit record of completed production release verification data.</p>
    </div>

    <div class="meta-box">
      <div><strong>Deleted By:</strong> ${deletedByName} (${deletedBy})</div>
      <div><strong>Archived Date & Time:</strong> ${deletionTimestamp}</div>
      <div><strong>Total Releases Archived:</strong> ${totalReleases}</div>
      <div><strong>Total Project Changes:</strong> ${totalChanges} (${totalPoints} points)</div>
      ${reason ? `<div style="grid-column: span 2;"><strong>Deletion Reason:</strong> <em>${reason}</em></div>` : ''}
    </div>

    <div class="content">
      ${releases.map((rel, rIdx) => {
        const pointsTotal = (rel.items || []).reduce((acc, it) => acc + getReleaseItemPoints(it).length, 0);
        return `
        <div class="release-card">
          <div class="release-header">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <h2>#${rIdx + 1}. ${rel.name}</h2>
              <span class="badge badge-completed">Completed</span>
            </div>
            <div style="font-size: 11px; color: #a1a1aa;">
              <span>Release ID: <code style="color: #cbd5e1;">${rel.id || 'N/A'}</code></span> &bull; 
              <span>Release Date: <strong>${rel.releaseDate}</strong></span> &bull; 
              <span>Created by: <strong>${rel.createdByName}</strong> (${formatDate(rel.createdDate)})</span>
            </div>
          </div>

          <div>
            ${(rel.items || []).map((change, cIdx) => {
              const points = getReleaseItemPoints(change);
              return `
              <div class="change-item">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                  <div>
                    <span style="font-size: 10px; font-weight: bold; background-color: rgba(99, 102, 241, 0.15); color: #818cf8; padding: 2px 6px; border-radius: 4px;">${change.projectName}</span>
                    <strong class="change-title" style="margin-left: 6px;">${change.title}</strong>
                  </div>
                  <span style="font-size: 11px; color: #a1a1aa;">Dev: <strong>${change.developerName}</strong></span>
                </div>

                ${change.description ? `<p style="font-size: 11px; color: #a1a1aa; margin: 4px 0 8px;">${change.description}</p>` : ''}

                <table class="points-table">
                  <thead>
                    <tr>
                      <th style="width: 25px;">#</th>
                      <th>Change / Verification Point</th>
                      <th style="width: 80px;">QA Status</th>
                      <th style="width: 140px;">Verified By / Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${points.map((pt, pIdx) => {
                      const isPassed = pt.status === 'Passed';
                      const isFailed = pt.status === 'Failed';
                      return `
                      <tr>
                        <td style="color: #71717a; text-align: center;">${pIdx + 1}</td>
                        <td>
                          ${pt.taskId ? `<span class="badge badge-task">${pt.taskId}</span> ` : ''}
                          <span style="color: #f4f4f5;">${pt.text}</span>
                          ${pt.developerComment ? `
                            <div class="comment-bubble">
                              <strong>Developer Note:</strong> ${pt.developerComment}
                            </div>
                          ` : ''}
                        </td>
                        <td>
                          <span class="badge ${isPassed ? 'badge-passed' : isFailed ? 'badge-failed' : ''}">${pt.status}</span>
                        </td>
                        <td style="color: #a1a1aa; font-size: 10px;">
                          ${pt.qaUserName ? `${pt.qaUserName}` : 'N/A'}<br/>
                          ${pt.qaDate ? formatDate(pt.qaDate) : ''}
                        </td>
                      </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
              `;
            }).join('')}
          </div>
        </div>
        `;
      }).join('')}
    </div>

    <div class="footer">
      <p>This automated archive was generated and transmitted by Apex Tasks prior to purging the selected completed release verification records.</p>
      <p>All underlying developer tasks, project records, and codebase assets remain untouched and authoritative.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Checks server-side SMTP configuration status and connectivity.
 */
export async function checkSmtpStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  host?: string;
  missing?: string[];
  error?: string;
  message?: string;
}> {
  try {
    const res = await fetch('/api/send-email', { method: 'GET' });
    const data = await res.json();
    return {
      configured: data.configured ?? false,
      connected: data.connected ?? false,
      host: data.host,
      missing: data.missing,
      error: data.error,
      message: data.message
    };
  } catch (err: any) {
    return {
      configured: false,
      connected: false,
      error: err?.message || 'Unable to check SMTP status'
    };
  }
}

/**
 * Sends a safe test email to verify SMTP delivery without affecting any release records.
 */
export async function testSmtpEmail(recipient: string): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'test-email', to: recipient })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to send test email.' };
    }
    return { success: true, messageId: data.messageId };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error sending test email.' };
  }
}

/**
 * Sends the email archive to the current user and administrator.
 * Throws an Error if email transmission fails, ensuring zero data loss.
 */
export async function sendReleaseArchiveEmail(options: {
  releases: ProductionRelease[];
  deleteMode: 'individual' | 'bulk' | 'all';
  deletedBy: string;
  deletedByName: string;
  reason?: string;
  additionalRecipients?: string[];
}): Promise<SendArchiveEmailResult> {
  const { releases, deleteMode, deletedBy, deletedByName, reason, additionalRecipients } = options;

  if (!releases || releases.length === 0) {
    throw new Error('No completed releases provided for archival.');
  }

  // 1. Determine Subject Line per exact requirements
  let subject = '';
  if (deleteMode === 'individual') {
    const singleRelease = releases[0];
    subject = `Apex Tasks – Completed Release Verification Archive – ${singleRelease.name}`;
  } else if (deleteMode === 'bulk') {
    subject = `Apex Tasks – Completed Release Verification Archive – ${releases.length} Records`;
  } else {
    const todayFormatted = new Date().toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    subject = `Apex Tasks – Archive of All Completed Release Verifications – ${todayFormatted}`;
  }

  // 2. Generate HTML
  const html = generateReleaseArchiveHtml(releases, deletedBy, deletedByName, reason);

  // 3. Recipients: User who initiated deletion + Head Email / Administrators
  const recipientsList = [deletedBy];
  if (additionalRecipients && additionalRecipients.length > 0) {
    recipientsList.push(...additionalRecipients);
  }

  // 4. Send via server-side /api/send-email
  const response = await fetch('/api/send-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: recipientsList,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    let errorDetail = 'Failed to transmit archive email.';
    try {
      const errJson = await response.json();
      if (errJson?.error) errorDetail = errJson.error;
    } catch {
      // Ignore json parse error
    }
    throw new Error(`Email archive failed: ${errorDetail} Records were NOT deleted.`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(`Email archive rejected: ${result.error || 'Unknown error'}. Records were NOT deleted.`);
  }

  return {
    success: true,
    messageId: result.messageId || 'unknown',
    subject,
    recipients: recipientsList,
  };
}
