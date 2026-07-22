<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useAccountsStore } from '@/stores/accounts'

const accountsStore = useAccountsStore()

const isFormOpen = ref(false)
const isSaving = ref(false)
const actionAccountId = ref(null)
const formError = ref('')

const form = reactive({
  name: '',
  type: 'card',
  balance: '',
})

const accountTypes = [
  {
    value: 'card',
    label: 'Банковская карта',
    shortLabel: 'Карта',
    icon: '💳',
  },
  {
    value: 'cash',
    label: 'Наличные',
    shortLabel: 'Наличные',
    icon: '💵',
  },
  {
    value: 'savings',
    label: 'Накопительный счет',
    shortLabel: 'Накопления',
    icon: '🏦',
  },
  {
    value: 'deposit',
    label: 'Вклад',
    shortLabel: 'Вклад',
    icon: '🔒',
  },
  {
    value: 'broker',
    label: 'Брокерский счет',
    shortLabel: 'Инвестиции',
    icon: '📈',
  },
]

const groupedSummary = computed(() => {
  const result = {
    card: 0,
    cash: 0,
    savings: 0,
    deposit: 0,
    broker: 0,
  }

  for (const account of accountsStore.activeAccounts) {
    if (result[account.type] !== undefined) {
      result[account.type] += Number(account.balance || 0)
    }
  }

  return result
})

onMounted(() => {
  accountsStore.loadAccounts()
})

function getAccountType(type) {
  return (
    accountTypes.find(
      (accountType) => accountType.value === type,
    ) ?? {
      label: 'Другой счет',
      shortLabel: 'Счет',
      icon: '💰',
    }
  )
}

function formatMoney(value) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function parseBalance(value) {
  const normalizedValue = String(value)
    .replace(/\s/g, '')
    .replace(',', '.')

  return Number(normalizedValue)
}

function resetForm() {
  form.name = ''
  form.type = 'card'
  form.balance = ''
  formError.value = ''
}

function closeForm() {
  resetForm()
  isFormOpen.value = false
}

async function handleSubmit() {
  formError.value = ''

  const name = form.name.trim()
  const balance = parseBalance(form.balance)

  if (!name) {
    formError.value = 'Введите название счета.'
    return
  }

  if (
    form.balance === '' ||
    !Number.isFinite(balance)
  ) {
    formError.value = 'Введите корректный баланс.'
    return
  }

  isSaving.value = true

  try {
    await accountsStore.addAccount({
      name,
      type: form.type,
      balance,
    })

    closeForm()
  } catch (error) {
    formError.value =
      error instanceof Error
        ? error.message
        : 'Не удалось сохранить счет.'
  } finally {
    isSaving.value = false
  }
}

async function archiveAccount(account) {
  const shouldArchive = window.confirm(
    `Закрыть счет «${account.name}»? Счет останется в истории операций.`,
  )

  if (!shouldArchive) {
    return
  }

  actionAccountId.value = account.id

  try {
    await accountsStore.archiveAccount(account.id)
  } catch {
    // Сообщение отображается из accountsStore.error.
  } finally {
    actionAccountId.value = null
  }
}

async function restoreAccount(account) {
  actionAccountId.value = account.id

  try {
    await accountsStore.restoreAccount(account.id)
  } catch {
    // Сообщение отображается из accountsStore.error.
  } finally {
    actionAccountId.value = null
  }
}
</script>

<template>
  <section class="screen">
    <header class="topbar topbar--with-action">
      <div>
        <span class="topbar-label">Ваши счета</span>
        <h1 class="screen-title">Счета</h1>
      </div>

      <button
        v-if="!isFormOpen"
        class="primary-button"
        type="button"
        @click="isFormOpen = true"
      >
        + Счет
      </button>
    </header>

    <section class="mini-summary">
      <div class="mini-summary__item mini-summary__item--blue">
        <span>Всего</span>

        <strong>
          {{ formatMoney(accountsStore.totalBalance) }}
        </strong>
      </div>

      <div class="mini-summary__item mini-summary__item--violet">
        <span>Накопления</span>

        <strong>
          {{
            formatMoney(
              groupedSummary.savings +
                groupedSummary.deposit,
            )
          }}
        </strong>
      </div>

      <div class="mini-summary__item mini-summary__item--pink">
        <span>Инвестиции</span>

        <strong>
          {{ formatMoney(groupedSummary.broker) }}
        </strong>
      </div>
    </section>

    <form
      v-if="isFormOpen"
      class="surface-card sheet-card"
      @submit.prevent="handleSubmit"
    >
      <div class="sheet-card__head">
        <div>
          <h2>Новый счет</h2>

          <p>
            Добавьте счет и укажите его текущий баланс.
          </p>
        </div>

        <button
          class="ghost-button"
          type="button"
          aria-label="Закрыть форму"
          @click="closeForm"
        >
          ✕
        </button>
      </div>

      <div class="field-list">
        <label class="field">
          <span class="field-label">Название</span>

          <input
            v-model="form.name"
            class="text-input"
            type="text"
            maxlength="50"
            placeholder="Например, Основная карта"
            autocomplete="off"
          />
        </label>

        <label class="field">
          <span class="field-label">Тип счета</span>

          <select
            v-model="form.type"
            class="text-input"
          >
            <option
              v-for="accountType in accountTypes"
              :key="accountType.value"
              :value="accountType.value"
            >
              {{ accountType.icon }}
              {{ accountType.label }}
            </option>
          </select>
        </label>

        <label class="field">
          <span class="field-label">
            Текущий баланс
          </span>

          <input
            v-model="form.balance"
            class="text-input"
            type="text"
            inputmode="decimal"
            placeholder="0"
            autocomplete="off"
          />
        </label>
      </div>

      <p
        v-if="formError"
        class="error-message"
      >
        {{ formError }}
      </p>

      <div class="sheet-card__actions">
        <button
          class="secondary-button"
          type="button"
          @click="closeForm"
        >
          Отмена
        </button>

        <button
          class="primary-button"
          type="submit"
          :disabled="isSaving"
        >
          {{
            isSaving
              ? 'Сохраняем…'
              : 'Добавить счет'
          }}
        </button>
      </div>
    </form>

    <p
      v-if="accountsStore.error"
      class="error-message surface-card"
    >
      {{ accountsStore.error }}
    </p>

    <div
      v-if="accountsStore.isLoading"
      class="surface-card"
    >
      Загружаем счета…
    </div>

    <div
      v-else-if="accountsStore.activeAccounts.length"
      class="account-stack"
    >
      <article
        v-for="account in accountsStore.activeAccounts"
        :key="account.id"
        class="account-item"
      >
        <div class="account-item__left">
          <div
            class="account-avatar"
            :class="`account-avatar--${account.type}`"
          >
            {{ getAccountType(account.type).icon }}
          </div>

          <div class="account-item__meta">
            <strong>{{ account.name }}</strong>

            <span>
              {{ getAccountType(account.type).shortLabel }}
            </span>
          </div>
        </div>

        <div class="account-item__right">
          <strong class="account-item__amount">
            {{ formatMoney(account.balance) }}
          </strong>

          <button
            class="ghost-button ghost-button--danger"
            type="button"
            :disabled="actionAccountId === account.id"
            :aria-label="`Закрыть счет ${account.name}`"
            @click="archiveAccount(account)"
          >
            {{
              actionAccountId === account.id
                ? 'Закрываем…'
                : 'Закрыть'
            }}
          </button>
        </div>
      </article>
    </div>

    <div
      v-else-if="!accountsStore.isLoading"
      class="empty-card"
    >
      <div class="empty-card__icon">💳</div>

      <strong>Активных счетов пока нет</strong>

      <p>
        Добавьте карту, наличные, накопительный
        или брокерский счет.
      </p>

      <button
        class="primary-button"
        type="button"
        @click="isFormOpen = true"
      >
        Добавить счет
      </button>
    </div>

    <section
      v-if="
        !accountsStore.isLoading &&
        accountsStore.archivedAccounts.length
      "
      class="archived-accounts-section"
    >
      <div class="section-head">
        <div>
          <span class="section-label">
            Архив
          </span>

          <h2 class="section-title">
            Закрытые счета
          </h2>
        </div>
      </div>

      <div class="account-stack">
        <article
          v-for="account in accountsStore.archivedAccounts"
          :key="account.id"
          class="account-item account-item--archived"
        >
          <div class="account-item__left">
            <div
              class="account-avatar account-avatar--archived"
            >
              {{ getAccountType(account.type).icon }}
            </div>

            <div class="account-item__meta">
              <strong>{{ account.name }}</strong>

              <span>
                {{ getAccountType(account.type).shortLabel }}
                · закрыт
              </span>
            </div>
          </div>

          <div class="account-item__right">
            <strong class="account-item__amount">
              {{ formatMoney(account.balance) }}
            </strong>

            <button
              class="ghost-button account-restore-button"
              type="button"
              :disabled="actionAccountId === account.id"
              @click="restoreAccount(account)"
            >
              {{
                actionAccountId === account.id
                  ? 'Возвращаем…'
                  : 'Восстановить'
              }}
            </button>
          </div>
        </article>
      </div>
    </section>
  </section>
</template>