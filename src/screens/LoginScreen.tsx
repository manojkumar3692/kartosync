// src/screens/LoginScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Platform,
  NativeModules,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Config from "react-native-config";
import { login, signup, setToken } from "../api";
import { getBuildInfo } from "../native/buildInfo";

const { KSConfig } = NativeModules || {};

// Keys reused by ConnectScreen
const KEY_URL = "ingest_url";
const KEY_PHONE = "org_phone";
const KEY_SECRET = "hmac_secret";
const KEY_LOGIN_PHONE = "auth_phone";

// tiny helpers
const tidyUrl = (s?: string | null) => (s || "").trim().replace(/\/+$/, "");
const normPhone = (raw?: string | null) => {
  if (!raw) return "";
  const s = String(raw).trim();
  const plus = s.startsWith("+") ? "+" : "";
  const digits = s.replace(/[^\d]/g, "");
  return digits.length >= 7 ? plus + digits : "";
};

export default function LoginScreen({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [ver, setVer] = useState<{ versionName: string; versionCode: number; buildType: string } | null>(null);
  const [loading, setLoading] = useState(false);

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

  async function afterAuthSideEffects(loginPhoneRaw: string) {
    // 1) Normalize & derive values
    const orgPhone = normPhone(loginPhoneRaw);
    const url = tidyUrl(Config.INGEST_URL);
    const secret = (Config.MOBILE_INGEST_SECRET || "").trim();

    // 2) Persist for RN side (ConnectScreen prints these)
    await Promise.all([
      AsyncStorage.setItem(KEY_LOGIN_PHONE, orgPhone), // for ConnectScreen to pick as "auth_phone"
      AsyncStorage.setItem(KEY_PHONE, orgPhone),
      url ? AsyncStorage.setItem(KEY_URL, url) : Promise.resolve(),
      secret ? AsyncStorage.setItem(KEY_SECRET, secret) : Promise.resolve(),
    ]);

    // 3) Persist for Native listener (source of truth for KSNotificationListener)
    if (KSConfig?.setConfig && url && orgPhone && secret) {
      try {
        await KSConfig.setConfig(url, orgPhone, secret);
      } catch (e: any) {
        console.warn("[KSConfig.setConfig] failed:", e?.message || e);
      }
    }

    // 4) Optional: ping backend so ConnectScreen shows “Connected” quickly
    if (url) {
      try {
        await axios.post(
          `${url}/api/ingest/nl-ping`,
          {
            org_phone: orgPhone || "(unknown)",
            device: Platform.OS,
            state: "login_wired",
            pkg: "com.kartsync",
            ts: Date.now(),
          },
          { timeout: 6000 }
        );
      } catch {
        // non-fatal; ConnectScreen has a manual Ping button too
      }
    }
  }

  async function submit() {
    try {
      setLoading(true);
      let data: any;
      if (mode === "signup") {
        if (!name?.trim()) return Alert.alert("Enter shop name");
        if (!phone?.trim()) return Alert.alert("Enter phone");
        if (!password?.trim()) return Alert.alert("Enter password");
        data = await signup(name, phone, password);
      } else {
        if (!phone?.trim()) return Alert.alert("Enter phone");
        if (!password?.trim()) return Alert.alert("Enter password");
        data = await login(phone, password);
      }

      // token handling unchanged
      await AsyncStorage.setItem("token", data.token);
      setToken(data.token);

      // NEW: wire org phone + env config for the listener
      await afterAuthSideEffects(phone);

      onAuthed();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.error || "Failed");
    } finally {
      setLoading(false);
    }
  }

  const isLogin = mode === "login";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      {/* BG accents */}
      <View pointerEvents="none" style={{ position: "absolute", inset: 0 }}>
        <View
          style={{
            position: "absolute",
            top: -120,
            left: -120,
            width: 260,
            height: 260,
            borderRadius: 260,
            backgroundColor: "#C7D2FE",
            opacity: 0.35,
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: -100,
            right: -100,
            width: 240,
            height: 240,
            borderRadius: 240,
            backgroundColor: "#BBF7D0",
            opacity: 0.35,
          }}
        />
      </View>

      <View style={{ flex: 1, paddingHorizontal: 20, justifyContent: "center" }}>
        {/* Brand */}
        <View style={{ alignItems: "center", marginBottom: 16 }}>
          <View
            style={{
              height: 44,
              width: 44,
              borderRadius: 12,
              backgroundColor: "#111827",
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#000",
              shadowOpacity: 0.08,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 3 },
              elevation: 2,
            }}
          >
            <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 12 }}>KS</Text>
          </View>
          <Text style={{ marginTop: 8, fontSize: 18, fontWeight: "700", color: "#111827" }}>
            KartoSync
          </Text>
        </View>

        {/* Card */}
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 18,
            padding: 18,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            shadowColor: "#000",
            shadowOpacity: 0.06,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 3 },
            elevation: 2,
          }}
        >
          {/* Segmented control */}
          <View
            style={{
              backgroundColor: "#F3F4F6",
              borderRadius: 12,
              padding: 4,
              flexDirection: "row",
              gap: 6,
              marginBottom: 14,
            }}
          >
            {(["login", "signup"] as const).map((m) => {
              const active = mode === m;
              return (
                <TouchableOpacity
                  key={m}
                  onPress={() => setMode(m)}
                  style={{
                    flex: 1,
                    backgroundColor: active ? "#FFFFFF" : "transparent",
                    borderRadius: 10,
                    paddingVertical: 10,
                    alignItems: "center",
                    borderWidth: active ? 1 : 0,
                    borderColor: active ? "#E5E7EB" : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      color: active ? "#111827" : "#6B7280",
                      fontWeight: active ? "800" : "600",
                    }}
                  >
                    {m === "login" ? "Login" : "Create Account"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={{ fontSize: 18, fontWeight: "700", color: "#111827" }}>
            {isLogin ? "Sign in to your shop" : "Create your shop account"}
          </Text>
          <Text style={{ color: "#6B7280", marginTop: 4, marginBottom: 14 }}>
            {isLogin
              ? "Use the phone & password configured for your workspace."
              : "Choose a shop name and set your login phone/password."}
          </Text>

          {!isLogin && (
            <LabeledInput
              label="Shop name"
              value={name}
              onChangeText={setName}
              placeholder="e.g., Fresh Mart — Al Karama"
              autoCapitalize="words"
            />
          )}

          <LabeledInput
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            placeholder="e.g., +9715XXXXXXX / +9199XXXXXXXX"
            keyboardType="phone-pad"
          />

          <LabeledInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            secureTextEntry
          />

          <TouchableOpacity
            onPress={submit}
            disabled={loading}
            style={{
              backgroundColor: loading ? "#4B5563" : "#111827",
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: "center",
              marginTop: 6,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800" }}>
              {isLogin ? (loading ? "Signing in…" : "Sign in") : loading ? "Creating…" : "Create account"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setMode(isLogin ? "signup" : "login")}
            style={{ alignSelf: "center", marginTop: 12 }}
          >
            <Text style={{ color: "#2563EB", fontWeight: "600" }}>
              {isLogin ? "New here? Create an account" : "Have an account? Log in"}
            </Text>
          </TouchableOpacity>

          <Text style={{ marginTop: 12, color: "#94A3B8", fontSize: 12 }}>
            If you see <Text style={{ fontWeight: "700", color: "#64748B" }}>password_not_set</Text>, set a password on
            mobile or ask the admin.
          </Text>
        </View>

        {/* Footer */}
        <View style={{ alignItems: "center", marginTop: 16, marginBottom: Platform.OS === "ios" ? 6 : 0 }}>
          <Text style={{ color: "#94A3B8", fontSize: 12 }}>
            {ver ? `v${ver.versionName} (${ver.versionCode}) · ${ver.buildType}` : "v…"}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function LabeledInput({
  label,
  ...props
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: any;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 12, color: "#6B7280", marginBottom: 6, fontWeight: "600" }}>{label}</Text>
      <TextInput
        {...props}
        style={{
          borderWidth: 1,
          borderColor: "#E5E7EB",
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 12,
          backgroundColor: "#FAFAFA",
          color: "#111827",
        }}
        placeholderTextColor="#9CA3AF"
      />
    </View>
  );
}