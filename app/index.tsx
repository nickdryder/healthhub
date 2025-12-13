import { useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/providers/AuthProvider";
import { colors } from "@/constants/colors";

export default function SplashScreen() {
  const { loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        router.replace("/(tabs)");
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.primary, "#8B5CF6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.logoContainer}>
          <Ionicons name="pulse" size={64} color={colors.white} />
        </View>
        <Text style={styles.title}>Health Hub</Text>
        <Text style={styles.subtitle}>Your personal health data hub</Text>
        <ActivityIndicator color={colors.white} style={styles.loader} />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: "800",
    color: colors.white,
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.85)",
    marginTop: 8,
  },
  loader: {
    marginTop: 48,
  },
});