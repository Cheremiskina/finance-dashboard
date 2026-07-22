<script setup>
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useAccountsStore } from '@/stores/accounts'
import { useAllocationStore } from '@/stores/allocation'
import { useTransactionsStore } from '@/stores/transactions'

const accountsStore = useAccountsStore()
const allocationStore = useAllocationStore()
const transactionsStore = useTransactionsStore()

const today = getLocalDate()

const accountTypes = {
  card: {
    label: 'Карта',
    icon: '💳',
  },

  cash: {
    label: 'Наличные',
    icon: '💵',
  },

  savings: {
    label: 'Накопления',
    icon: '🏦',
  },

  deposit: {
    label: 'Вклад',
    icon: '🔒',
  },

  broker: {
    label: 'Инвестиции',
    icon: '📈',
  },
}

const transactionTypes = {
  income: {
    label: 'Доход',
    icon: '↓',
  },

  expense: {
    label: 'Расход',
    icon: '↑',
  },

  transfer: {
    label: 'Перевод',
    icon: '↔',
  },
}

const isLoading = computed(
  () =>
    accountsStore.isLoading ||
    allocationStore.isLoading ||
    transactionsStore.isLoading,
)

const sortedAccounts = computed(() =>
  [...accountsStore.activeAccounts].sort(
    (first, second) =>
      Number(second.balance) -
      Number(first.balance),
  ),
)

const topAccounts = computed(() =>
  sortedAccounts.value.slice(0, 4),
)

const recentTransactions = computed(() =>
  transactionsStore.transactions.slice(0, 4),
)

const cashBalance = computed(() =>
  accountsStore.activeAccounts
    .filter((account) =>
      ['card', 'cash'].includes(account.type),
    )
    .reduce(
      (sum, account) =>
        sum + Number(account.balance || 0),
      0,
    ),
)

const savingsBalance = computed(() =>
  accountsStore.activeAccounts
    .filter((account) =>
      ['savings', 'deposit'].includes(
        account.type,
      ),
    )
    .reduce(
      (sum, account) =>
        sum + Number(account.balance || 0),
      0,
    ),
)

const investmentsBalance = computed(() =>
  accountsStore.activeAccounts
    .filter(
      (account) =>
        account.type === 'broker',
    )
    .reduce(
      (sum, account) =>
        sum + Number(account.balance || 0),
      0,
    ),
)

const sourceAccount = computed(() =>
  accountsStore.activeAccounts.find(
    (account) =>
      account.id ===
      Number(
        allocationStore.settings
          .sourceAccountId,
      ),
  ),
)

const salaryInfo = computed(() =>
  allocationStore.getSalaryScheduleInfo(
    today,
  ),
)

const distribution = computed(() =>
  allocationStore.calculateDistribution(
    sourceAccount.value?.balance ?? 0,
  ),
)

const allocationIsConfigured = computed(
  () =>
    Boolean(sourceAccount.value) &&
    distribution.value.isValid,
)

const periodProgress = computed(() => {
  const periodLength = Number(
    salaryInfo.value.periodLengthDays || 0,
  )

  const remaining = Number(
    salaryInfo.value.daysRemainingInPeriod || 0,
  )

  if (periodLength <= 0) {
    return 0
  }

  const result =
    ((periodLength - remaining) /
      periodLength) *
    100

  return Math.max(
    0,
    Math.min(100, result),
  )
})

onMounted(async () => {
  await Promise.all([
    accountsStore.loadAccounts(),
    allocationStore.loadSettings(),
    allocationStore.loadRuns(),
    transactionsStore.loadTransactions(),
  ])
})

function getLocalDate() {
  const now = new Date()

  const localDate = new Date(
    now.getTime() -
      now.getTimezoneOffset() * 60000,
  )

  return localDate
    .toISOString()
    .slice(0, 10)
}

function formatMoney(value) {
  return new Intl.NumberFormat(
    'ru-RU',
    {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    },
  ).format(Number(value || 0))
}

function formatDate(value) {
  if (!value) {
    return 'Дата не указана'
  }

  return new Intl.DateTimeFormat(
    'ru-RU',
    {
      day: 'numeric',
      month: 'long',
    },
  ).format(
    new Date(`${value}T12:00:00`),
  )
}

function formatTransactionDate(value) {
  if (!value) {
    return ''
  }

  const transactionDate = new Date(
    `${value}T12:00:00`,
  )

  const todayDate = new Date(
    `${today}T12:00:00`,
  )

  const difference =
    Math.round(
      (
        todayDate.getTime() -
        transactionDate.getTime()
      ) /
        (24 * 60 * 60 * 1000),
    )

  if (difference === 0) {
    return 'Сегодня'
  }

  if (difference === 1) {
    return 'Вчера'
  }

  return new Intl.DateTimeFormat(
    'ru-RU',
    {
      day: 'numeric',
      month: 'short',
    },
  ).format(transactionDate)
}

function formatExpectedAmount(value) {
  const amount = Number(value || 0)

  return amount > 0
    ? formatMoney(amount)
    : 'Не указана'
}

function getAccountType(type) {
  return (
    accountTypes[type] ?? {
      label: 'Счет',
      icon: '💰',
    }
  )
}

function getAccountName(accountId) {
  return (
    accountsStore.accounts.find(
      (account) =>
        account.id ===
        Number(accountId),
    )?.name ?? 'Неизвестный счет'
  )
}

function getTransactionType(type) {
  return (
    transactionTypes[type] ?? {
      label: 'Операция',
      icon: '•',
    }
  )
}

function getTransactionTitle(transaction) {
  if (
    transaction.type === 'transfer'
  ) {
    return (
      transaction.category ||
      'Перевод'
    )
  }

  return (
    transaction.category ||
    getTransactionType(
      transaction.type,
    ).label
  )
}

function getTransactionSubtitle(transaction) {
  if (
    transaction.type === 'transfer'
  ) {
    return (
      `${getAccountName(
        transaction.fromAccountId,
      )} → ` +
      `${getAccountName(
        transaction.toAccountId,
      )}`
    )
  }

  return getAccountName(
    transaction.accountId,
  )
}

function formatTransactionAmount(
  transaction,
) {
  const amount = formatMoney(
    transaction.amount,
  )

  if (
    transaction.type === 'income'
  ) {
    return `+${amount}`
  }

  if (
    transaction.type === 'expense'
  ) {
    return `−${amount}`
  }

  return amount
}

function getDaysUntilSalaryLabel(days) {
  const value = Number(days || 0)

  if (value === 0) {
    return 'Зарплата сегодня'
  }

  const lastDigit = value % 10
  const lastTwoDigits = value % 100

  let word = 'дней'

  if (
    lastDigit === 1 &&
    lastTwoDigits !== 11
  ) {
    word = 'день'
  } else if (
    [2, 3, 4].includes(lastDigit) &&
    ![12, 13, 14].includes(
      lastTwoDigits,
    )
  ) {
    word = 'дня'
  }

  return `${value} ${word} до зарплаты`
}
</script>

<template>
  <section class="screen screen-dashboard">
    <header class="topbar">
      <div>
        <span class="topbar-label">
          Личный финансовый дашборд
        </span>

        <h1 class="screen-title">
          Мои финансы
        </h1>
      </div>

      <RouterLink
        to="/settings"
        class="icon-pill"
        aria-label="Настройки"
      >
        ⚙️
      </RouterLink>
    </header>

    <div
      v-if="isLoading"
      class="surface-card"
    >
      Загружаем ваши финансы…
    </div>

    <template v-else>
      <section class="hero-card">
        <div class="hero-card__head">
          <div>
            <span class="hero-card__label">
              Общий капитал
            </span>

            <strong class="hero-card__value">
              {{
                formatMoney(
                  accountsStore.totalBalance,
                )
              }}
            </strong>
          </div>

          <div class="hero-card__badge">
            {{
              accountsStore.activeAccounts.length
            }}
            счетов
          </div>
        </div>

        <div class="hero-card__stats">
          <div
            class="hero-stat hero-stat--blue"
          >
            <span class="hero-stat__label">
              Деньги
            </span>

            <strong class="hero-stat__value">
              {{ formatMoney(cashBalance) }}
            </strong>
          </div>

          <div
            class="hero-stat hero-stat--violet"
          >
            <span class="hero-stat__label">
              Накопления
            </span>

            <strong class="hero-stat__value">
              {{
                formatMoney(
                  savingsBalance,
                )
              }}
            </strong>
          </div>

          <div
            class="hero-stat hero-stat--pink"
          >
            <span class="hero-stat__label">
              Инвестиции
            </span>

            <strong class="hero-stat__value">
              {{
                formatMoney(
                  investmentsBalance,
                )
              }}
            </strong>
          </div>
        </div>
      </section>

      <section
        v-if="allocationIsConfigured"
        class="dashboard-period-card"
      >
        <div class="dashboard-period-card__head">
          <div>
            <span class="dashboard-period-card__eyebrow">
              Текущий период
            </span>

            <strong>
              {{
                formatDate(
                  salaryInfo.currentPeriodStart,
                )
              }}
              —
              {{
                formatDate(
                  salaryInfo.currentPeriodEnd,
                )
              }}
            </strong>
          </div>

          <span
            class="dashboard-salary-badge"
            :class="{
              'dashboard-salary-badge--today':
                salaryInfo.isPayday,
            }"
          >
            {{
              getDaysUntilSalaryLabel(
                salaryInfo.daysUntilNextPayment,
              )
            }}
          </span>
        </div>

        <div class="dashboard-period-progress">
          <span
            :style="{
              width: `${periodProgress}%`,
            }"
          ></span>
        </div>

        <div class="dashboard-period-grid">
          <div>
            <span>Основной счет</span>

            <strong>
              {{
                formatMoney(
                  sourceAccount.balance,
                )
              }}
            </strong>

            <small>
              {{ sourceAccount.name }}
            </small>
          </div>

          <div>
            <span>Нужно оставить</span>

            <strong>
              {{
                formatMoney(
                  distribution.amountToKeep,
                )
              }}
            </strong>

            <small>
              До следующей выплаты
            </small>
          </div>
        </div>

        <div class="dashboard-allocation-result">
          <div>
            <span>
              Можно распределить сейчас
            </span>

            <strong>
              {{
                formatMoney(
                  distribution.amountToDistribute,
                )
              }}
            </strong>
          </div>

          <RouterLink
            to="/allocation"
            class="dashboard-allocation-button"
          >
            Распределить
          </RouterLink>
        </div>

        <div class="dashboard-next-salary">
          <span>
            Ближайшая выплата
          </span>

          <strong>
            {{
              formatDate(
                salaryInfo.nextPaymentDate,
              )
            }}
          </strong>

          <span>
            {{
              formatExpectedAmount(
                salaryInfo.nextExpectedAmount,
              )
            }}
          </span>
        </div>
      </section>

      <section
        v-else
        class="dashboard-setup-card"
      >
        <div class="dashboard-setup-card__icon">
          📅
        </div>

        <div>
          <strong>
            Настройте график зарплаты
          </strong>

          <p>
            Тогда на главном экране появятся ближайшая
            выплата, сумма на жизнь и свободные деньги.
          </p>
        </div>

        <RouterLink
          to="/settings"
          class="primary-button"
        >
          Открыть настройки
        </RouterLink>
      </section>

      <section class="section-block">
        <div class="section-head">
          <div>
            <span class="section-label">
              Быстрые действия
            </span>

            <h2 class="section-title">
              Что хотите сделать?
            </h2>
          </div>
        </div>

        <div class="action-grid">
          <RouterLink
            to="/transactions"
            class="action-tile action-tile--dark"
          >
            <div class="action-tile__icon">
              ＋
            </div>

            <div>
              <strong>
                Добавить операцию
              </strong>

              <span>
                Доход, расход или перевод
              </span>
            </div>
          </RouterLink>

          <RouterLink
            to="/allocation"
            class="action-tile action-tile--soft"
          >
            <div class="action-tile__icon">
              %
            </div>

            <div>
              <strong>
                Распределить деньги
              </strong>

              <span>
                Разложить свободный остаток
              </span>
            </div>
          </RouterLink>
        </div>
      </section>

      <section class="section-block">
        <div class="section-head">
          <div>
            <span class="section-label">
              Последняя активность
            </span>

            <h2 class="section-title">
              Недавние операции
            </h2>
          </div>

          <RouterLink
            to="/transactions"
            class="text-link"
          >
            Все операции
          </RouterLink>
        </div>

        <div
          v-if="recentTransactions.length"
          class="dashboard-transactions-card"
        >
          <RouterLink
            v-for="transaction in recentTransactions"
            :key="transaction.id"
            to="/transactions"
            class="dashboard-transaction-row"
          >
            <div
              class="dashboard-transaction-icon"
              :class="
                `dashboard-transaction-icon--${transaction.type}`
              "
            >
              {{
                getTransactionType(
                  transaction.type,
                ).icon
              }}
            </div>

            <div class="dashboard-transaction-copy">
              <strong>
                {{
                  getTransactionTitle(
                    transaction,
                  )
                }}
              </strong>

              <span>
                {{
                  getTransactionSubtitle(
                    transaction,
                  )
                }}
              </span>
            </div>

            <div class="dashboard-transaction-value">
              <strong
                :class="
                  `dashboard-transaction-value--${transaction.type}`
                "
              >
                {{
                  formatTransactionAmount(
                    transaction,
                  )
                }}
              </strong>

              <span>
                {{
                  formatTransactionDate(
                    transaction.date,
                  )
                }}
              </span>
            </div>
          </RouterLink>
        </div>

        <div
          v-else
          class="empty-card dashboard-empty-card"
        >
          <div class="empty-card__icon">
            🧾
          </div>

          <strong>
            Операций пока нет
          </strong>

          <p>
            Добавьте первый доход, расход или перевод.
          </p>

          <RouterLink
            to="/transactions"
            class="primary-button"
          >
            Добавить операцию
          </RouterLink>
        </div>
      </section>

      <section class="section-block">
        <div class="section-head">
          <div>
            <span class="section-label">
              Счета
            </span>

            <h2 class="section-title">
              Текущие балансы
            </h2>
          </div>

          <RouterLink
            to="/accounts"
            class="text-link"
          >
            Все счета
          </RouterLink>
        </div>

        <div
          v-if="topAccounts.length"
          class="account-list-card"
        >
          <RouterLink
            v-for="account in topAccounts"
            :key="account.id"
            to="/accounts"
            class="account-row"
          >
            <div class="account-row__left">
              <div
                class="account-avatar"
                :class="
                  `account-avatar--${account.type}`
                "
              >
                {{
                  getAccountType(
                    account.type,
                  ).icon
                }}
              </div>

              <div class="account-row__meta">
                <strong>
                  {{ account.name }}
                </strong>

                <span>
                  {{
                    getAccountType(
                      account.type,
                    ).label
                  }}
                </span>
              </div>
            </div>

            <strong class="account-row__amount">
              {{
                formatMoney(
                  account.balance,
                )
              }}
            </strong>
          </RouterLink>
        </div>

        <div
          v-else
          class="empty-card"
        >
          <div class="empty-card__icon">
            💳
          </div>

          <strong>
            Пока нет ни одного счета
          </strong>

          <p>
            Добавьте карту, наличные, вклад
            или брокерский счет.
          </p>

          <RouterLink
            to="/accounts"
            class="primary-button"
          >
            Добавить счет
          </RouterLink>
        </div>
      </section>
    </template>
  </section>
</template>