import { defineConfig } from 'vite';
export default defineConfig({base:process.env.VITE_BASE_PATH||'./',server:{strictPort:true,port:1420,watch:{ignored:['**/src-tauri/**','**/.npm-cache/**','**/artifacts/**']}},build:{target:'es2022'}});
