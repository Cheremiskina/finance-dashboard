<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAccountsStore } from '@/stores/accounts'
import { useAllocationStore } from '@/stores/allocation'

const accountsStore = useAccountsStore()
const allocationStore = useAllocationStore()

const selectedDate = ref(getLocalDate())
const successMessage = ref('')

const accountTypes = {
  card: {
    label: 'Банковская карта',
    icon: '💳',
  },

  cash: {
    label: 'Наличные',
    icon: '💵',
  },

  savings: {
    label: 'Накопительный счет',
    icon: '🏦',
  },

  deposit: {
    label: 'Вклад',
    icon: '🔒',
  },

  broker: {
    label: 'Брокерский счет',
    icon: '📈',
  },
}

const sourceAccount = computed(() =>
  accountsStore.activeAccounts.find(
    (account) =>
      account.id ===
      Number(allocationStore.settings.sourceAccountId),
  ),
)

const distribution = computed(() =>
  allocationStore.calculateDistribution(
    sourceAccount.value?.balance ?? 0,
  ),
)

const distributionItems = computed(() =>
  distribution.value.items.map((item) => ({
    ...item,

    account: accountsStore.activeAccounts.find(
      (account) =>
        account.id === Number(item.targetAccountId),
    ),
  })),
)

const targetAccountsAreValid = computed(() =>
  distributionItems.value.every(
    (item) => Boolean(item.account),
  ),
)

const canExecute = computed(
  () =>
    distribution.value.isValid &&
    distribution.value.amountToDistribute > 0 &&
    targetAccountsAreValid.value &&
    !allocationStore.isExecuting,
)

onMounted(async () => {
  await Promise.all([
    accountsStore.loadAccounts(),
    allocationStore.loadSettings(),
    allocationStore.loadRuns(),
  ])
})

function getLocalDate() {
  const now = new Date()

  const localDate = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000,
  )

  return localDate.toISOString().slice(0, 10)
}

function formatMoney(value) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function formatDate(value) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`))
}

function getAccountType(type) {
  return (
    accountTypes[type] ?? {
      label: 'Другой счет',
      icon: '💰',
    }
  )
}

function getAccountName(id) {
  return (
    accountsStore.activeAccounts.find(
      (account) => account.id === Number(id),
    )?.name ?? 'Удаленный счет'
  )
}

async function handleExecute() {
  successMessage.value = ''

  if (!canExecute.value) {
    return
  }

  const shouldExecute = window.confirm(
    `Распределить ${formatMoney(
      distribution.value.amountToDistribute,
    )} между накопительными счетами?`,
  )

  if (!shouldExecute) {
    return
  }

  try {
    await allocationStore.executeDistribution({
      date: selectedDate.value,
    })

    successMessage.value =
      'Распределение выполнено. Переводы добавлены в историю операций.'
  } catch {
    // Сообщение уже сохранено в allocationStore.error.
  }
}
</script>

<template>
  <section class="screen allocation-screen">
    <header class="topbar">
      <div>
        <span class="topbar-label">
          Планировщик денежных потоков
        </span>

        <h1 class="screen-title">
          Распределение
        </h1>
      </div>
    </header>

    <div
      v-if="
        accountsStore.isLoading ||
        allocationStore.isLoading
      "
      class="surface-card"
    >
      Загружаем расчет…
    </div>

    <div
      v-else-if="!sourceAccount"
      class="empty-card"
    >
      <div class="empty-card__icon">⚙️</div>

      <strong>
        Настройте распределение
      </strong>

      <p>
        Выберите основной счет, бюджет на жизнь
        и проценты накоплений.
      </p>

      <RouterLink
        to="/settings"
        class="primary-button"
      >
        Открыть настройки
      </RouterLink>
    </div>

    <template v-else>
      <section class="allocation-source-card">
        <div class="allocation-source-card__account">
          <div
            class="account-avatar"
            :class="`account-avatar--${sourceAccount.type}`"
          >
            {{ getAccountType(sourceAccount.type).icon }}
          </div>

          <div>
            <span>Основной счет</span>
            <strong>{{ sourceAccount.name }}</strong>
          </div>
        </div>

        <div class="allocation-source-card__balance">
          <span>Текущий баланс</span>

          <strong>
            {{ formatMoney(sourceAccount.balance) }}
          </strong>
        </div>
      </section>

      <section class="allocation-result-card">
        <div class="allocation-result-card__label">
          Можно распределить
        </div>

        <strong class="allocation-result-card__value">
          {{
            formatMoney(
              distribution.amountToDistribute,
            )
          }}
        </strong>

        <p>
          Приложение оставит на основном счете
          {{
            formatMoney(
              distribution.amountToKeep,
            )
          }}.
        </p>

        <div class="allocation-result-grid">
          <div>
            <span>На жизнь</span>

            <strong>
              {{
                formatMoney(
                  distribution.lifeBudget,
                )
              }}
            </strong>
          </div>

          <div>
            <span>Резерв</span>

            <strong>
              {{
                formatMoney(
                  distribution.minimumBalance,
                )
              }}
            </strong>
          </div>
        </div>
      </section>

      <section class="allocation-details-card">
        <div class="allocation-details-row">
          <span>Баланс сейчас</span>

          <strong>
            {{
              formatMoney(
                distribution.sourceBalance,
              )
            }}
          </strong>
        </div>

        <div class="allocation-details-row">
          <span>Бюджет на две недели</span>

          <strong>
            {{
              formatMoney(
                distribution.lifeBudget,
              )
            }}
          </strong>
        </div>

        <div class="allocation-details-row">
          <span>Неснижаемый остаток</span>

          <strong>
            {{
              formatMoney(
                distribution.minimumBalance,
              )
            }}
          </strong>
        </div>

        <div
          class="allocation-details-row allocation-details-row--total"
        >
          <span>Останется на счете</span>

          <strong>
            {{
              formatMoney(
                Math.min(
                  distribution.sourceBalance,
                  distribution.amountToKeep,
                ),
              )
            }}
          </strong>
        </div>
      </section>

      <section class="section-block">
        <div class="section-head">
          <div>
            <span class="section-label">
              План переводов
            </span>

            <h2 class="section-title">
              Куда пойдут деньги
            </h2>
          </div>

          <RouterLink
            to="/settings"
            class="text-link"
          >
            Изменить
          </RouterLink>
        </div>

        <div
          v-if="distributionItems.length"
          class="allocation-plan"
        >
          <article
            v-for="item in distributionItems"
            :key="item.targetAccountId"
            class="allocation-plan-row"
          >
            <div class="allocation-plan-row__account">
              <div
                v-if="item.account"
                class="account-avatar"
                :class="`account-avatar--${item.account.type}`"
              >
                {{
                  getAccountType(
                    item.account.type,
                  ).icon
                }}
              </div>

              <div
                v-else
                class="account-avatar"
              >
                ?
              </div>

              <div class="allocation-plan-row__copy">
                <strong>
                  {{
                    item.account?.name ??
                    'Счет не найден'
                  }}
                </strong>

                <span>
                  {{ item.percentage }}%
                </span>
              </div>
            </div>

            <strong class="allocation-plan-row__amount">
              {{ formatMoney(item.amount) }}
            </strong>
          </article>
        </div>
      </section>

      <div
        v-if="
          distribution.amountToDistribute <= 0
        "
        class="allocation-notice"
      >
        <strong>
          Свободных денег пока нет
        </strong>

        <p>
          На основном счете меньше или ровно столько,
          сколько нужно оставить на жизнь и резерв.
        </p>
      </div>

      <div
        v-if="!distribution.isValid"
        class="allocation-warning"
      >
        Проценты распределения должны быть равны 100%.
        Проверьте настройки.
      </div>

      <div
        v-if="!targetAccountsAreValid"
        class="allocation-warning"
      >
        Один из счетов распределения больше не существует.
        Обновите настройки.
      </div>

      <label class="field">
        <span class="field-label">
          Дата переводов
        </span>

        <input
          v-model="selectedDate"
          class="text-input"
          type="date"
        />
      </label>

      <p
        v-if="allocationStore.error"
        class="error-message"
      >
        {{ allocationStore.error }}
      </p>

      <p
        v-if="successMessage"
        class="success-message"
      >
        {{ successMessage }}
      </p>

      <button
        class="primary-button allocation-submit-button"
        type="button"
        :disabled="!canExecute"
        @click="handleExecute"
      >
        {{
          allocationStore.isExecuting
            ? 'Распределяем…'
            : `Распределить ${formatMoney(
                distribution.amountToDistribute,
              )}`
        }}
      </button>

      <section
        v-if="allocationStore.allocationRuns.length"
        class="section-block allocation-history-section"
      >
        <div class="section-head">
          <div>
            <span class="section-label">
              История
            </span>

            <h2 class="section-title">
              Последние распределения
            </h2>
          </div>
        </div>

        <div class="allocation-history-list">
          <article
            v-for="run in allocationStore.allocationRuns.slice(0, 5)"
            :key="run.id"
            class="allocation-history-row"
          >
            <div>
              <strong>
                {{
                  formatMoney(
                    run.amountDistributed,
                  )
                }}
              </strong>

              <span>
                {{ formatDate(run.date) }}
              </span>
            </div>

            <div class="allocation-history-row__targets">
              <span
                v-for="item in run.items"
                :key="item.targetAccountId"
              >
                {{ getAccountName(item.targetAccountId) }}
                ·
                {{ formatMoney(item.amount) }}
              </span>
            </div>
          </article>
        </div>
      </section>
    </template>
  </section>
</template>