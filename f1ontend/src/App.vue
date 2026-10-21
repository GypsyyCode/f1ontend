<template>
  <v-app class="bg-taupe-200">
    <v-navigation-drawer class="bg-taupe-300" permanent width="260">
      <div class="px-5 pt-5 pb-3">
        <div class="text-xs tracking-[0.3em] text-neutral-500">F1 TIPSPIEL</div>
        <div class="text-lg font-bold mt-1">Wetten</div>
      </div>

      <v-divider />

      <v-list class="bg-taupe-300" density="comfortable" nav>
        <template v-for="group in navGroups" :key="group.title">
          <v-list-subheader>{{ group.title }}</v-list-subheader>
          <v-list-item
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            :exact="item.exact"
            :prepend-icon="item.icon"
            :title="item.label"
          />
        </template>

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
const navGroups = [
  {
    title: 'Mein Fahrer',
    items: [
      { to: '/mein-fahrer', exact: false, label: 'Mein Fahrer', icon: 'mdi-account-star' },
      { to: '/driver-championship', exact: false, label: 'Fahrer-WM', icon: 'mdi-trophy' },
      { to: '/constructor-championship', exact: false, label: 'Konstrukteurs-WM', icon: 'mdi-car-sports' },
    ],
  },
  {
    title: 'Renn-Wetten',
    items: [
      { to: '/', exact: true, label: 'Top 3', icon: 'mdi-podium' },
      { to: '/top10', exact: false, label: 'Top 10', icon: 'mdi-format-list-numbered' },
      { to: '/pole', exact: false, label: 'Pole Position', icon: 'mdi-timer-outline' },
      { to: '/fastest-lap', exact: false, label: 'Schnellste Runde', icon: 'mdi-speedometer' },
      { to: '/first-dnf', exact: false, label: 'Erster Ausfall', icon: 'mdi-car-brake-alert' },
      { to: '/driver-of-the-day', exact: false, label: 'Fahrer des Tages', icon: 'mdi-star-circle' },
    ],
  },
  {
    title: 'Saison-Wetten',
    items: [
      { to: '/team-duell', exact: false, label: 'Team-Duell', icon: 'mdi-sword-cross' },
    ],
  },
]
</script>
