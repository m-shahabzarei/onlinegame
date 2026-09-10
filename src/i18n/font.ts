import localFont from "next/font/local";

export const persianFont = localFont({
  src: [
    { path: "../../fonts/Vazir-Thin.woff2", weight: "100", style: "normal" },
    { path: "../../fonts/Vazir-Light.woff2", weight: "300", style: "normal" },
    { path: "../../fonts/Vazir.woff2", weight: "400", style: "normal" },
    { path: "../../fonts/Vazir-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../fonts/Vazir-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-vazirmatn",
  display: "swap",
});
