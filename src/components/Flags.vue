<template>
  <div class="font-mono">
    <div class="text-sm text-nowrap select-none">{{ label }}</div>
    <div class="flex flex-wrap items-baseline gap-4">
      <div v-for="(flagGroup, gidx) in props.flags" :key="gidx">
        <label
          class="block px-1 text-base select-none hover:bg-black/5 has-disabled:text-gray-400 has-disabled:hover:bg-transparent"
          v-for="(flag, idx) in flagGroup"
          :key="idx">
          <input type="checkbox" v-model="modelValue[flag]" :disabled="props.disabled" />
          <span class="ml-1">{{ flag }}</span>
        </label>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup generic="T extends Record<string, boolean>">
const modelValue = defineModel<T>({ default: {} });

const props = defineProps<{
  flags: string[][];
  label: string;
  disabled?: boolean;
}>();
</script>
