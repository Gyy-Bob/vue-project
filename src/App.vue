<template>
  <router-view />
  <div class="toast-wrap">
    <div v-for="t in toastState.list" :key="t.id" class="toast" :class="t.type">
      {{ t.text }}
    </div>
  </div>
</template>

<script setup>
import { toastState } from '@/composables/toast'
</script>
