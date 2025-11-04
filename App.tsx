// App.tsx
import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import RNBootSplash from "react-native-bootsplash";

import LoginScreen from "./src/screens/LoginScreen";
import OrdersScreen from "./src/screens/OrderScreen";
import ConnectScreen from "./src/screens/ConnectScreen";
import { bootstrapAuth, setToken } from "./src/api";

const Stack = createNativeStackNavigator();

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      // Bootstrap stored token & session
      const token = await bootstrapAuth();
      setAuthed(!!token);

      // Hide splash after auth check completes
      setTimeout(() => {
        RNBootSplash.hide({ fade: true });
      }, 300);
    })();
  }, []);

  function onLogout() {
    AsyncStorage.removeItem("token");
    setToken(undefined);
    setAuthed(false);
  }

  // While checking token, keep splash visible
  if (authed === null) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={authed ? "Orders" : "Login"}
        screenOptions={{ headerShown: false }}
      >
        {!authed ? (
          <Stack.Screen name="Login">
            {(props) => <LoginScreen {...props} onAuthed={() => setAuthed(true)} />}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="Orders">
              {(props) => <OrdersScreen {...props} onLogout={onLogout} />}
            </Stack.Screen>
            <Stack.Screen name="Connect" component={ConnectScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}