import {
  LanguageClient,
  type StaticFeature,
  type DynamicFeature,
  SemanticTokensRegistrationType,
} from "vscode-languageclient/node";

export class DenoLanguageClient extends LanguageClient {
  override registerFeature(
    feature: StaticFeature | DynamicFeature<unknown>,
  ): void {
    const registrationType = (feature as {
      registrationType?: { method: string };
    }).registrationType;
    const clientOptions = this.clientOptions.initializationOptions();
    const semanticHighlightingIsEnabled = clientOptions.semanticHighlighting?.enabled ?? true;
    const skipSemanticTokensRegistration = !semanticHighlightingIsEnabled && registrationType?.method === SemanticTokensRegistrationType.method;

    if (skipSemanticTokensRegistration) {
      return;
    }

    super.registerFeature(feature);
  }
}
