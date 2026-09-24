import { describe, expect, it } from "vitest";
import { pickVideoMimeType, canExportVideo, generateActivityVideo } from "./activity-video-export";

// Em ambiente node (sem MediaRecorder/canvas.captureStream), as funções de
// capacidade devem degradar com segurança (nunca lançar) e a geração deve
// rejeitar com erro claro em vez de travar.
describe("activity-video-export (ambiente sem suporte)", () => {
  it("pickVideoMimeType retorna null quando MediaRecorder não existe", () => {
    expect(pickVideoMimeType()).toBeNull();
  });

  it("canExportVideo retorna false sem suporte (não lança)", () => {
    expect(canExportVideo()).toBe(false);
  });

  it("generateActivityVideo rejeita com trajeto insuficiente", async () => {
    await expect(generateActivityVideo({ path: [{ lat: 0, lng: 0 }] })).rejects.toThrow();
  });

  it("generateActivityVideo rejeita quando gravação não é suportada", async () => {
    await expect(
      generateActivityVideo({
        path: [
          { lat: -22, lng: -43 },
          { lat: -22.01, lng: -43.01 },
        ],
      }),
    ).rejects.toThrow();
  });
});
