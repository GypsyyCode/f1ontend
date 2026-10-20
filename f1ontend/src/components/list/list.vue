<template>
	<v-list lines="two" class="mx-4 px-4 py-1 rounded-2xl">
		<ListItem
			v-for="n in 3"
			:key="n"
			:subtitle
			:title
			:count="n"
			:color="colors?.[n - 1]"
		/>
	</v-list>
</template>

<script setup lang="ts">
import ListItem from './list-item.vue'

  defineProps<{
    title?: string | string[]
    subtitle?: string
    count?: number
    /** HEX-Farbe pro Item für die count-Zahl, z. B. ["#e10600", "#00d2be", "#ff8700"] */
    colors?: string[]
  }>()
</script>
