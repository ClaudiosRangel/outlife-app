import Foundation
import Capacitor
import UIKit

/**
 * Versão iOS do plugin `NativeShare` (a Android vive em
 * android/app/.../NativeSharePlugin.java). Mesmo contrato JS
 * (src/lib/native-share.ts): `shareFile({ data, fileName, mimeType, title, text })`.
 *
 * - Com arquivo (`data` base64 + `fileName`): grava no diretório temporário e
 *   abre a folha nativa de compartilhamento (UIActivityViewController).
 * - Sem arquivo: compartilha só o texto (link embutido).
 *
 * Fica neste pod porque ele já é integrado ao build iOS via CocoaPods.
 */
@objc(NativeSharePlugin)
public class NativeSharePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeSharePlugin"
    public let jsName = "NativeShare"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "shareFile", returnType: CAPPluginReturnPromise)
    ]

    @objc func shareFile(_ call: CAPPluginCall) {
        let base64 = call.getString("data") ?? ""
        let fileName = call.getString("fileName") ?? ""
        let text = call.getString("text")

        var items: [Any] = []

        if !base64.isEmpty && !fileName.isEmpty {
            guard let bytes = Data(base64Encoded: base64, options: .ignoreUnknownCharacters) else {
                call.reject("Arquivo inválido para compartilhar.")
                return
            }
            let safeName = fileName.replacingOccurrences(of: "/", with: "_")
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(safeName)
            do {
                try? FileManager.default.removeItem(at: url)
                try bytes.write(to: url, options: .atomic)
            } catch {
                call.reject("Falha ao preparar o arquivo: \(error.localizedDescription)")
                return
            }
            items.append(url)
        } else if let text = text, !text.isEmpty {
            items.append(text)
        }

        if items.isEmpty {
            call.reject("Nada para compartilhar.")
            return
        }

        DispatchQueue.main.async { [weak self] in
            guard let presenter = self?.bridge?.viewController else {
                call.reject("Tela indisponível para compartilhar.")
                return
            }
            let activity = UIActivityViewController(activityItems: items, applicationActivities: nil)
            // iPad: a folha precisa de uma âncora (popover).
            if let pop = activity.popoverPresentationController {
                pop.sourceView = presenter.view
                pop.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 0, height: 0)
                pop.permittedArrowDirections = []
            }
            activity.completionWithItemsHandler = { _, completed, _, error in
                if let error = error {
                    call.reject(error.localizedDescription)
                } else {
                    call.resolve(["value": completed])
                }
            }
            presenter.present(activity, animated: true)
        }
    }
}
