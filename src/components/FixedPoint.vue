<template>
  <span>
    <span class="upper">{{ props.value.toFixed(upper + lower).slice(0, lower ? -lower : undefined) }}</span>
    <span class="lower text-slate-400" v-if="lower">{{ props.value.toFixed(upper + lower).slice(-lower) }}</span>
  </span>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
const props = withDefaults(
  defineProps<{
    value: number;
    upper?: string | number;
    lower?: string | number;
    unit?: string;
  }>(),
  {
    upper: 2,
    lower: 3,
  },
);

const upper = computed(() => Number(props.upper));
const lower = computed(() => Number(props.lower));
</script>

<style scoped>
span.lower {
  font-size: 75%;
  font-weight: normal;
}
</style>
