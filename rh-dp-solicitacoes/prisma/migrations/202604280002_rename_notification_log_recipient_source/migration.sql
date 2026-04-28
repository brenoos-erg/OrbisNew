ALTER TABLE `DocumentNotificationLog`
  CHANGE COLUMN `recipientOrigin` `recipientSource` ENUM('author','approverGroup','qualityReviewers','ownerDepartment','ownerCostCenter','distributionTargets','fixedEmails') NOT NULL;
