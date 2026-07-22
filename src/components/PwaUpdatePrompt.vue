<script setup>
import {
  onBeforeUnmount,
  onMounted,
  ref,
} from 'vue'
import {
  useRegisterSW,
} from 'virtual:pwa-register/vue'

const isUpdating = ref(false)

let registration = null
let updateInterval = null

const {
  offlineReady,
  needRefresh,
  updateServiceWorker,
} = useRegisterSW({
  immediate: true,

  onRegistered(serviceWorkerRegistration) {
    registration =
      serviceWorkerRegistration

    registration?.update()

    updateInterval =
      window.setInterval(
        () => {
          registration?.update()
        },
        60 * 60 * 1000,
      )
  },

  onRegisterError(error) {
    console.error(
      'Ошибка регистрации PWA.',
      error,
    )
  },
})

onMounted(() => {
  document.addEventListener(
    'visibilitychange',
    checkForUpdate,
  )
})

onBeforeUnmount(() => {
  document.removeEventListener(
    'visibilitychange',
    checkForUpdate,
  )

  if (updateInterval) {
    window.clearInterval(
      updateInterval,
    )
  }
})

function checkForUpdate() {
  if (
    document.visibilityState ===
    'visible'
  ) {
    registration?.update()
  }
}

function closePrompt() {
  offlineReady.value = false
  needRefresh.value = false
}

async function installUpdate() {
  isUpdating.value = true

  try {
    await updateServiceWorker(true)
  } finally {
    isUpdating.value = false
  }
}
</script>

<template>
  <aside
    v-if="
      offlineReady ||
      needRefresh
    "
    class="pwa-update-prompt"
    role="status"
    aria-live="polite"
  >
    <div class="pwa-update-prompt__icon">
      {{
        needRefresh
          ? '↻'
          : '✓'
      }}
    </div>

    <div class="pwa-update-prompt__copy">
      <strong>
        {{
          needRefresh
            ? 'Доступно обновление'
            : 'Приложение готово'
        }}
      </strong>

      <span>
        {{
          needRefresh
            ? 'Установите новую версию приложения.'
            : 'Теперь оно работает без интернета.'
        }}
      </span>
    </div>

    <button
      v-if="needRefresh"
      class="pwa-update-prompt__button"
      type="button"
      :disabled="isUpdating"
      @click="installUpdate"
    >
      {{
        isUpdating
          ? 'Обновляем…'
          : 'Обновить'
      }}
    </button>

    <button
      class="pwa-update-prompt__close"
      type="button"
      aria-label="Закрыть сообщение"
      @click="closePrompt"
    >
      ×
    </button>
  </aside>
</template>