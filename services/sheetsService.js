const axios = require("axios");

async function obtenerInventario() {

    try {

        const res = await axios.get(process.env.SHEET_URL);

        return Array.isArray(res.data)
            ? res.data
            : res.data?.data || [];

    } catch (err) {

        console.log("Error Sheets:", err);
        return [];
    }
}

module.exports = {
    obtenerInventario
};