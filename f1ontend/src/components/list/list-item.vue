<template>
  <v-list-item class="font-mono" :subtitle="subtitle" :title="getTitle()">
    <template #title>
			<span class="text-l"><span class="text-s font-sans" :style="{ color }">{{count}}</span> {{getTitle()}}</span>
    </template>
    <template v-if="subtitle !== ''" #subtitle>
			<span class="text-m">{{subtitle}}</span>
    </template>
  </v-list-item>
</template>

<script setup lang="ts">
  const props = defineProps<{
    title?: string | string[]
    subtitle?: string
    count?: number
    /** Farbe der count-Zahl als HEX, z. B. "#e10600" */
    color?: string
  }>()

  function getTitle (): string {
    // Ist title ein Array, den zum aktuellen count gehörenden Eintrag zurückgeben
    if (Array.isArray(props.title)) {
      return props.title[(props.count ?? 1) - 1] ?? ''
    }
    // Sonst den title direkt als String zurückgeben
    return props.title ?? ''
  }
</script>
