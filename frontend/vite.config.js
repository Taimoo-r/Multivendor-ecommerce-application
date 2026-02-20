import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tailwindcss({
      theme: {
        fontFamily: {
          Roboto: ["Roboto", "sans-serif"],
          Poppins: ["Poppins", "sans-serif"],
        },
        extend: {
          screens: {
            "400px": "400px",
            "800px": "800px",
            "1000px": "1050px",
            "1100px": "1110px",
            "1300px": "1300px",
          },
        },
      },
    }),
    react(),
  ],
});
