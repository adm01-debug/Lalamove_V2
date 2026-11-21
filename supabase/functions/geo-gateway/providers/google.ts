// Provider Google Maps — stub a ser implementado conforme plano
// google-maps-x-lalamove-v2-plano-100-etapas-2026-11-21.md blocos 2/8.

import type { GeoAction, GeoProvider, GeoProviderResult } from "../_types.ts";

export class GoogleProvider implements GeoProvider {
  name = "google";

  async handle(
    action: GeoAction,
    _params: Record<string, unknown>,
    _req: Request,
  ): Promise<GeoProviderResult> {
    // TODO: implementar conforme plano Google Maps × Lalamove V2
    throw new Error(`Google provider: action '${action}' ainda não implementada`);
  }
}
