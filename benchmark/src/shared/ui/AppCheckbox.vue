<script setup lang="ts">
defineProps<{
  checked: boolean
}>()

const emit = defineEmits<{
  'update:checked': [value: boolean]
}>()
</script>

<template>
  <button
    type="button"
    role="checkbox"
    :aria-checked="checked"
    :class="[
      'size-4 shrink-0 rounded-[4px] border shadow-xs transition-colors outline-none',
      'focus-visible:ring-2 focus-visible:ring-ring/50',
      checked
        ? 'bg-primary border-primary text-primary-foreground'
        : 'border-input bg-background',
    ]"
    @click="emit('update:checked', !checked)"
  >
    <svg
      v-if="checked"
      viewBox="0 0 12 12"
      fill="none"
      class="size-3 mx-auto"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polyline points="2,6 5,9 10,3" />
    </svg>
  </button>
</template>
