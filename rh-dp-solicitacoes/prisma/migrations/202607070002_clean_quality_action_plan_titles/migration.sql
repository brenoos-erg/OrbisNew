-- Remove o número do plano de títulos legados quando ele foi salvo duplicado no campo titulo.
UPDATE `QualityActionPlan`
SET `titulo` = TRIM(SUBSTRING(`titulo`, CHAR_LENGTH(CONCAT(`numeroPlano`, ' - ')) + 1))
WHERE `numeroPlano` IS NOT NULL
  AND `numeroPlano` <> ''
  AND `titulo` LIKE CONCAT(`numeroPlano`, ' - %');

UPDATE `QualityActionPlan`
SET `titulo` = TRIM(SUBSTRING(`titulo`, CHAR_LENGTH(CONCAT(`numeroPlano`, ' – ')) + 1))
WHERE `numeroPlano` IS NOT NULL
  AND `numeroPlano` <> ''
  AND `titulo` LIKE CONCAT(`numeroPlano`, ' – %');
