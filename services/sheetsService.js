import axios from "axios";

const SHEET_URL = process.env.SHEET_URL;

export async function buscarProducto(query) {

    try {

        const res = await axios.get(SHEET_URL);
        const data = res.data;

        if (!Array.isArray(data)) return [];

        const q = query.toLowerCase();

        return data.filter(item =>
            item.nombre?.toLowerCase().includes(q)
        );

    } catch (error) {
        console.error("Error Sheet:", error);
        return [];
    }
}