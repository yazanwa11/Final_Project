// app/(tabs)/explore.tsx
import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";

export default function ExploreScreen() {
  const [plants, setPlants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlants = async () => {
      try {
        // 👇 Emulator uses 10.0.2.2 to access Django backend
        const response = await fetch("http://10.0.2.2:8000/api/plants/");
        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }
        const data = await response.json();
        setPlants(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPlants();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Loading plants...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "red" }}>Error: {error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={plants}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.desc}>{item.description}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f0fdf4",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  item: {
    padding: 12,
    marginBottom: 10,
    borderRadius: 8,
    backgroundColor: "#bbf7d0",
  },
  name: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#166534",
  },
  desc: {
    fontSize: 14,
    color: "#064e3b",
  },
});
