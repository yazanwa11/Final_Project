import { StyleSheet } from "react-native";

export const signupStyles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        padding: 25,
        alignItems: "center",
    },

    // SAME ICON SIZE AS LOGIN
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

    // SAME BUTTON AS LOGIN
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

    // MODAL (UNCHANGED)
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.35)",
        justifyContent: "center",
        alignItems: "center",
    },

    modalCard: {
        width: "80%",
        backgroundColor: "#fff",
        padding: 25,
        borderRadius: 20,
        alignItems: "center",
        elevation: 8,
    },

    modalTitle: {
        fontSize: 22,
        fontWeight: "700",
        color: "#333",
        marginTop: 15,
    },

    modalMessage: {
        fontSize: 15,
        textAlign: "center",
        color: "#555",
        marginVertical: 10,
    },

    modalButton: {
        backgroundColor: "#4CAF50",
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 10,
        marginTop: 10,
    },

    modalButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },
});
