import { describe, it, expect, vi, afterEach } from 'vitest';
import fc from 'fast-check';

import { fetchDestinationsHandler, fetchPlacesPhotosHandler } from '@/services/places.server';

/**
 * Task 12.4 do spec outlife-production-plan.
 *
 * `fetchDestinationsFromGooglePlaces`/`fetchPlacesPhotosFromGooglePlaces`
 * (src/services/places.server.ts) são TanStack Start server functions
 * (`createServerFn`), que exigem o runtime do TanStack Start
 * (AsyncLocalStorage) para serem invocadas — não podem ser chamadas
 * diretamente em ambiente de teste vitest fora desse contexto. Por isso,
 * a lógica pura dos handlers foi extraída para `fetchDestinationsHandler`/
 * `fetchPlacesPhotosHandler`, testadas aqui diretamente; o comportamento de
 * produção permanece idêntico, já que `createServerFn(...).handler(...)`
 * apenas delega para essas mesmas funções.
 *
 * **Validates: Requirements 6.4, 6.5**
 */

const ORIGINAL_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

afterEach(() => {
  if (ORIGINAL_API_KEY === undefined) {
    delete process.env.GOOGLE_PLACES_API_KEY;
  } else {
    process.env.GOOGLE_PLACES_API_KEY = ORIGINAL_API_KEY;
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Valores de credencial ausente/vazia/só espaços — nenhum deve autenticar uma chamada real. */
const missingCredentialArbitrary = fc.oneof(
  fc.constant(undefined),
  fc.constant(''),
  fc.constantFrom(' ', '   ', '\t', '\n', '  \t \n '),
);

const validApiKeyArbitrary = fc
  .string({ minLength: 1, maxLength: 40 })
  .filter((s) => s.trim().length > 0);

const httpErrorStatusArbitrary = fc.oneof(
  fc.integer({ min: 400, max: 499 }),
  fc.integer({ min: 500, max: 599 }),
);

const networkErrorArbitrary = fc.oneof(
  fc.constant(new TypeError('Failed to fetch')),
  fc.constant(new Error('ECONNRESET')),
  fc.string().map((message) => new Error(message)),
);

describe('Google_Places_Integration — resiliência (fetchDestinationsFromGooglePlaces)', () => {
  it(
    // Feature: outlife-production-plan, Property 11: Resiliência da Google_Places_Integration a qualquer falha
    'com credencial ausente/vazia/só espaços, resolve com [] e nunca chama fetch',
    async () => {
      await fc.assert(
        fc.asyncProperty(missingCredentialArbitrary, async (missingKey) => {
          if (missingKey === undefined) {
            delete process.env.GOOGLE_PLACES_API_KEY;
          } else {
            process.env.GOOGLE_PLACES_API_KEY = missingKey;
          }
          const fetchSpy = vi.fn();
          vi.stubGlobal('fetch', fetchSpy);

          const result = await fetchDestinationsHandler({ query: 'trilha' });

          expect(result).toEqual([]);
          expect(fetchSpy).not.toHaveBeenCalled();
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    // Feature: outlife-production-plan, Property 11: Resiliência da Google_Places_Integration a qualquer falha
    'com credencial presente mas fetch rejeitando (erro de rede), resolve com [] sem lançar',
    async () => {
      await fc.assert(
        fc.asyncProperty(validApiKeyArbitrary, networkErrorArbitrary, async (apiKey, networkError) => {
          process.env.GOOGLE_PLACES_API_KEY = apiKey;
          vi.stubGlobal('fetch', vi.fn().mockRejectedValue(networkError));

          await expect(fetchDestinationsHandler({ query: 'trilha' })).resolves.toEqual([]);
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    // Feature: outlife-production-plan, Property 11: Resiliência da Google_Places_Integration a qualquer falha
    'com credencial presente mas response.ok=false (status HTTP arbitrário), resolve com [] sem lançar',
    async () => {
      await fc.assert(
        fc.asyncProperty(validApiKeyArbitrary, httpErrorStatusArbitrary, async (apiKey, status) => {
          process.env.GOOGLE_PLACES_API_KEY = apiKey;
          vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
              ok: false,
              status,
              text: () => Promise.resolve('erro simulado'),
            }),
          );

          await expect(fetchDestinationsHandler({ query: 'trilha' })).resolves.toEqual([]);
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    // Feature: outlife-production-plan, Property 11: Resiliência da Google_Places_Integration a qualquer falha
    'mesmo com falha no próprio console.error (mecanismo de registro de diagnóstico), resolve com [] sem propagar',
    async () => {
      await fc.assert(
        fc.asyncProperty(validApiKeyArbitrary, httpErrorStatusArbitrary, async (apiKey, status) => {
          process.env.GOOGLE_PLACES_API_KEY = apiKey;
          vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
              ok: false,
              status,
              text: () => Promise.resolve('erro simulado'),
            }),
          );
          vi.spyOn(console, 'error').mockImplementation(() => {
            throw new Error('falha simulada no logging');
          });

          await expect(fetchDestinationsHandler({ query: 'trilha' })).resolves.toEqual([]);
        }),
        { numRuns: 100 },
      );
    },
  );
});

describe('Google_Places_Integration — resiliência (fetchPlacesPhotosFromGooglePlaces)', () => {
  it(
    // Feature: outlife-production-plan, Property 11: Resiliência da Google_Places_Integration a qualquer falha
    'com credencial ausente/vazia/só espaços, resolve com [] e nunca chama fetch',
    async () => {
      await fc.assert(
        fc.asyncProperty(missingCredentialArbitrary, fc.uuid(), async (missingKey, placeId) => {
          if (missingKey === undefined) {
            delete process.env.GOOGLE_PLACES_API_KEY;
          } else {
            process.env.GOOGLE_PLACES_API_KEY = missingKey;
          }
          const fetchSpy = vi.fn();
          vi.stubGlobal('fetch', fetchSpy);

          const result = await fetchPlacesPhotosHandler({ placeId });

          expect(result).toEqual([]);
          expect(fetchSpy).not.toHaveBeenCalled();
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    // Feature: outlife-production-plan, Property 11: Resiliência da Google_Places_Integration a qualquer falha
    'com credencial presente mas fetch rejeitando (erro de rede), resolve com [] sem lançar',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          validApiKeyArbitrary,
          fc.uuid(),
          networkErrorArbitrary,
          async (apiKey, placeId, networkError) => {
            process.env.GOOGLE_PLACES_API_KEY = apiKey;
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(networkError));

            await expect(fetchPlacesPhotosHandler({ placeId })).resolves.toEqual([]);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    // Feature: outlife-production-plan, Property 11: Resiliência da Google_Places_Integration a qualquer falha
    'com credencial presente mas response.ok=false (status HTTP arbitrário), resolve com [] sem lançar',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          validApiKeyArbitrary,
          fc.uuid(),
          httpErrorStatusArbitrary,
          async (apiKey, placeId, status) => {
            process.env.GOOGLE_PLACES_API_KEY = apiKey;
            vi.stubGlobal(
              'fetch',
              vi.fn().mockResolvedValue({
                ok: false,
                status,
                text: () => Promise.resolve('erro simulado'),
              }),
            );

            await expect(fetchPlacesPhotosHandler({ placeId })).resolves.toEqual([]);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    // Feature: outlife-production-plan, Property 11: Resiliência da Google_Places_Integration a qualquer falha
    'mesmo com falha no próprio console.error (mecanismo de registro de diagnóstico), resolve com [] sem propagar',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          validApiKeyArbitrary,
          fc.uuid(),
          httpErrorStatusArbitrary,
          async (apiKey, placeId, status) => {
            process.env.GOOGLE_PLACES_API_KEY = apiKey;
            vi.stubGlobal(
              'fetch',
              vi.fn().mockResolvedValue({
                ok: false,
                status,
                text: () => Promise.resolve('erro simulado'),
              }),
            );
            vi.spyOn(console, 'error').mockImplementation(() => {
              throw new Error('falha simulada no logging');
            });

            await expect(fetchPlacesPhotosHandler({ placeId })).resolves.toEqual([]);
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
