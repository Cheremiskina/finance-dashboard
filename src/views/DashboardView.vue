<script setup>
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useAccountsStore } from '@/stores/accounts'

const accountsStore = useAccountsStore()

const accountTypes = {
  card: { label: 'Карта', icon: '💳' },
  cash: { label: 'Наличные', icon: '💵' },
  savings: { label: 'Накопления', icon: '🏦' },
  deposit: { label: 'Вклад', icon: '🔒' },
  broker: { label: 'Инвестиции', icon: '📈' },
}

const sortedAccounts = computed(() =>
  [...accountsStore.activeAccounts].sort(
    (first, second) => Number(second.balance) - Number(first.balance),
  ),
)

const topAccounts = computed(() => sortedAccounts.value.slice(0, 4))

const cashBalance = computed(() =>
  accountsStore.activeAccounts
    .filter((account) => ['card', 'cash'].includes(account.type))
    .reduce((sum, account) => sum + Number(account.balance || 0), 0),
)

const savingsBalance = computed(() =>
  accountsStore.activeAccounts
    .filter((account) => ['savings', 'deposit'].includes(account.type))
    .reduce((sum, account) => sum + Number(account.balance || 0), 0),
)

const investmentsBalance = computed(() =>
  accountsStore.activeAccounts
    .filter((account) => account.type === 'broker')
    .reduce((sum, account) => sum + Number(account.balance || 0), 0),
)

onMounted(() => {
  if (!accountsStore.accounts.length) {
    accountsStore.loadAccounts()
  }
})

function formatMoney(value) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function getAccountType(type) {
  return (
    accountTypes[type] ?? {
      label: 'Счет',
      icon: '💰',
    }
  )
}
</script>

<template>
  <section class="screen screen-dashboard">
    <header class="topbar">
      <div>
        <span class="topbar-label">Личный финансовый дашборд</span>
        <h1 class="screen-title">Мои финансы</h1>
      </div>

      <RouterLink to="/settings" class="icon-pill" aria-label="Настройки">
        ⚙️
      </RouterLink>
    </header>

    <section class="hero-card">
      <div class="hero-card__head">
        <div>
          <span class="hero-card__label">Общий капитал</span>
          <strong class="hero-card__value">
            {{ formatMoney(accountsStore.totalBalance) }}
          </strong>
        </div>

        <div class="hero-card__badge">
          {{ accountsStore.activeAccounts.length }} счетов
        </div>
      </div>

      <div class="hero-card__stats">
        <div class="hero-stat hero-stat--blue">
          <span class="hero-stat__label">Деньги</span>
          <strong class="hero-stat__value">{{ formatMoney(cashBalance) }}</strong>
        </div>

        <div class="hero-stat hero-stat--violet">
          <span class="hero-stat__label">Накопления</span>
          <strong class="hero-stat__value">{{ formatMoney(savingsBalance) }}</strong>
        </div>

        <div class="hero-stat hero-stat--pink">
          <span class="hero-stat__label">Инвестиции</span>
          <strong class="hero-stat__value">{{ formatMoney(investmentsBalance) }}</strong>
        </div>
      </div>
    </section>

    <section class="section-block">
      <div class="section-head">
        <div>
          <span class="section-label">Быстрые действия</span>
          <h2 class="section-title">Что хотите сделать?</h2>
        </div>
      </div>

      <div class="action-grid">
        <RouterLink to="/transactions" class="action-tile action-tile--dark">
          <div class="action-tile__icon">＋</div>
          <div>
            <strong>Добавить операцию</strong>
            <span>Доход, расход или перевод</span>
          </div>
        </RouterLink>

        <RouterLink to="/allocation" class="action-tile action-tile--soft">
          <div class="action-tile__icon">%</div>
          <div>
            <strong>Распределить доход</strong>
            <span>Сразу разложить деньги по счетам</span>
          </div>
        </RouterLink>
      </div>
    </section>

    <section class="section-block">
      <div class="section-head">
        <div>
          <span class="section-label">Счета</span>
          <h2 class="section-title">Текущие балансы</h2>
        </div>

        <RouterLink to="/accounts" class="text-link">
          Все счета
        </RouterLink>
      </div>

      <div v-if="accountsStore.isLoading" class="surface-card">
        Загружаем счета…
      </div>

      <div v-else-if="topAccounts.length" class="account-list-card">
        <RouterLink
          v-for="account in topAccounts"
          :key="account.id"
          to="/accounts"
          class="account-row"
        >
          <div class="account-row__left">
            <div
              class="account-avatar"
              :class="`account-avatar--${account.type}`"
            >
              {{ getAccountType(account.type).icon }}
            </div>

            <div class="account-row__meta">
              <strong>{{ account.name }}</strong>
              <span>{{ getAccountType(account.type).label }}</span>
            </div>
          </div>

          <strong class="account-row__amount">
            {{ formatMoney(account.balance) }}
          </strong>
        </RouterLink>
      </div>

      <div v-else class="empty-card">
        <div class="empty-card__icon">💳</div>
        <strong>Пока нет ни одного счета</strong>
        <p>Добавьте карту, наличные, вклад или брокерский счёт.</p>

        <RouterLink to="/accounts" class="primary-button">
          Добавить счет
        </RouterLink>
      </div>
    </section>
  </section>
</template>