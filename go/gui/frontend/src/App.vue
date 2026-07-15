<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { App } from '../bindings/github.com/the1812/Touhou-Tagger/go/gui'

const message = ref('Calling Go...')

onMounted(async () => {
  try {
    message.value = await App.Hello()
  } catch (error) {
    console.error(error)
    message.value = 'Unable to call Go.'
  }
})
</script>

<template>
  <main>
    <p class="eyebrow">Touhou Tagger</p>
    <h1>Hello World</h1>
    <p class="message">{{ message }}</p>
  </main>
</template>
