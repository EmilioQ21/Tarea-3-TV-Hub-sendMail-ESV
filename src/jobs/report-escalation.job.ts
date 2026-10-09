import cron from 'node-cron';
import { env } from '../config/env.js';
import { Report } from '../models/report.model.js';
import { emitReportUpdated } from '../realtime/socket.js';

export async function escalateOldReports(): Promise<number> {
  const threshold = new Date(Date.now() - env.reportEscalationMinutes * 60 * 1000);

  const reports = await Report.find({
    status: 'OPEN',
    createdAt: { $lte: threshold },
  });

  for (const report of reports) {
    report.status = 'ESCALATED';
    await report.save();
    emitReportUpdated(String(report.userId), report.toObject());
  }

  return reports.length;
}

export function startReportEscalationJob(): void {
  cron.schedule(env.reportEscalationCron, async () => {
    try {
      const escalated = await escalateOldReports();
      if (escalated > 0) console.log(`Escalation job: ${escalated} report(s) escalated`);
    } catch (error) {
      console.error('Escalation job failed:', error);
    }
  });
}