import nextConfig from "eslint-config-next";

export default [
  ...nextConfig,
  {
    rules: {
      // Permitir any en tests y archivos de tipos generados
      "@typescript-eslint/no-explicit-any": "warn",
      // Next.js ya maneja los imports de React
      "react/react-in-jsx-scope": "off",
    },
  },
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "supabase/functions/**",
      "src/types/database.ts",
    ],
  },
];
