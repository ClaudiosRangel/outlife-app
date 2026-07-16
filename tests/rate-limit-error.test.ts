import { describe, expect, it } from 'vitest';
import { mapRateLimitErrorToMessage } from '../src/lib/rate-limit-error';

/**
 * Unit test da task 17.6 do spec outlife-production-plan.
 *
 * Simula o erro ERRCODE `P0429` (Rate_Limiting_Policy, Requirement 12.2)
 * retornado pela RPC e confirma a mensagem de UI exibida. Como
 * `mapRateLimitErrorToMessage` é uma função pura (sem I/O), não há chamada
 * adicional de efeito a verificar — apenas o valor de retorno.
 */

const RATE_LIMIT_MESSAGE = 'Limite atingido, tente novamente em alguns instantes';

describe('mapRateLimitErrorToMessage (Rate_Limiting_Policy UI mapping)', () => {
  it('retorna a mensagem de UI para o erro P0429', () => {
    expect(mapRateLimitErrorToMessage({ code: 'P0429' })).toBe(RATE_LIMIT_MESSAGE);
  });

  it('retorna null para outros códigos de erro conhecidos', () => {
    expect(mapRateLimitErrorToMessage({ code: '23505' })).toBeNull();
    expect(mapRateLimitErrorToMessage({ code: 'PGRST116' })).toBeNull();
  });

  it('retorna null sem lançar para entradas degeneradas', () => {
    expect(mapRateLimitErrorToMessage(null)).toBeNull();
    expect(mapRateLimitErrorToMessage(undefined)).toBeNull();
    expect(mapRateLimitErrorToMessage('some string error')).toBeNull();
    expect(mapRateLimitErrorToMessage(42)).toBeNull();
    expect(mapRateLimitErrorToMessage({})).toBeNull();
    expect(mapRateLimitErrorToMessage({ message: 'sem propriedade code' })).toBeNull();
  });
});
