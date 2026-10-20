import { createPinia } from 'pinia';
import router from '../router';
import i18n from './i18n';
import { piniaIdbPlugin } from './piniaIdb';
/**
 * plugins/index.ts
 *
 * Automatically included in `./src/main.ts`
 */

// Types
import type { App } from 'vue'

// Plugins
import vuetify from './vuetify'

export function registerPlugins (app: App) {
 const pinia = createPinia()
 pinia.use(piniaIdbPlugin)

 app.use(vuetify)
 app.use(pinia);
 app.use(i18n);
 app.use(router);
}
