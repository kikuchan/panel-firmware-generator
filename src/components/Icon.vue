<template>
  <svg style="display: inline-block; width: 1.25em; height: 1.25em" class="align-middle" viewBox="0 0 24 24">
    <path :d="icons[props.name]" />
  </svg>
</template>

<script lang="ts" setup>
const icons = {
  download: 'M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z',
  upload: 'M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z',
};

const props = defineProps<{
  name: keyof typeof icons;
}>();
</script>
