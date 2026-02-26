import { StyleSheet } from "react-native";

export const loginStyles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        padding: 25,
        alignItems: "center",
    },

    // BIGGER ICON
    logo: {
        width: 140,
        height: 140,
        marginBottom: 35,
    },

    title: {
        fontSize: 28,
        fontWeight: "800",
        color: "#1b4332",
    },

    subtitle: {
        fontSize: 16,
        color: "#4a7856",
        marginBottom: 30,
        fontStyle: "italic",
    },

    // ERROR BOX
    errorBox: {
        flexDirection: "row",
        backgroundColor: "#e63946",
        padding: 10,
        paddingHorizontal: 15,
        borderRadius: 12,
        alignItems: "center",
        marginBottom: 20,
    },

    errorText: {
        color: "#fff",
        marginLeft: 8,
        fontWeight: "600",
        fontSize: 14,
    },

    // INPUTS
    inputContainer: {
        width: "100%",
        marginBottom: 20,
    },

    inputWrapper: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#ffffffdd",
        borderRadius: 14,
        paddingHorizontal: 12,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: "#cfe7d6",
    },

    icon: {
        marginRight: 10,
    },

    input: {
        flex: 1,
        height: 48,
        fontSize: 16,
        color: "#333",
    },

    // BUTTON
    button: {
        width: "100%",
        borderRadius: 14,
        marginBottom: 15,
        overflow: "hidden",
    },

    buttonGradient: {
        paddingVertical: 15,
        alignItems: "center",
        borderRadius: 14,
    },

    buttonText: {
        color: "#fff",
        fontSize: 17,
        fontWeight: "700",
    },

    link: {
        marginTop: 10,
        fontSize: 15,
        color: "#4a7856",
    },

    linkHighlight: {
        fontWeight: "700",
        color: "#40916c",
    },
});
