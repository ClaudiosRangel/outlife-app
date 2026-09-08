// Modelo puro da regra de visibilidade da VIEW `public_user_locations_live`
// para a feature "Amigos em Atividade ao Vivo".
//
// Esta função espelha, em lógica pura e testável, exatamente a cláusula de
// visibilidade que a VIEW impõe no banco (`security_invoker=on`):
//
//   location_sharing_mode = 'public'
//   OR (location_sharing_mode = 'friends' AND are_friends(observador, publicador))
//   OR observador = publicador (self)
//
// Manter esta cópia pura permite validar a regra por testes de propriedade
// (fast-check) sem depender de um Postgres real, e serve de documentação
// executável do contrato de privacidade (Requirements 5.1, 5.2, 5.5).

import type { LocationSharingMode } from "@/lib/api";

/**
 * Regra pura de visibilidade da posição ao vivo (Requirements 5.1, 5.2, 5.5).
 *
 * Retorna `true` SE E SOMENTE SE:
 * - o modo de compartilhamento do publicador é `public`; OU
 * - o modo é `friends` E existe amizade aceita entre observador e publicador
 *   (`areFriends`); OU
 * - o observador é o próprio publicador (`isSelf`).
 *
 * Em particular: modo `friends` sem amizade aceita oculta a posição (Req 5.2),
 * e modo `none` oculta para qualquer observador que não seja o próprio (Req 5.5).
 */
export function canView(input: {
  mode: LocationSharingMode;
  areFriends: boolean;
  isSelf: boolean;
}): boolean {
  return (
    input.mode === "public" ||
    (input.mode === "friends" && input.areFriends) ||
    input.isSelf
  );
}
