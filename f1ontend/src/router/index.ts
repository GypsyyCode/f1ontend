/**
 * router/index.ts
 *
 * Manual routes for ./src/pages/*.vue
 */

// Composables
import { createRouter, createWebHistory } from 'vue-router'
import ConstructorChampionship from '@/pages/constructorChampionship.vue'
import DriverChampionship from '@/pages/driverChampionship.vue'
import DriverOfTheDay from '@/pages/driverOfTheDay.vue'
import FastestLap from '@/pages/fastestLap.vue'
import FirstDnf from '@/pages/firstDnf.vue'
import Index from '@/pages/index.vue'
import Login from '@/pages/login.vue'
import MeinFahrer from '@/pages/meinFahrer.vue'
import Pole from '@/pages/pole.vue'
import StartingGrid from '@/pages/startingGrid.vue'
import TeamDuell from '@/pages/teamDuell.vue'
import Top10 from '@/pages/top10.vue'
import Wettschein from '@/pages/wettschein.vue'
import Punkteliste from '@/pages/punkteliste.vue'

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
      path: '/pole',
      component: Pole,
    },
    {
      path: '/fastest-lap',
      component: FastestLap,
    },
    {
      path: '/first-dnf',
      component: FirstDnf,
    },
    {
      path: '/driver-of-the-day',
      component: DriverOfTheDay,
    },
    {
      path: '/mein-fahrer',
      component: MeinFahrer,
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
    {
      path: '/login',
      component: Login,
    },
    {
      path: '/punkteliste',
      component: Punkteliste,
    },
  ],
})

export default router
