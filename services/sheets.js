const axios = require("axios");
const config = require("../config/config");

async function obtenerInventario() {

    try {

        const response = await axios.get(config.SHEET_URL);

        return response.data;

    } catch (error) {

        console.log("Error consultando Sheets:", error);

        return [];
    }
}

module.exports = {
    obtenerInventario
};