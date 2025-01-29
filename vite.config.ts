import { defineConfig, loadEnv } from "vite";
import logseqDevPlugin from "vite-plugin-logseq";
import { viteStaticCopy } from "vite-plugin-static-copy";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      logseqDevPlugin(),
      viteStaticCopy({
        targets: [
          {
            src: "public/oauth-callback.html",
            dest: "."
          }
        ]
      })
    ],
    // Makes HMR available for development
    build: {
      target: "esnext",
      minify: "esbuild",
    },
    define: {
      "process.env.GOOGLE_CLIENT_ID": JSON.stringify(env.GOOGLE_CLIENT_ID),
      "process.env.GOOGLE_CLIENT_SECRET": JSON.stringify(env.GOOGLE_CLIENT_SECRET)
    }
  };
});
