import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  completeWhatsAppEmbeddedSignupApi,
  connectWhatsAppWithTokenApi,
  deleteChannelApi,
  listChannelsApi,
  startWhatsAppEmbeddedSignupApi,
  verifyChannelApi,
  type ChannelClientRecord
} from "./api.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "./components/ui/card.js";
import { Badge } from "@flowdesk/ui";
import { MessageSquare, Plus, Zap } from "lucide-react";

interface FacebookSdk {
  init(config: { appId: string; cookie: boolean; xfbml: boolean; version: string }): void;
  login(
    callback: (response: { authResponse?: { code?: string } }) => void,
    options: Record<string, unknown>
  ): void;
}

declare global {
  interface Window {
    FB?: FacebookSdk;
  }
}

const META_SDK_URL = "https://connect.facebook.net/en_US/sdk.js";
const META_MESSAGE_ORIGINS = new Set(["https://www.facebook.com", "https://web.facebook.com"]);

function loadMetaSdk(appId: string): Promise<FacebookSdk> {
  if (window.FB) {
    window.FB.init({ appId, cookie: true, xfbml: false, version: "v25.0" });
    return Promise.resolve(window.FB);
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.src = META_SDK_URL;
    script.onload = () => {
      if (!window.FB) {
        reject(new Error("Meta login SDK did not load."));
        return;
      }
      window.FB.init({ appId, cookie: true, xfbml: false, version: "v25.0" });
      resolve(window.FB);
    };
    script.onerror = () => reject(new Error("Meta login SDK could not be loaded."));
    document.head.appendChild(script);
  });
}

type PendingSignup = {
  attemptId: string;
  state: string;
  code?: string;
  phoneNumberId?: string;
  wabaId?: string;
  completing?: boolean;
};

export interface ChannelsViewProps {
  orgId: string;
  canManage: boolean;
  showToast: (msg: string, isError?: boolean) => void;
}

export function ChannelsView({ orgId, canManage, showToast }: ChannelsViewProps) {
  const [channels, setChannels] = useState<ChannelClientRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [showManualConnect, setShowManualConnect] = useState(false);
  const [manualConnection, setManualConnection] = useState({
    name: "",
    phoneNumberId: "",
    wabaId: "",
    accessToken: ""
  });
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const pendingSignup = useRef<PendingSignup | null>(null);

  const loadChannels = useCallback(async () => {
    try {
      setLoading(true);
      setChannels(await listChannelsApi(orgId));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load channels", true);
    } finally {
      setLoading(false);
    }
  }, [orgId, showToast]);

  useEffect(() => {
    void loadChannels();
  }, [loadChannels]);

  const completePendingSignup = useCallback(async () => {
    const pending = pendingSignup.current;
    if (
      !pending ||
      pending.completing ||
      !pending.code ||
      !pending.phoneNumberId ||
      !pending.wabaId
    ) {
      return;
    }
    pending.completing = true;
    setConnecting(true);
    try {
      const result = await completeWhatsAppEmbeddedSignupApi(orgId, {
        attemptId: pending.attemptId,
        state: pending.state,
        code: pending.code,
        phoneNumberId: pending.phoneNumberId,
        wabaId: pending.wabaId
      });
      showToast(`WhatsApp channel connected: ${result.channel.name}`);
      pendingSignup.current = null;
      await loadChannels();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Meta connection could not be completed.",
        true
      );
    } finally {
      const current = pendingSignup.current;
      if (current) current.completing = false;
      setConnecting(false);
    }
  }, [loadChannels, orgId, showToast]);

  useEffect(() => {
    const receiveMetaSignupEvent = (event: MessageEvent<unknown>) => {
      if (!META_MESSAGE_ORIGINS.has(event.origin) || typeof event.data !== "string") return;
      let payload: unknown;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (
        typeof payload !== "object" ||
        payload === null ||
        !("type" in payload) ||
        payload.type !== "WA_EMBEDDED_SIGNUP" ||
        !("event" in payload) ||
        payload.event !== "FINISH" ||
        !("data" in payload) ||
        typeof payload.data !== "object" ||
        payload.data === null
      ) {
        return;
      }
      const data = payload.data as Record<string, unknown>;
      const pending = pendingSignup.current;
      if (
        !pending ||
        typeof data["phone_number_id"] !== "string" ||
        typeof data["waba_id"] !== "string"
      ) {
        return;
      }
      pending.phoneNumberId = data["phone_number_id"];
      pending.wabaId = data["waba_id"];
      void completePendingSignup();
    };
    window.addEventListener("message", receiveMetaSignupEvent);
    return () => window.removeEventListener("message", receiveMetaSignupEvent);
  }, [completePendingSignup]);

  const handleConnect = async () => {
    if (!canManage || connecting) return;
    try {
      setConnecting(true);
      const setup = await startWhatsAppEmbeddedSignupApi(orgId);
      pendingSignup.current = { attemptId: setup.attemptId, state: setup.state };
      const sdk = await loadMetaSdk(setup.appId);
      sdk.login(
        (loginResponse) => {
          const pending = pendingSignup.current;
          const code = loginResponse.authResponse?.code;
          if (!pending || !code) {
            pendingSignup.current = null;
            setConnecting(false);
            showToast("Meta connection was cancelled before authorization completed.", true);
            return;
          }
          pending.code = code;
          void completePendingSignup();
        },
        {
          config_id: setup.configId,
          response_type: "code",
          override_default_response_type: true,
          extras: { setup: {} }
        }
      );
    } catch (err) {
      pendingSignup.current = null;
      setConnecting(false);
      showToast(err instanceof Error ? err.message : "Unable to start Meta connection.", true);
    }
  };

  const handleManualConnect = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage || connecting) return;
    try {
      setConnecting(true);
      const result = await connectWhatsAppWithTokenApi(orgId, manualConnection);
      showToast(`WhatsApp channel connected and verified: ${result.channel.name}`);
      setManualConnection({ name: "", phoneNumberId: "", wabaId: "", accessToken: "" });
      setShowManualConnect(false);
      await loadChannels();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "WhatsApp connection failed.", true);
    } finally {
      setConnecting(false);
    }
  };

  const openManualConnect = (channel?: ChannelClientRecord) => {
    setManualConnection({
      name: channel?.name ?? "",
      phoneNumberId: channel?.phoneNumberId ?? "",
      wabaId: channel?.wabaId ?? "",
      accessToken: ""
    });
    setShowManualConnect(true);
  };

  const handleVerify = async (channelId: string) => {
    try {
      setVerifyingId(channelId);
      const result = await verifyChannelApi(orgId, channelId);
      showToast(
        result.verified
          ? "WhatsApp API connection is healthy."
          : `Verification failed: ${result.message}`,
        !result.verified
      );
      await loadChannels();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Verification error", true);
    } finally {
      setVerifyingId(null);
    }
  };

  const handleDelete = async (channelId: string) => {
    if (
      !window.confirm(
        "Disconnect this WhatsApp channel? Existing conversation history will remain."
      )
    ) {
      return;
    }
    try {
      await deleteChannelApi(orgId, channelId);
      showToast("Channel disconnected successfully.");
      await loadChannels();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to disconnect channel", true);
    }
  };

  return (
    <div
      className="channels-container mx-auto max-w-6xl space-y-6 p-4 md:p-8"
      data-testid="channels-view"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <MessageSquare className="size-6 text-primary" />
            WhatsApp Channels
          </h2>
          <p className="text-sm text-muted-foreground">
            Connect with a Meta access token and FlowDesk will verify the phone number, subscribe
            the WABA, and encrypt the credential before activating the channel.
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openManualConnect()}
              className="btn btn-primary inline-flex items-center gap-1.5 cursor-pointer"
              id="connect-channel-btn"
              disabled={connecting}
            >
              <Plus className="size-4" />
              Connect WhatsApp
            </button>
            <button
              type="button"
              onClick={() => void handleConnect()}
              className="btn btn-secondary inline-flex items-center gap-1.5 cursor-pointer"
              disabled={connecting}
            >
              <Zap className="size-4" />
              Connect with Meta Signup
            </button>
          </div>
        )}
      </div>

      {canManage && showManualConnect && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Connect with verified credentials
            </CardTitle>
            <CardDescription>
              Use credentials from the same Meta App configured for the FlowDesk webhook. The access
              token is never returned by the API.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(event) => void handleManualConnect(event)}
              className="card grid gap-4 md:grid-cols-2"
              aria-label="Connect WhatsApp with access token"
            >
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  Channel name
                  <input
                    required
                    maxLength={100}
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={manualConnection.name}
                    onChange={(event) =>
                      setManualConnection((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </label>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  Phone Number ID
                  <input
                    required
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={manualConnection.phoneNumberId}
                    onChange={(event) =>
                      setManualConnection((current) => ({
                        ...current,
                        phoneNumberId: event.target.value
                      }))
                    }
                  />
                </label>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  WABA ID
                  <input
                    required
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={manualConnection.wabaId}
                    onChange={(event) =>
                      setManualConnection((current) => ({ ...current, wabaId: event.target.value }))
                    }
                  />
                </label>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  Access token
                  <input
                    required
                    type="password"
                    autoComplete="off"
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={manualConnection.accessToken}
                    onChange={(event) =>
                      setManualConnection((current) => ({
                        ...current,
                        accessToken: event.target.value
                      }))
                    }
                  />
                </label>
              </div>
              <div className="flex gap-2 pt-2 md:col-span-2">
                <button
                  type="submit"
                  className="btn btn-primary cursor-pointer"
                  disabled={connecting}
                >
                  {connecting ? "Verifying and connecting..." : "Verify and connect"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary cursor-pointer"
                  onClick={() => setShowManualConnect(false)}
                  disabled={connecting}
                >
                  Cancel
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card className="p-8 text-center text-muted-foreground">Loading connected channels...</Card>
      ) : channels.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
          <div className="rounded-full bg-muted p-3 mb-3">
            <MessageSquare className="size-6 text-muted-foreground" />
          </div>
          <CardTitle className="text-base mb-1">No WhatsApp channels connected yet.</CardTitle>
          <CardDescription className="mb-4">
            Connect a WhatsApp business account to start receiving and sending customer messages.
          </CardDescription>
          {canManage && (
            <button
              type="button"
              onClick={() => openManualConnect()}
              className="btn btn-secondary btn-sm inline-flex items-center gap-1 cursor-pointer"
              disabled={connecting}
            >
              <Plus className="size-3.5" />
              Connect your first channel
            </button>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {channels.map((channel) => (
            <Card key={channel.id} className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">{channel.name}</CardTitle>
                    <span className="text-xs text-muted-foreground font-mono">
                      Type: {channel.type.toUpperCase()}
                    </span>
                  </div>
                  <Badge
                    variant={channel.status === "active" ? "default" : "outline"}
                    className={
                      channel.status === "active"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                        : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20"
                    }
                  >
                    {channel.status.toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground pb-4">
                {channel.statusReason && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    {channel.statusReason}
                  </p>
                )}
                <div className="space-y-1 font-mono text-xs">
                  <p>
                    <strong className="font-sans text-foreground text-sm">Phone Number ID:</strong>{" "}
                    {channel.phoneNumberId}
                  </p>
                  <p>
                    <strong className="font-sans text-foreground text-sm">WABA ID:</strong>{" "}
                    {channel.wabaId}
                  </p>
                </div>
              </CardContent>
              {canManage && (
                <CardFooter className="flex flex-wrap gap-2 border-t pt-3">
                  <button
                    type="button"
                    onClick={() => openManualConnect(channel)}
                    disabled={connecting}
                    className="btn btn-secondary btn-sm cursor-pointer"
                  >
                    Reconnect with token
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleVerify(channel.id)}
                    disabled={verifyingId === channel.id}
                    className="btn btn-secondary btn-sm cursor-pointer"
                  >
                    {verifyingId === channel.id ? "Checking..." : "Test connection"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(channel.id)}
                    className="btn btn-danger btn-sm text-destructive hover:bg-destructive/10 cursor-pointer ml-auto"
                  >
                    Disconnect
                  </button>
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
