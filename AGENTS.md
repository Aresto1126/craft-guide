# Project instructions

## Authority and scope
The user authorized all implementation phases together. Continue without phase approval prompts. Preserve existing projects. Create this new project under C:\CodexApp. Use reasonable defaults for small details; ask only for material missing requirements. Do not change AI models without explaining the recommendation.

## Stack and architecture
Tauri 2 Windows desktop, WebView2, Rust for native storage/OS operations, HTML/CSS/JavaScript ES modules, Vite. No React. Explain any additional library before adoption. Share views and domain logic with the browser edition. Separate UI, domain, validation, storage. Use a common platform adapter. Windows build and Web publishing are independent.

## Data and security
Japanese UI; ordinary local features offline. Windows data in app-data JSON, Web data in localStorage. JSON import/export, versioning/migration, input and reference validation. Do not silently initialize or overwrite corrupt data. Protect old data on failed writes; show Japanese errors. Minimal Tauri capabilities; native commands independently validate input. Do not transmit registered data without explicit user request. No cloud sync, custom login or auto-update unless requested. No paid APIs, extra credits or hosting charges. No game file modification. Do not include personal data, credentials, caches or build outputs in Git.

## Distribution and checks
Generate Windows installer with WebView2 handling. Publish Web edition free through public GitHub repo and Pages. Git history and Actions test/build/deploy. Assets must work under Pages subpath. Node standard tests for domain/validation, Playwright for UI. Verify native startup and save/reload. Verify production Web build/subpath and actual public URL before claiming published. Tests must not modify existing user data. Document installer, URL, source, usage, test results and exact unfinished items.

## Product/UI
Minecraft Java vanilla, modpacks and custom instances. User-managed environment list and settings tabs: instance management, appearance, AI integration, custom instructions. Light plains and dark cave scenery is INSIDE app window only, behind translucent panels. Accessible Japanese normal body font with original pixel decorations, scalable text, opacity/background controls. Search/calculation/storage local. Label curated reference vs static extraction vs unverified runtime changes. No claim of universal MOD support.
