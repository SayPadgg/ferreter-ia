require("dotenv").config();

const config = {

    GROQ_API_KEY: process.env.GROQ_API_KEY,

    SHEET_URL: "https://script.google.com/macros/s/AKfycbwbIfpdGqCqmJsKjg0y7zdBMVsaTWFozZHY3lh7aC-d5Ps5QjZitryAfYgoI1oxKzFf/exec"

};

module.exports = config;