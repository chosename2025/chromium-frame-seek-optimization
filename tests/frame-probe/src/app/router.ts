import { createRouter, createWebHistory } from 'vue-router'
import RunnerPage from '@/pages/runner/RunnerPage.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: RunnerPage },
  ],
})

export default router