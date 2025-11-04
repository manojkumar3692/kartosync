// src/screens/ConnectScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, NativeModules } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import HmacSHA256 from "crypto-js/hmac-sha256";
import Hex from "crypto-js/enc-hex";

const { KSConfig } = NativeModules || {};

const KEY_URL = "ingest_url";
const KEY_PHONE = "org_phone";
const KEY_SECRET = "hmac_secret";

export default function ConnectScreen() {
  const [ingestUrl, setIngestUrl] = useState("");
  const [orgPhone, setOrgPhone] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);

  // Load saved values (from AsyncStorage for UI) and mirror from native if exists
  useEffect(() => {
    (async () => {
      const [u, p, s] = await Promise.all([
        AsyncStorage.getItem(KEY_URL),
        AsyncStorage.getItem(KEY_PHONE),
        AsyncStorage.getItem(KEY_SECRET),
      ]);
      if (u) setIngestUrl(u);
      if (p) setOrgPhone(p);
      if (s) setSecret(s);

      // Also try reading native prefs (if user previously saved there)
      if (KSConfig?.getConfig) {
        try {
          const cfg = await KSConfig.getConfig();
          if (cfg?.ingest_url && !u) setIngestUrl(cfg.ingest_url);
          if (cfg?.org_phone && !p) setOrgPhone(cfg.org_phone);
          if (cfg?.hmac_secret && !s) setSecret(cfg.hmac_secret);
        } catch {}
      }
    })();
  }, []);

  const save = useCallback(async () => {
    if (!ingestUrl || !orgPhone || !secret) {
      Alert.alert("Missing", "Please fill all three fields.");
      return;
    }
    const u = ingestUrl.replace(/\/+$/, "");

    // Save for React-side (UI)
    await Promise.all([
      AsyncStorage.setItem(KEY_URL, u),
      AsyncStorage.setItem(KEY_PHONE, orgPhone.trim()),
      AsyncStorage.setItem(KEY_SECRET, secret.trim()),
    ]);

    // Save for Native listener (REAL SOURCE for KSNotificationListener)
    if (KSConfig?.setConfig) {
      try {
        await KSConfig.setConfig(u, orgPhone.trim(), secret.trim());
      } catch (e: any) {
        Alert.alert("Native save failed", e?.message || "setConfig error");
        return;
      }
    } else {
      Alert.alert(
        "Native module missing",
        "KSConfig module not found. Rebuild the app after adding KSConfigPackage."
      );
      return;
    }

    Alert.alert("Saved", "Settings stored. Now toggle notification access OFF→ON.");
  }, [ingestUrl, orgPhone, secret]);

  const pingHealth = useCallback(async () => {
    try {
      if (!ingestUrl) return Alert.alert("Set URL first");
      const u = ingestUrl.replace(/\/+$/, "");
      const r = await axios.get(`${u}/health`, { timeout: 8000 });
      Alert.alert("Health", `Code: ${r.status}\nBody: ${JSON.stringify(r.data)}`);
    } catch (e: any) {
      Alert.alert("Health failed", e?.message || "Request error");
    }
  }, [ingestUrl]);

  const sendTest = useCallback(async () => {
    try {
      if (!ingestUrl || !orgPhone || !secret) {
        return Alert.alert("Missing", "Please save URL, phone and secret first.");
      }
      setBusy(true);
      const base = ingestUrl.replace(/\/+$/, "");
      const body = {
        org_phone: orgPhone.trim(),
        from: "TestButton",
        text: "2 kg chicken curry cut, 1 packet milk",
        ts: Date.now(),
      };
      const raw = JSON.stringify(body);
      const sig = HmacSHA256(raw, secret.trim()).toString(Hex);

      const r = await axios.post(`${base}/api/ingest/local`, raw, {
        headers: { "Content-Type": "application/json", "X-Signature": sig },
        timeout: 8000,
        transformRequest: [(data) => data], // preserve raw JSON for HMAC
      });

      Alert.alert("Ingest result", `Code: ${r.status}\nBody: ${JSON.stringify(r.data)}`);
    } catch (e: any) {
      const code = e?.response?.status;
      const body = e?.response?.data;
      Alert.alert("Ingest failed", `Code: ${code || "-"}\n${e?.message || "Request error"}\n${body ? JSON.stringify(body) : ""}`);
    } finally {
      setBusy(false);
    }
  }, [ingestUrl, orgPhone, secret]);

  const writeAndPing = useCallback(async () => {
    // Helper: write native prefs and ask the service to ping (after you toggle permission)
    await save();
    Alert.alert(
      "Next",
      "Now go to Settings → Notifications → Notification access → KartoSync: toggle OFF then ON. After it connects, it will hit /api/ingest/nl-ping automatically."
    );
  }, [save]);

  return (
    <ScrollView contentContainerStyle={{ padding: 20, backgroundColor: "#fff", flexGrow: 1 }}>
      <Text style={{ fontSize: 22, fontWeight: "800", marginBottom: 6 }}>Connect</Text>
      <Text style={{ color: "#6b7280", marginBottom: 16 }}>
        Configure where orders are sent from your phone’s WhatsApp notifications.
      </Text>

      <Text style={styles.label}>Backend URL (no trailing slash)</Text>
      <TextInput
        placeholder="https://your-ngrok-subdomain.ngrok-free.dev"
        autoCapitalize="none"
        value={ingestUrl}
        onChangeText={setIngestUrl}
        style={styles.input}
      />

      <Text style={styles.label}>Org phone (must match orgs.wa_phone_number_id)</Text>
      <TextInput
        placeholder="9920680195"
        keyboardType="phone-pad"
        value={orgPhone}
        onChangeText={setOrgPhone}
        style={styles.input}
      />

      <Text style={styles.label}>HMAC secret</Text>
      <TextInput
        placeholder="MOBILE_INGEST_SECRET"
        value={secret}
        onChangeText={setSecret}
        secureTextEntry
        style={styles.input}
      />

      <TouchableOpacity onPress={save} style={[styles.btn, { backgroundColor: "#111827" }]}>
        <Text style={styles.btnText}>Save</Text>
      </TouchableOpacity>

      <View style={{ height: 10 }} />

      <TouchableOpacity onPress={writeAndPing} style={[styles.btn, { backgroundColor: "#7c3aed" }]}>
        <Text style={styles.btnText}>Save & Readying Listener</Text>
      </TouchableOpacity>

      <View style={{ height: 10 }} />

      <TouchableOpacity onPress={pingHealth} style={[styles.btn, { backgroundColor: "#2563eb" }]}>
        <Text style={styles.btnText}>Ping /health</Text>
      </TouchableOpacity>

      <View style={{ height: 10 }} />

      <TouchableOpacity
        onPress={sendTest}
        disabled={busy}
        style={[styles.btn, { backgroundColor: busy ? "#9ca3af" : "#059669" }]}
      >
        <Text style={styles.btnText}>{busy ? "Sending…" : "Send Test (signed)"}</Text>
      </TouchableOpacity>

      <View style={{ marginTop: 14 }}>
        <Text style={{ color: "#6b7280", fontSize: 12, lineHeight: 18 }}>
          • This screen now writes to native <Text style={{ fontWeight: "700" }}>ks_prefs</Text>, which the listener uses.
          {"\n"}• After saving, toggle notification access OFF→ON for KartoSync so the listener reconnects.
          {"\n"}• If you configured <Text style={{ fontWeight: "700" }}>/api/ingest/nl-ping</Text>, you’ll see a ping when it binds.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = {
  label: { fontWeight: "700", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: "#fafafa",
  },
  btn: { padding: 14, borderRadius: 12, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "800" },
} as const;