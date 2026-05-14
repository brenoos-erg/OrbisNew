import { SolicitationStatus } from "@prisma/client";

const VALID_SOLICITATION_STATUSES = new Set(Object.values(SolicitationStatus));

export function onlyValidSolicitationStatuses(
  values: string[],
): SolicitationStatus[] {
  return values.filter((value): value is SolicitationStatus =>
    VALID_SOLICITATION_STATUSES.has(value as SolicitationStatus),
  );
}

export function isValidSolicitationStatus(
  value?: string | null,
): value is SolicitationStatus {
  return (
    Boolean(value) &&
    VALID_SOLICITATION_STATUSES.has(value as SolicitationStatus)
  );
}
