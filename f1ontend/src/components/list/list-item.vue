<template>
  <v-list-item class="font-mono bg-surface-container" :subtitle="subtitle" :title="title">
    <template #prepend>
      <v-icon
        v-if="reorderable"
        icon="mdi-drag"
        size="18"
        class="text-neutral-400 me-1"
      />
    </template>
    <template #title>
      <span class="text-l"><span class="text-s font-sans" :style="{ color }">{{count}}</span> {{title}}</span>
    </template>
    <template v-if="subtitle !== ''" #subtitle>
      <span class="text-m">{{subtitle}}</span>
    </template>
    <template v-if="reorderable" #append>
      <v-btn
        icon="mdi-chevron-up"
        variant="text"
        size="small"
        density="comfortable"
        :disabled="!canMoveUp"
        @click.stop="$emit('move-up')"
      />
      <v-btn
        icon="mdi-chevron-down"
        variant="text"
        size="small"
        density="comfortable"
        :disabled="!canMoveDown"
        @click.stop="$emit('move-down')"
      />
    </template>
  </v-list-item>
</template>

<script setup lang="ts">
  defineProps<{
    title: string
    subtitle?: string
    count: number
    /** Farbe der count-Zahl als HEX, z. B. "#e10600" */
    color?: string
    /** Zeigt Drag-Griff + Up/Down-Buttons an. */
    reorderable?: boolean
    canMoveUp?: boolean
    canMoveDown?: boolean
  }>()

  defineEmits<{
    'move-up': []
    'move-down': []
  }>()
</script>
