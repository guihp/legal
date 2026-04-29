import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { writeFileSync } from "fs";
import { createHash } from "crypto";

/**
 * Plugin Vite que gera um arquivo `build-meta.json` na pasta de saída
 * a cada build. Contém um hash único que muda a cada deploy, permitindo
 * que o front-end detecte novas versões automaticamente.
 */
function buildMetaPlugin(): Plugin {
  return {
    name: 'build-meta',
    apply: 'build',
    closeBundle() {
      const buildHash = createHash('sha256')
        .update(Date.now().toString() + Math.random().toString())
        .digest('hex')
        .slice(0, 16);
      const meta = JSON.stringify({ buildHash, buildTime: new Date().toISOString() });
      writeFileSync(path.resolve(__dirname, 'dist', 'build-meta.json'), meta);
      console.log(`[build-meta] Generated build hash: ${buildHash}`);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8081,
    strictPort: true, // Não trocar de porta se 8081 estiver ocupada
    proxy: {
      '/api/webhook': {
        target: 'https://webhooklabz.n8nlabz.com.br',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/webhook/, '/webhook'),
        secure: true,
        headers: {
          'Origin': 'https://webhooklabz.n8nlabz.com.br'
        }
      }
    }
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
    buildMetaPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ['react-pdf'],
  },
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
  // Sem manualChunks: splits manuais (recharts/d3, date-fns, radix, MUI…) geraram
  // em produção TDZ e `undefined.createContext` por ordem de carregamento + modulepreload.
  // O Rollup/Vite faz code-splitting seguro por rota/import dinâmico.
  define: {
    global: 'globalThis',
  },
}));
