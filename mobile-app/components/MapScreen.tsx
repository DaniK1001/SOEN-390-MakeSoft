import React, { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import MapView, { Marker, Polygon } from "react-native-maps";
import * as Haptics from "expo-haptics";
import { Text, YStack, useTheme } from "tamagui";
import { BUILDING_POLYGONS } from "../data/buildingPolygons";
import { BUILDING_ADDRESSES } from "../data/building-addresses";

type LatLng = { latitude: number; longitude: number };

type BuildingRecord = (typeof BUILDING_POLYGONS)[keyof typeof BUILDING_POLYGONS];


function polygonCentroid(points: ReadonlyArray<LatLng>): LatLng {
    if (points.length === 0) {
        return { latitude: 45.4973, longitude: -73.5789 };
    }

    const sum = points.reduce(
        (acc, point) => ({
            latitude: acc.latitude + point.latitude,
            longitude: acc.longitude + point.longitude,
        }),
        { latitude: 0, longitude: 0 },
    );

    return {
        latitude: sum.latitude / points.length,
        longitude: sum.longitude / points.length,
    };
}

function formatAddress(record: BuildingRecord): string | null {
    const parts = [record.housenumber, record.street].filter(Boolean);
    return parts.length ? parts.join(" ") : null;
}

function normalizeLabel(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toRgba(color: string, alpha: number): string {
    if (!color.startsWith("#")) {
        return color;
    }

    const hex = color.replace("#", "");
    const fullHex = hex.length === 3
        ? hex.split("").map((channel) => `${channel}${channel}`).join("")
        : hex;

    if (fullHex.length !== 6) {
        return color;
    }

    const red = parseInt(fullHex.slice(0, 2), 16);
    const green = parseInt(fullHex.slice(2, 4), 16);
    const blue = parseInt(fullHex.slice(4, 6), 16);

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}


export default function MapScreen() {
    const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
    const theme = useTheme();
    const polygonRed = theme.cred?.get() ?? "#912338";
    const polygonFill = toRgba(polygonRed, 0.3);
    const polygonFillSelected = toRgba(polygonRed, 0.90);

    const handleSelectBuilding = (id: string) => {
        setSelectedBuildingId(id);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    };

    const addressLookup = useMemo(() => {
        const lookup = new Map<string, { name: string; address: string }>();

        for (const entry of BUILDING_ADDRESSES) {
            lookup.set(normalizeLabel(entry.name), {
                name: entry.name,
                address: entry.address,
            });

            if (entry.aliases) {
                for (const alias of entry.aliases) {
                    lookup.set(normalizeLabel(alias), {
                        name: entry.name,
                        address: entry.address,
                    });
                }
            }
        }

        return lookup;
    }, []);

    const buildings = useMemo(() => {
        return (Object.entries(BUILDING_POLYGONS) as [string, BuildingRecord][])
            .map(([id, record]) => {
                const lookup = addressLookup.get(normalizeLabel(record.name));
                const address = formatAddress(record) ?? lookup?.address ?? null;
                const name = lookup?.name ?? record.name;

                return {
                    id,
                    name,
                    address,
                    polygon: record.polygon,
                };
            })
            .filter((building) => building.polygon.length > 0);
    }, [addressLookup]);

    const selectedBuilding = useMemo(
        () => buildings.find((building) => building.id === selectedBuildingId) ?? null,
        [buildings, selectedBuildingId],
    );

    return (
        <View style={styles.container}>
            <MapView
                style={styles.map}
                provider="google"
                initialRegion={{
                    latitude: 45.4973, // SGW
                    longitude: -73.5789,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                }}
            >
                {buildings.map((building) => {
                    const centroid = polygonCentroid(building.polygon);
                    const isSelected = building.id === selectedBuildingId;

                    return (
                        <React.Fragment key={building.id}>
                            <Polygon
                                coordinates={[...building.polygon]}
                                strokeColor={polygonRed}
                                fillColor={isSelected ? polygonFillSelected : polygonFill}
                                strokeWidth={2}
                                tappable
                                onPress={() => handleSelectBuilding(building.id)}
                            />
                            <Marker
                                coordinate={centroid}
                                onPress={() => handleSelectBuilding(building.id)}
                                anchor={{ x: 0.5, y: 0.5 }}
                                opacity={0}
                            />
                        </React.Fragment>
                    );
                })}
            </MapView>

            <Modal
                transparent
                visible={!!selectedBuilding}
                animationType="fade"
                onRequestClose={() => setSelectedBuildingId(null)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setSelectedBuildingId(null)}>
                    <YStack style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{selectedBuilding?.name}</Text>
                        <Text style={styles.modalAddress}>
                            {selectedBuilding?.address ?? "Address unavailable"}
                        </Text>

                    </YStack>
                </Pressable>
            </Modal>
        </View>
    );
  };

  const ensureLocationPermission = async (): Promise<boolean> => {
    // Check current permission
    const current = await Location.getForegroundPermissionsAsync();

    if (current.status === "granted") return true;

    // Try requesting (OS may show popup only if allowed)
    const requested = await Location.requestForegroundPermissionsAsync();

    if (requested.status === "granted") return true;

    // If still denied, direct user to settings (this covers "Don't ask again" cases)
    promptToOpenSettings();
    return false;
  };

  // Optional: try once when screen opens (won’t always show popup if previously denied)
  useEffect(() => {
    (async () => {
      try {
        await ensureLocationPermission();
      } catch (e) {
        console.log("Permission check error:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToUserLocation = async () => {
    setIsLocating(true);
    try {
      const ok = await ensureLocationPermission();
      if (!ok) return;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;

      mapRef.current?.animateToRegion(
        {
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500
      );
    } catch (error) {
      console.error("Error getting location:", error);
      Alert.alert("Error", "Could not get your location.");
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider="google"
        initialRegion={{
          latitude: 45.4973, // SGW
          longitude: -73.5789,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation
      />

      <Pressable
        onPress={goToUserLocation}
        disabled={isLocating}
        style={{
          position: "absolute",
          bottom: 20,
          right: 20,
          backgroundColor: "#ffffff",
          borderRadius: 50,
          width: 52,
          height: 52,
          justifyContent: "center",
          alignItems: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3,
          elevation: 5,
          opacity: isLocating ? 0.85 : 1,
        }}
      >
        {isLocating ? (
          <ActivityIndicator size="small" color="#c41230" />
        ) : (
          <MaterialIcons name="my-location" size={24} color="#c41230" />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    map: {
        flex: 1,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.35)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    modalContent: {
        width: "100%",
        maxWidth: 320,
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 20,
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 8,
        color: "#1c1c1e",
    },
    modalAddress: {
        fontSize: 14,
        color: "#5a5a5a",
        marginBottom: 16,
    },
    modalButton: {
        alignSelf: "flex-end",
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: "#2f80ed",
        borderRadius: 8,
    },
    modalButtonText: {
        color: "#fff",
        fontWeight: "600",
    },
});
