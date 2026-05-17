import { Injectable } from "@angular/core";
import { AuthService } from "../auth/auth.service";

const EXTENSION_ID_STORAGE_KEY = "mct-chrome-extension-id";

declare global {
  interface Window {
    chrome?: {
      runtime?: {
        sendMessage: (
          extensionId: string,
          message: unknown,
          responseCallback?: (response: unknown) => void,
        ) => void;
        lastError?: { message?: string };
      };
    };
  }
}

@Injectable({ providedIn: "root" })
export class ExtensionSyncService {
  constructor(private authService: AuthService) {}

  getExtensionId(): string {
    return localStorage.getItem(EXTENSION_ID_STORAGE_KEY)?.trim() ?? "";
  }

  saveExtensionId(id: string): void {
    const trimmed = id.trim();
    if (trimmed) {
      localStorage.setItem(EXTENSION_ID_STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(EXTENSION_ID_STORAGE_KEY);
    }
  }

  isChromeExtensionApiAvailable(): boolean {
    return Boolean(window.chrome?.runtime?.sendMessage);
  }

  /**
   * Sends the web app JWT to the extension (requires externally_connectable + extension ID).
   */
  syncAuthToExtension(extensionId?: string): Promise<{ ok: boolean; message: string }> {
    const chromeApi = window.chrome;
    if (!chromeApi?.runtime?.sendMessage) {
      return Promise.resolve({
        ok: false,
        message:
          "Open this page in Google Chrome (not another browser). Or sign in via the extension popup on Manychat.",
      });
    }

    const id = (extensionId ?? this.getExtensionId()).trim();
    if (!id) {
      return Promise.resolve({
        ok: false,
        message:
          "Enter your Chrome extension ID below (from chrome://extensions), then click Link again.",
      });
    }

    this.saveExtensionId(id);

    const token = this.authService.getToken();
    if (!token) {
      return Promise.resolve({
        ok: false,
        message: "You are not signed in to the web app.",
      });
    }

    return new Promise((resolve) => {
      chromeApi.runtime!.sendMessage(
        id,
        { type: "SET_AUTH", token, expiresIn: 86400 },
        (response: unknown) => {
          if (chromeApi.runtime?.lastError) {
            resolve({
              ok: false,
              message:
                chromeApi.runtime.lastError.message ??
                "Extension unreachable. Check the ID and reload the extension in chrome://extensions.",
            });
            return;
          }
          const body = response as { ok?: boolean; error?: string } | undefined;
          if (body?.ok) {
            resolve({ ok: true, message: "Extension linked successfully." });
            return;
          }
          resolve({
            ok: false,
            message: body?.error ?? "Extension did not accept the token",
          });
        },
      );
    });
  }
}
