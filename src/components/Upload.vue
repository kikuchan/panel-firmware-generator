<template>
  <button @click="onClick()">
    <slot />
    <input ref="file" type="file" @input="onUpload" class="hidden" v-bind="$attrs" />
  </button>
</template>

<script lang="ts" setup>
defineOptions({
  inheritAttrs: false,
});
const file = ref<HTMLInputElement>();

function onClick() {
  file.value!.click();
}

const emit = defineEmits(['upload']);

async function onUpload(e: Event) {
  const obj = e.target as HTMLInputElement;
  if (!obj.files) return;

  const file = obj.files[0];

  emit('upload', await file.bytes(), file);
}
</script>

<style scoped>
@import 'tailwindcss';

button {
  @apply cursor-pointer rounded border-2 border-slate-500 bg-slate-200 px-2 text-base hover:bg-slate-300;
  @apply aria-selected:bg-indigo-300;
  @apply disabled:border-slate-300 disabled:text-slate-400;
}
</style>
