import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import LoginScreen from "./src/screens/LoginScreen";
import OrdersScreen from "./src/screens/OrderScreen";
import ConnectScreen from "./src/screens/ConnectScreen";
import { bootstrapAuth, setToken } from "./src/api";

const Stack = createNativeStackNavigator();

export default function App() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    (async () => {
      const t = await bootstrapAuth();
      setAuthed(!!t);
    })();
  }, []);

  function onLogout() {
    AsyncStorage.removeItem("token");
    setToken(undefined);
    setAuthed(false);
  }

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

// import React from "react";
// import { SafeAreaView } from "react-native";
// import ConnectScreen from "./src/screens/ConnectScreen";

// export default function App() {
//   return (
//     <SafeAreaView style={{ flex: 1 }}>
//       <ConnectScreen />
//     </SafeAreaView>
//   );
// }