# Plano de adequação solicitado pela Qualidade

Esta branch consolida as solicitações do setor de Qualidade para o módulo de Controle de Documentos e funcionalidades relacionadas.

## Escopo

1. Garantir que documentos publicados e ativos apareçam corretamente na listagem.
2. Restringir cancelamento e exclusão documental aos responsáveis autorizados da Qualidade.
3. Criar filtro ou área dedicada para documentos cancelados.
4. Permitir que o setor de Qualidade baixe o arquivo original do documento.
5. Corrigir falhas de preparação do PDF controlado, incluindo o caso DD.QUA.014.
6. Exibir claramente o status da Solicitação de Gestão de Mudanças.
7. Permitir anexar evidências em planos de ação avulsos.

## Critérios de segurança

- não alterar ou apagar dados existentes;
- não executar seed automaticamente;
- não executar migrations durante a inicialização do sistema;
- manter histórico e rastreabilidade das ações;
- exigir autorização no backend, não apenas ocultar botões na interface;
- não fazer merge antes de build e testes passarem.
