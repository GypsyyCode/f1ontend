/**
 * router/index.ts
 *
 * Manual routes for ./src/pages/*.vue
 */

// Composables
import { createRouter, createWebHistory } from 'vue-router'
import ConstructorChampionship from '@/pages/constructorChampionship.vue'
import DriverChampionship from '@/pages/driverChampionship.vue'
import Index from '@/pages/index.vue'
import StartingGrid from '@/pages/startingGrid.vue'
import TeamDuell from '@/pages/teamDuell.vue'
import Top10 from '@/pages/top10.vue'
import Wettschein from '@/pages/wettschein.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: Index,
    },
    {
      path: '/top10',
      component: Top10,
    },
    {
      path: '/driver-championship',
      component: DriverChampionship,
    },
    {
      path: '/constructor-championship',
      component: ConstructorChampionship,
    },
    {
      path: '/team-duell',
      component: TeamDuell,
    },
    {
      path: '/wettschein',
      component: Wettschein,
    },
    {
      path: '/starting-grid',
      component: StartingGrid,
    },
  ],
})

export default router
