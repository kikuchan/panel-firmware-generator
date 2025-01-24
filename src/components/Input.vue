<template>
  <Field :label="props.label" :unit="props.unit" :size="props.size">
    <input
      v-model="modelValue"
      type="number"
      min="0"
      class="h-[1.25rem]! w-full font-mono! text-[1.25rem]! focus:border-none focus:outline-none"
      :disabled="props.disabled" />
  </Field>
</template>

<script lang="ts" setup>
import Field from './Field.vue';

const props = defineProps<{
  label: string;
  unit?: string;
  size?: number | string;
  disabled?: boolean;
}>();

const modelValue = defineModel();
</script>
<style scoped>
.label {
  display: block;
  font-size: 0.8rem;
  font-family: monospace;
  white-space: nowrap;
}

input {
  text-align: right;
  font-family: monospace;
  padding: 0;
}

.unit {
  text-align: right;
  font-size: 8pt;
  font-family: monospace;
}
</style>
