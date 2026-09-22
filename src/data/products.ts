export type ProductCategory = "bike" | "scooter";
export type Product = { slug: string; name: string; category: ProductCategory; price: number; images: string[]; eyebrow: string };
const p = (name: string) => `/products/${name}`;
export const products: Product[] = [
  { slug: "jasion-thunder-pro", name: "Jasion Thunder PRO", category: "bike", price: 3400, eyebrow: "Electric bike", images: [p("Jasion Thunder PRO azul - $3400.jpeg"), p("Jasion Thunder PRO negra - $3400.jpeg")] },
  { slug: "jasion-eb5-ultra-e", name: "Jasion EB5 Ultra E", category: "bike", price: 2900, eyebrow: "Electric bike", images: [p("Jasion EB5 Ultra E azul - $2900.jpeg"), p("Jasion EB5 Ultra E negra - $2900.jpeg")] },
  { slug: "jasion-eb6-foldable-e", name: "Jasion EB6 Foldable E", category: "bike", price: 900, eyebrow: "Electric bike", images: [p("Jasion EB6 Foldable E azul - BIKE - $900.jpeg"), p("Jasion EB6 Foldable E negra - BIKE - $900.jpeg"), p("Jasion EB6 Foldable E rosa - BIKE - $900.jpeg")] },
  { slug: "jaison-retrovolt", name: "Jaison RetroVolt", category: "bike", price: 2400, eyebrow: "Electric bike", images: [p("JAISON RetroVolt - $2400.jpeg")] },
  { slug: "tst-e-bike", name: "TST E-BIKE", category: "bike", price: 1800, eyebrow: "Electric bike", images: [p("TST E-BIKE - $1800.jpeg")] },
  { slug: "hiboy-s2-pro", name: "Hiboy S2 Pro", category: "scooter", price: 700, eyebrow: "Electric scooter", images: [p("Hiboy S2 Pro 1 - $700.jpeg"), p("Hiboy S2 Pro 2 - $700.jpeg")] },
  { slug: "hiboy-s2-max", name: "Hiboy S2 MAX", category: "scooter", price: 550, eyebrow: "Electric scooter", images: [p("Hiboy S2 MAX 1 - $550.jpeg"), p("Hiboy S2 MAX 2 - $550.jpeg")] },
  { slug: "navee-ut5-ultra-xut5", name: "NAVEE UT5 Ultra XUT5", category: "scooter", price: 1700, eyebrow: "Electric scooter", images: [p("NAVEE UT5 Ultra XUT5 1 -  $1700.jpeg"), p("NAVEE UT5 Ultra XUT5 2 -  $1700.jpeg")] },
  { slug: "navee-gt3", name: "NAVEE GT3", category: "scooter", price: 800, eyebrow: "Electric scooter", images: [p("NAVEE GT3  - $800.jpeg")] },
];
export const bikes = products.filter((product) => product.category === "bike");
export const scooters = products.filter((product) => product.category === "scooter");
export function formatPrice(price: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(price); }
