import axios from "axios";

export async function obtenerInventario() {

    try {
        const res = await axios.get(process.env.SHEET_URL);

        return Array.isArray(res.data)
            ? res.data
            : res.data?.data || [];

    } catch (e) {
        console.log("Sheets error:", e);
        return [];
    }
}