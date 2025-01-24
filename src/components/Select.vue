<template>
  <Field :label="props.label" :unit="props.unit" :size="props.size">
    <select v-model="modelValue" :disabled="props.disabled" class="font-mono! text-[1.25rem]!" v-bind="$attrs">
      <slot />
    </select>
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
}

select {
  font-family: monospace;
  padding: 0 1ch;
}

.unit {
  text-align: right;
  font-size: 8pt;
  font-family: monospace;
}
</style>
