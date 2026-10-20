<template>
  <v-app>
    <v-navigation-drawer permanent width="260">
      <div class="px-5 pt-5 pb-3">
        <div class="text-xs tracking-[0.3em] text-neutral-500">F1 TIPSPIEL</div>
        <div class="text-lg font-bold mt-1">Wetten</div>
      </div>

      <v-divider />

      <v-list density="comfortable" nav>
        <v-list-subheader>Wetten</v-list-subheader>
        <v-list-item
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          :exact="item.exact"
          :prepend-icon="item.icon"
          :title="item.label"
        />

        <v-divider class="my-2" />

        <v-list-subheader>Übersicht</v-list-subheader>
        <v-list-item
          to="/wettschein"
          prepend-icon="mdi-grid"
          title="Wettschein"
        />
        <v-list-item
          to="/starting-grid"
          prepend-icon="mdi-flag-checkered"
          title="Startaufstellung"
        />
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>

<script lang="ts" setup>
const navItems = [
  { to: '/', exact: true, label: 'Top 3', icon: 'mdi-podium' },
  { to: '/top10', exact: false, label: 'Top 10', icon: 'mdi-format-list-numbered' },
  { to: '/driver-championship', exact: false, label: 'Fahrer-WM', icon: 'mdi-trophy' },
  { to: '/constructor-championship', exact: false, label: 'Konstrukteurs-WM', icon: 'mdi-car-sports' },
  { to: '/team-duell', exact: false, label: 'Team-Duell', icon: 'mdi-sword-cross' },
]
</script>
