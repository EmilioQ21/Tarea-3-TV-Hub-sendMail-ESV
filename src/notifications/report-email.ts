import nodemailer, { type SendMailOptions, type Transporter } from 'nodemailer';
import { env } from '../config/env.js';

type ReportEmailData = {
  reason: string;
  description: string;
  status: string;
  createdAt: Date;
  evidenceUrls: string[];
};

let transporterPromise: Promise<Transporter> | undefined;
let usesEthereal = false;

async function getTransporter(): Promise<Transporter> {
  if (transporterPromise) return transporterPromise;

  transporterPromise = (async () => {
    if (env.nodeEnv === 'test') {
      return nodemailer.createTransport({ jsonTransport: true });
    }

    if (env.smtpHost) {
      usesEthereal = false;
      return nodemailer.createTransport({
        host: env.smtpHost,
        port: env.smtpPort,
        secure: env.smtpPort === 465,
        auth: env.smtpUser && env.smtpPass ? { user: env.smtpUser, pass: env.smtpPass } : undefined
      });
    }

    usesEthereal = true;
    const account = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: { user: account.user, pass: account.pass }
    });
  })();

  return transporterPromise;
}

async function sendWithTransporter(message: SendMailOptions): Promise<void> {
  const transporter = await getTransporter();
  const info = await transporter.sendMail(message);

  if (usesEthereal) {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log(`Email preview: ${previewUrl}`);
  }
}

export async function sendReportCreatedEmail(report: ReportEmailData, channelName: string): Promise<void> {
  const evidence = report.evidenceUrls.length
    ? `\n\nEvidence:\n${report.evidenceUrls.join('\n')}`
    : '';

  await sendWithTransporter({
    from: env.smtpFrom,
    to: env.reportNotificationEmail,
    subject: `TV Hub - New Report: ${channelName} (${report.reason})`,
    text: [
      'TV Hub - New Report',
      '',
      `Channel: ${channelName}`,
      `Reason: ${report.reason}`,
      `Description: ${report.description}`,
      `Status: ${report.status}`,
      `Created date: ${report.createdAt.toISOString()}`
    ].join('\n') + evidence
  });
}

export async function sendReportResolvedEmail(report: ReportEmailData, channelName: string, recipient: string): Promise<void> {
  await sendWithTransporter({
    from: env.smtpFrom,
    to: recipient,
    subject: `TV Hub - Your Report Was Resolved: ${channelName} (${report.reason})`,
    text: [
      'TV Hub - Your Report Was Resolved',
      '',
      'Support has resolved your report.',
      '',
      `Channel: ${channelName}`,
      `Reason: ${report.reason}`,
      `Description: ${report.description}`,
      `Final status: ${report.status}`,
      `Created date: ${report.createdAt.toISOString()}`
    ].join('\n')
  });
}
