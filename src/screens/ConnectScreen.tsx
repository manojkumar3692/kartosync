// src/screens/ConnectScreen.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, Alert, ScrollView, NativeModules } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Config from "react-native-config";
import { getBuildInfo } from "../native/buildInfo";

const { KSConfig } = NativeModules || {};

const KEY_URL = "ingest_url";
const KEY_PHONE = "org_phone";
const KEY_SECRET = "hmac_secret";
const KEY_LOGIN_PHONE = "auth_phone"; // where your login may have stored the phone

const tidyUrl = (s?: string | null) => (s || "").trim().replace(/\/+$/, "");
const mask = (s?: string | null) => {
  const v = (s || "").trim();
  if (!v) return "—";
  if (v.length <= 6) return "••••";
  return v.slice(0, 2) + "••••••" + v.slice(-4);
};

export default function ConnectScreen() {
  const [url, setUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [secret, setSecret] = useState("");
  const [bound, setBound] = useState<boolean | null>(null); // null = unknown
  const [lastPingAt, setLastPingAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [ver, setVer] = useState<{ versionName: string; versionCode: number; buildType: string } | null>(null);

  const savedOnceRef = useRef(false);

  // 1) Resolve values: ENV → login phone → previous KSConfig/AsyncStorage
  useEffect(() => {
    (async () => {
      // ENV
      const envUrl = tidyUrl(Config.INGEST_URL);
      const envSecret = (Config.MOBILE_INGEST_SECRET || "").trim();

      // PHONE: prefer native (login wrote it), else AsyncStorage("auth_phone"), else previous KSConfig
      let loginPhone = "";
      try {
        if (KSConfig?.getLastLoginPhone) {
          const p = await KSConfig.getLastLoginPhone();
          if (p && String(p).trim()) loginPhone = String(p).trim();
        }
      } catch {}
      if (!loginPhone) {
        try {
          const p = await AsyncStorage.getItem(KEY_LOGIN_PHONE);
          if (p && p.trim()) loginPhone = p.trim();
        } catch {}
      }
      if (!loginPhone && KSConfig?.getConfig) {
        try {
          const cfg = await KSConfig.getConfig();
          if (cfg?.org_phone) loginPhone = String(cfg.org_phone).trim();
        } catch {}
      }

      // FALLBACKS (keep prior saved values if env/login empty)
      try {
        if (envUrl) setUrl(envUrl);
        else {
          const u = await AsyncStorage.getItem(KEY_URL);
          if (u && u.trim()) setUrl(tidyUrl(u));
        }
        if (envSecret) setSecret(envSecret);
        else {
          const s = await AsyncStorage.getItem(KEY_SECRET);
          if (s && s.trim()) setSecret(s.trim());
        }
        if (loginPhone) setPhone(loginPhone);
        else {
          const p = await AsyncStorage.getItem(KEY_PHONE);
          if (p && p.trim()) setPhone(p.trim());
        }
      } catch {}
    })();
  }, []);

  // 2) Version footer
  useEffect(() => {
    (async () => {
      try {
        const b = await getBuildInfo();
        setVer({ versionName: b.versionName, versionCode: b.versionCode, buildType: b.buildType });
      } catch {
        setVer({ versionName: "0.0.0", versionCode: 0, buildType: __DEV__ ? "debug" : "release" });
      }
    })();
  }, []);

  const allReady = useMemo(() => Boolean(url && phone && secret), [url, phone, secret]);

  // 3) Auto-save to native + storage once (happens right after login populates)
  const writeNativeAndStorage = useCallback(async () => {
    const u = tidyUrl(url);
    await Promise.all([
      AsyncStorage.setItem(KEY_URL, u),
      AsyncStorage.setItem(KEY_PHONE, phone.trim()),
      AsyncStorage.setItem(KEY_SECRET, secret.trim()),
    ]);
    if (KSConfig?.setConfig) {
      await KSConfig.setConfig(u, phone.trim(), secret.trim());
    }
  }, [url, phone, secret]);

  useEffect(() => {
    if (allReady && !savedOnceRef.current) {
      savedOnceRef.current = true;
      writeNativeAndStorage().catch(() => (savedOnceRef.current = false));
    }
  }, [allReady, writeNativeAndStorage]);

  // 4) Poll native listener status (if available) and fall back to /health
  const refreshStatus = useCallback(async () => {
    try {
      // Prefer native bound flag (instant if listener is connected)
      if (KSConfig?.getStatus) {
        const st = await KSConfig.getStatus();
        if (typeof st?.bound === "boolean") setBound(st.bound);
        if (st?.lastPingAt) setLastPingAt(Number(st.lastPingAt));
      }
      // Also attempt /health if we have URL (useful when bound flag isn't exposed yet)
      if (url) {
        const r = await axios.get(`${tidyUrl(url)}/health`, { timeout: 6000 });
        if (r.status >= 200 && r.status < 300) {
          // If native didn't report, mark as connected based on healthy backend and saved config
          if (bound === null) setBound(true);
        }
      }
    } catch {
      if (bound === null) setBound(false);
    }
  }, [url, bound]);

  useEffect(() => {
    // one-time refresh on mount, then every 10s for a short period
    refreshStatus();
    const t = setInterval(refreshStatus, 10000);
    return () => clearInterval(t);
  }, [refreshStatus]);

  // 5) Manual ping
  const pingHealth = useCallback(async () => {
    try {
      if (!url) return Alert.alert("Set URL first");
      const r = await axios.get(`${tidyUrl(url)}/health`, { timeout: 8000 });
      Alert.alert("Health", `Code: ${r.status}\nBody: ${JSON.stringify(r.data)}`);
    } catch (e: any) {
      Alert.alert("Health failed", e?.message || "Request error");
    }
  }, [url]);

  // 6) Manual “Save again” (rarely needed)
  const forceSave = useCallback(async () => {
    try {
      if (!allReady) return Alert.alert("Missing", "URL/Phone/Secret not ready");
      setBusy(true);
      await writeNativeAndStorage();
      Alert.alert("Saved", "Listener config written to device.");
      refreshStatus();
    } finally {
      setBusy(false);
    }
  }, [allReady, writeNativeAndStorage, refreshStatus]);

  const connectedBadge = useMemo(() => {
    if (bound === true) {
      return (
        <View style={{ backgroundColor: "#ECFDF5", borderColor: "#10B981", borderWidth: 1, padding: 10, borderRadius: 12, marginBottom: 12 }}>
          <Text style={{ color: "#065F46", fontWeight: "800" }}>Connected ✓</Text>
          {lastPingAt ? (
            <Text style={{ color: "#065F46", marginTop: 4, fontSize: 12 }}>
              Listener ping: {new Date(lastPingAt).toLocaleString()}
            </Text>
          ) : null}
        </View>
      );
    }
    if (bound === false) {
      return (
        <View style={{ backgroundColor: "#FEF3C7", borderColor: "#F59E0B", borderWidth: 1, padding: 10, borderRadius: 12, marginBottom: 12 }}>
          <Text style={{ color: "#92400E", fontWeight: "800" }}>Waiting for listener…</Text>
          <Text style={{ color: "#92400E", marginTop: 4, fontSize: 12 }}>
            If needed, toggle Notification access OFF→ON for KartoSync.
          </Text>
        </View>
      );
    }
    // unknown
    return (
      <View style={{ backgroundColor: "#EFF6FF", borderColor: "#3B82F6", borderWidth: 1, padding: 10, borderRadius: 12, marginBottom: 12 }}>
        <Text style={{ color: "#1E3A8A", fontWeight: "800" }}>Checking status…</Text>
      </View>
    );
  }, [bound, lastPingAt]);

  return (
    <ScrollView contentContainerStyle={{ padding: 20, backgroundColor: "#fff", flexGrow: 1 }}>
      <Text style={{ fontSize: 22, fontWeight: "800", marginBottom: 6 }}>Connect</Text>
      <Text style={{ color: "#6b7280", marginBottom: 16 }}>
        We auto-connected right after login. Review your saved values below.
      </Text>

      {connectedBadge}

      {/* Print saved variables */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Backend URL</Text>
        <Text style={styles.cardValue}>{url || "—"}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Org Phone</Text>
        <Text style={styles.cardValue}>{phone || "—"}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>HMAC Secret</Text>
        <Text style={styles.cardValue}>{mask(secret)}</Text>
      </View>

      <TouchableOpacity onPress={pingHealth} style={[styles.btn, { backgroundColor: "#2563eb" }]}>
        <Text style={styles.btnText}>Ping /health</Text>
      </TouchableOpacity>

      <View style={{ height: 10 }} />

      <TouchableOpacity
        onPress={forceSave}
        disabled={!allReady || busy}
        style={[styles.btn, { backgroundColor: allReady && !busy ? "#111827" : "#9ca3af" }]}
      >
        <Text style={styles.btnText}>{busy ? "Saving…" : "Save to Device Again"}</Text>
      </TouchableOpacity>

      <View style={{ marginTop: 14 }}>
        <Text style={{ color: "#6b7280", fontSize: 12, lineHeight: 18 }}>
          • Written to native <Text style={{ fontWeight: "700" }}>ks_prefs</Text> and used by the listener.{"\n"}
          • If status shows “Waiting”, toggle notification access OFF→ON for KartoSync.{"\n"}
          • Health ping checks only your backend.
        </Text>
      </View>

      <View style={{ marginTop: 12, alignItems: "center" }}>
        <Text style={{ color: "#9CA3AF", fontSize: 12 }}>
          {ver ? `v${ver.versionName} (${ver.versionCode}) · ${ver.buildType}` : "v…"}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = {
  card: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: "#fafafa",
  },
  cardLabel: { fontWeight: "700", marginBottom: 6, color: "#374151" },
  cardValue: { fontFamily: "Menlo", color: "#111827" } as any,
  btn: { padding: 14, borderRadius: 12, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "800" },
} as const;