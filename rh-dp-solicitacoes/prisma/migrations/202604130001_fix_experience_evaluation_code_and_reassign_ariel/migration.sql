UPDATE `TipoSolicitacao`
SET `codigo` = 'RQ.RH.103'
WHERE `id` = 'RQ_RH_103'
  AND `codigo` <> 'RQ.RH.103';

UPDATE `Solicitation` s
JOIN (
  SELECT `id`, `fullName`
  FROM `User`
  WHERE TRIM(`fullName`) = 'Ariel'
  ORDER BY `createdAt` ASC
  LIMIT 1
) ariel ON 1 = 1
SET
  s.`approverId` = ariel.`id`,
  s.`payload` = JSON_SET(
    COALESCE(s.`payload`, JSON_OBJECT()),
    '$.campos.gestorImediatoAvaliadorId', ariel.`id`,
    '$.campos.gestorImediatoAvaliador', ariel.`fullName`
  ),
  s.`updatedAt` = NOW()
WHERE s.`tipoId` = 'RQ_RH_103'
  AND s.`protocolo` IN ('RQ2026-00203', 'RQ2026-00210', 'RQ2026-00217');

INSERT INTO `SolicitationTimeline` (`id`, `solicitationId`, `status`, `message`, `createdAt`)
SELECT
  UUID(),
  s.`id`,
  s.`status`,
  CONCAT(
    'Reatribuição administrativa do gestor imediato avaliador para ',
    ariel.`fullName`,
    ' (',
    ariel.`id`,
    ').'
  ),
  NOW()
FROM `Solicitation` s
JOIN (
  SELECT `id`, `fullName`
  FROM `User`
  WHERE TRIM(`fullName`) = 'Ariel'
  ORDER BY `createdAt` ASC
  LIMIT 1
) ariel ON 1 = 1
WHERE s.`tipoId` = 'RQ_RH_103'
  AND s.`protocolo` IN ('RQ2026-00203', 'RQ2026-00210', 'RQ2026-00217');