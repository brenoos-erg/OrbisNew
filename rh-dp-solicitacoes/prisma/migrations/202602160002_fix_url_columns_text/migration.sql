ALTER TABLE `DocumentAssignment`
  MODIFY `signingUrl` TEXT NULL,
  MODIFY `signingReturnUrl` TEXT NULL,
  MODIFY `auditTrailUrl` TEXT NULL,
  MODIFY `signingExternalId` TEXT NULL;

ALTER TABLE `Document`
  MODIFY `pdfUrl` TEXT NULL;

ALTER TABLE `Attachment`
  MODIFY `url` TEXT NOT NULL;

ALTER TABLE `RefusalAttachment`
  MODIFY `url` TEXT NOT NULL;

ALTER TABLE `WorkRefusalAttachment`
  MODIFY `url` TEXT NOT NULL;

ALTER TABLE `NonConformityAttachment`
  MODIFY `url` TEXT NOT NULL;