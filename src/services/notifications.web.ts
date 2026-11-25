import { emitNotice, type AlertNotice } from '@/services/notices';

export async function notificationPermission(): Promise<boolean> {
  return false;
}

export async function publishAlert(notice: AlertNotice, _system: boolean): Promise<void> {
  emitNotice(notice);
}
