import { apiFetch } from "./api";

export type AccountStatus = {
  user_id: string;
  account_status: "active" | "pending_delete";
  delete_requested_at: string | null;
  scheduled_delete_at: string | null;
};

export type ExportRequest = {
  id: string;
  status: string;
  export_path: string | null;
  requested_at: string;
  fulfilled_at: string | null;
  expires_at: string | null;
};

export async function getAccountStatus(): Promise<AccountStatus> {
  return apiFetch<AccountStatus>("/account/status", { auth: true });
}

export async function requestAccountDelete(graceDays = 30): Promise<AccountStatus> {
  return apiFetch<AccountStatus>("/account/delete-request", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ grace_days: graceDays }),
  });
}

export async function cancelAccountDelete(): Promise<AccountStatus> {
  return apiFetch<AccountStatus>("/account/cancel-delete", {
    method: "POST",
    auth: true,
    body: JSON.stringify({}),
  });
}

export async function requestDataExport(): Promise<void> {
  await apiFetch("/account/export-request", {
    method: "POST",
    auth: true,
    body: JSON.stringify({}),
  });
}

export async function listDataExports(): Promise<ExportRequest[]> {
  return apiFetch<ExportRequest[]>("/account/export-requests", { auth: true });
}
