<script setup>
import PwaUpdatePrompt from '@/components/PwaUpdatePrompt.vue'
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="app-shell">
    <div class="app-frame">
      <main class="app-content">
        <RouterView />
      </main>

      <nav class="bottom-navigation" aria-label="Основная навигация">
        <RouterLink to="/" class="navigation-item">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5z" />
            <path d="M9 21v-7h6v7" />
          </svg>

          <span>Главная</span>
        </RouterLink>

        <RouterLink to="/accounts" class="navigation-item">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="5" width="18" height="14" rx="3" />
            <path d="M3 9h18" />
            <path d="M16 14h2" />
          </svg>

          <span>Счета</span>
        </RouterLink>

        <RouterLink to="/transactions" class="navigation-item">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M7 4v16" />
            <path d="m3 8 4-4 4 4" />
            <path d="M17 20V4" />
            <path d="m13 16 4 4 4-4" />
          </svg>

          <span>Операции</span>
        </RouterLink>

        <RouterLink to="/allocation" class="navigation-item">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="2.5" />
            <circle cx="17" cy="17" r="2.5" />
            <path d="m6 19 12-14" />
          </svg>

          <span>Доход</span>
        </RouterLink>

        <RouterLink to="/settings" class="navigation-item">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2.8v2" />
            <path d="M12 19.2v2" />
            <path d="m5.5 5.5 1.4 1.4" />
            <path d="m17.1 17.1 1.4 1.4" />
            <path d="M2.8 12h2" />
            <path d="M19.2 12h2" />
            <path d="m5.5 18.5 1.4-1.4" />
            <path d="m17.1 6.9 1.4-1.4" />
          </svg>

          <span>Настройки</span>
        </RouterLink>
      </nav>
    </div>
    <PwaUpdatePrompt />
  </div>
</template>