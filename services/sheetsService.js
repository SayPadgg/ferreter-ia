import axios from "axios";

const SHEET_URL = process.env.SHEET_URL;

export async function buscarProducto(query) {

    try {

        const res = await axios.get(SHEET_URL);

        let data = res.data;

        // 🔥 normalizar respuestas de Apps Script
        if (Array.isArray(data)) {
            data = data;
        } else if (data?.data) {
            data = data.data;
        } else if (data?.result) {
            data = data.result;
        } else if (data?.values) {
            data = data.values;
        } else {
            data = [];
        }

        const q = query.toLowerCase();

        return data.filter(item => {

            const nombre =
                (item.nombre || item[0] || "").toLowerCase();

            return nombre.includes(q);
        });

    } catch (error) {
        console.error("❌ Error Sheet:", error);
        return [];
    }
}