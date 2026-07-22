<script setup>
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
} from 'vue'
import {
  getLastBackupAt,
  getStorageHealth,
  requestPersistentStorage,
} from '@/services/dataHealth'

const storageHealth = ref({
  supported: false,
  persistent: null,
  usage: null,
  quota: null,
})

const lastBackupAt = ref(null)
const isLoading = ref(true)
const isRequesting = ref(false)
const storageMessage = ref('')

const appVersion =
  import.meta.env.VITE_APP_VERSION ||
  'development'

const backupAgeDays = computed(() => {
  if (!lastBackupAt.value) {
    return null
  }

  const backupDate =
    new Date(lastBackupAt.value)

  return Math.floor(
    (
      Date.now() -
      backupDate.getTime()
    ) /
      (24 * 60 * 60 * 1000),
  )
})

const backupIsOld = computed(
  () =>
    backupAgeDays.value === null ||
    backupAgeDays.value >= 14,
)

const storageTitle = computed(() => {
  if (
    storageHealth.value.persistent ===
    true
  ) {
    return 'Данные защищены'
  }

  if (
    !storageHealth.value.supported
  ) {
    return 'Проверка недоступна'
  }

  return 'Обычное хранилище'
})

const storageDescription = computed(() => {
  if (
    storageHealth.value.persistent ===
    true
  ) {
    return (
      'Браузер подтвердил постоянное ' +
      'хранение данных приложения.'
    )
  }

  if (
    !storageHealth.value.supported
  ) {
    return (
      'Этот браузер не позволяет проверить ' +
      'режим хранения.'
    )
  }

  return (
    'Браузер пока не подтвердил постоянное ' +
    'хранение. Регулярно создавайте копии.'
  )
})

onMounted(async () => {
  await loadHealth()

  window.addEventListener(
    'finance-backup-created',
    refreshBackupDate,
  )
})

onBeforeUnmount(() => {
  window.removeEventListener(
    'finance-backup-created',
    refreshBackupDate,
  )
})

async function loadHealth() {
  isLoading.value = true

  try {
    storageHealth.value =
      await getStorageHealth()

    refreshBackupDate()
  } finally {
    isLoading.value = false
  }
}

function refreshBackupDate() {
  lastBackupAt.value =
    getLastBackupAt()
}

async function protectStorage() {
  isRequesting.value = true
  storageMessage.value = ''

  try {
    const result =
      await requestPersistentStorage()

    storageHealth.value =
      await getStorageHealth()

    if (!result.supported) {
      storageMessage.value =
        'Этот браузер не поддерживает запрос постоянного хранилища.'

      return
    }

    storageMessage.value =
      result.granted
        ? 'Браузер подтвердил постоянное хранение данных.'
        : 'Браузер не предоставил постоянное хранилище. Продолжайте создавать резервные копии.'
  } finally {
    isRequesting.value = false
  }
}

function formatDateTime(value) {
  if (!value) {
    return 'Резервная копия ещё не создавалась'
  }

  return new Intl.DateTimeFormat(
    'ru-RU',
    {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
  ).format(new Date(value))
}

function formatBytes(value) {
  const bytes = Number(value)

  if (
    !Number.isFinite(bytes) ||
    bytes < 0
  ) {
    return 'Неизвестно'
  }

  if (bytes < 1024) {
    return `${bytes} Б`
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return (
      `${(
        bytes / 1024
      ).toFixed(1)} КБ`
    )
  }

  return (
    `${(
      bytes /
      (1024 * 1024)
    ).toFixed(1)} МБ`
  )
}
</script>

<template>
  <section class="settings-card data-health-card">
    <div class="settings-card__heading">
      <div
        class="settings-card__icon settings-card__icon--health"
      >
        🛡️
      </div>

      <div>
        <h2>
          Состояние данных
        </h2>

        <p>
          Проверка локального хранилища,
          резервных копий и версии приложения.
        </p>
      </div>
    </div>

    <div
      v-if="isLoading"
      class="data-health-loading"
    >
      Проверяем состояние…
    </div>

    <template v-else>
      <article class="data-health-row">
        <div
          class="data-health-status-icon"
          :class="{
            'data-health-status-icon--success':
              storageHealth.persistent,
          }"
        >
          {{
            storageHealth.persistent
              ? '✓'
              : '!'
          }}
        </div>

        <div class="data-health-row__copy">
          <strong>
            {{ storageTitle }}
          </strong>

          <span>
            {{ storageDescription }}
          </span>
        </div>

        <button
          v-if="
            storageHealth.supported &&
            !storageHealth.persistent
          "
          class="data-health-action"
          type="button"
          :disabled="isRequesting"
          @click="protectStorage"
        >
          {{
            isRequesting
              ? 'Проверяем…'
              : 'Защитить'
          }}
        </button>
      </article>

      <article
        class="data-health-row"
        :class="{
          'data-health-row--warning':
            backupIsOld,
        }"
      >
        <div
          class="data-health-status-icon"
          :class="{
            'data-health-status-icon--success':
              !backupIsOld,
          }"
        >
          {{
            backupIsOld
              ? '!'
              : '✓'
          }}
        </div>

        <div class="data-health-row__copy">
          <strong>
            Резервная копия
          </strong>

          <span>
            {{
              formatDateTime(
                lastBackupAt,
              )
            }}
          </span>

          <small
            v-if="
              backupAgeDays !== null
            "
          >
            {{
              backupAgeDays === 0
                ? 'Создана сегодня'
                : `Прошло ${backupAgeDays} дн.`
            }}
          </small>
        </div>
      </article>

      <div class="data-health-grid">
        <div>
          <span>
            Использовано
          </span>

          <strong>
            {{
              formatBytes(
                storageHealth.usage,
              )
            }}
          </strong>
        </div>

        <div>
          <span>
            Версия
          </span>

          <strong>
            {{ appVersion }}
          </strong>
        </div>
      </div>

      <p
        v-if="storageMessage"
        class="data-health-message"
      >
        {{ storageMessage }}
      </p>
    </template>
  </section>
</template>