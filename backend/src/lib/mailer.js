import sgMail from '@sendgrid/mail'

sgMail.setApiKey(process.env.SENDGRID_API_KEY)

export async function sendAlertEmail({ to, signal, account, contact }) {
  const subject = `Signal: ${signal.title} — ${account.name}`

  const contactLine = contact
    ? `<p><strong>Contact:</strong> ${contact.name} (${contact.tag})</p>`
    : ''

  const html = `
    <h2>Intent Signal: ${account.name}</h2>
    <p><strong>Signal:</strong> ${signal.title}</p>
    ${contactLine}
    <p>${signal.detail || ''}</p>
    ${signal.source_url ? `<p><a href="${signal.source_url}">View source</a></p>` : ''}
    <p><strong>Loss reason:</strong> ${account.loss_reason.replace(/_/g, ' ')}</p>
    <hr>
    <p style="color:#888;font-size:12px">Signal — intent tracker</p>
  `

  const recipients = Array.isArray(to) ? to : [to]

  await sgMail.send({
    to: recipients,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject,
    html,
  })
}
