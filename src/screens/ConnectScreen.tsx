import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
import { NativeModules } from "react-native";

const { KSBridge } = NativeModules;

export default function ConnectScreen() {
  const [orgPhone, setOrgPhone] = useState("");
  const [ingestUrl, setIngestUrl] = useState("");
  const [hmacSecret, setHmacSecret] = useState("");

  async function handleSave() {
    try {
      if (!orgPhone || !ingestUrl || !hmacSecret) {
        Alert.alert("Missing Fields", "Please fill all fields");
        return;
      }
      await KSBridge.setIngestConfig(orgPhone, ingestUrl, hmacSecret);
      Alert.alert("Saved ✅", "Configuration saved successfully!");
    } catch (e:any) {
      Alert.alert("Error", e.message || "Failed to save");
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>KartoSync Configuration</Text>

      <TextInput
        placeholder="Org Phone (e.g. 123456789)"
        value={orgPhone}
        onChangeText={setOrgPhone}
        style={styles.input}
        keyboardType="numeric"
      />

      <TextInput
        placeholder="Ingest URL (e.g. https://your-ngrok-url.dev)"
        value={ingestUrl}
        onChangeText={setIngestUrl}
        style={styles.input}
        autoCapitalize="none"
      />

      <TextInput
        placeholder="HMAC Secret"
        value={hmacSecret}
        onChangeText={setHmacSecret}
        style={styles.input}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleSave}>
        <Text style={styles.buttonText}>Save / Connect</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 24,
    textAlign: "center",
    color: "#111",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#007bff",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});