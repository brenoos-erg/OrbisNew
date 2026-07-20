import {
  canApproveSolicitation,
  canAssumeSolicitation,
  canCancelSolicitation,
  canCommentSolicitation,
  canEditSolicitation,
  canFinalizeSolicitation,
  type SolicitationAccessLike,
  type UserAccessContext,
} from './solicitationAccessPolicy'

export type SolicitationRouteAction =
  | 'assumir'
  | 'comentarios'
  | 'atualizarCampos'
  | 'anexos'
  | 'aprovar'
  | 'reprovar'
  | 'finalizar'
  | 'cancelar'

type WriteOperation<T> = () => Promise<T> | T

type AuthorizedWriteResult<T> =
  | { ok: true; status: 200; value: T }
  | { ok: false; status: 403; error: string }

const ACTION_ERRORS: Record<SolicitationRouteAction, string> = {
  assumir: 'Você não possui permissão para assumir este chamado.',
  comentarios: 'Você não possui permissão para registrar observações nesta solicitação.',
  atualizarCampos: 'Você não possui permissão para editar esta solicitação.',
  anexos: 'Você não possui permissão para alterar anexos desta solicitação.',
  aprovar: 'Você não possui permissão para aprovar esta solicitação.',
  reprovar: 'Você não possui permissão para reprovar esta solicitação.',
  finalizar: 'Você não possui permissão para finalizar esta solicitação.',
  cancelar: 'Você não possui permissão para cancelar esta solicitação.',
}

export function canExecuteSolicitationRouteAction(
  action: SolicitationRouteAction,
  ctx: UserAccessContext,
  solicitation: SolicitationAccessLike,
) {
  switch (action) {
    case 'assumir':
      return canAssumeSolicitation(ctx, solicitation)
    case 'comentarios':
      return canCommentSolicitation(ctx, solicitation)
    case 'atualizarCampos':
    case 'anexos':
      return canEditSolicitation(ctx, solicitation)
    case 'aprovar':
    case 'reprovar':
      return canApproveSolicitation(ctx, solicitation)
    case 'finalizar':
      return canFinalizeSolicitation(ctx, solicitation)
    case 'cancelar':
      return canCancelSolicitation(ctx, solicitation)
  }
}

export async function executeAuthorizedSolicitationRouteWrite<T>(params: {
  action: SolicitationRouteAction
  ctx: UserAccessContext
  solicitation: SolicitationAccessLike
  write: WriteOperation<T>
}): Promise<AuthorizedWriteResult<T>> {
  if (!canExecuteSolicitationRouteAction(params.action, params.ctx, params.solicitation)) {
    return { ok: false, status: 403, error: ACTION_ERRORS[params.action] }
  }

  return { ok: true, status: 200, value: await params.write() }
}
