<template>
  <div class="relative flex w-min flex-col items-baseline font-mono">
    <div
      class="mt-5 mb-4 ml-0 flex h-7 w-full items-center justify-stretch rounded bg-white px-0.5 text-nowrap outline focus-within:outline-2 has-disabled:bg-gray-200 has-disabled:text-gray-400 aria-readonly:bg-gray-200 aria-readonly:outline-gray-400"
      :style="{ minWidth: width }"
      v-bind="$attrs"
      :aria-readonly="props.readonly">
      <slot />
    </div>
    <div class="-mt-16 text-sm text-nowrap select-none">{{ props.label }}&nbsp;</div>
    <div v-if="!props.noUnit" class="mt-7 self-end text-xs select-none">&nbsp;{{ props.unit }}</div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
defineOptions({
  inheritAttrs: false,
});

const props = defineProps<{
  label: string;
  unit?: string;
  size?: number | string;
  noUnit?: boolean;
  readonly?: boolean;
}>();

const width = computed(() => (Number(props.size) || 4) + 'rem');
</script>
