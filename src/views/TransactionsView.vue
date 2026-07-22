<script setup>
import {
  computed,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch,
} from 'vue'
import { RouterLink } from 'vue-router'
import { useAccountsStore } from '@/stores/accounts'
import { useTransactionsStore } from '@/stores/transactions'

const accountsStore = useAccountsStore()
const transactionsStore = useTransactionsStore()

const isSheetOpen = ref(false)
const isSaving = ref(false)
const formError = ref('')
const activeFilter = ref('all')

const editingTransactionId = ref(null)

const isEditing = computed(
  () => editingTransactionId.value !== null,
)

const today = new Date().toISOString().slice(0, 10)

const form = reactive({
  type: 'expense',
  amount: '',
  accountId: '',
  fromAccountId: '',
  toAccountId: '',
  category: 'Продукты',
  date: today,
  note: '',
})

const operationTypes = [
  {
    value: 'expense',
    label: 'Расход',
  },
  {
    value: 'income',
    label: 'Доход',
  },
  {
    value: 'transfer',
    label: 'Перевод',
  },
]

const categories = {
  expense: [
    'Продукты',
    'Кафе и рестораны',
    'Транспорт',
    'Дом и быт',
    'Красота',
    'Здоровье',
    'Покупки',
    'Подписки',
    'Развлечения',
    'Подарки',
    'Другое',
  ],

  income: [
    'Зарплата',
    'Премия',
    'Подарок',
    'Проценты',
    'Дивиденды',
    'Возврат',
    'Другое',
  ],
}

const filters = [
  {
    value: 'all',
    label: 'Все',
  },
  {
    value: 'expense',
    label: 'Расходы',
  },
  {
    value: 'income',
    label: 'Доходы',
  },
  {
    value: 'transfer',
    label: 'Переводы',
  },
]

const filteredTransactions = computed(() => {
  if (activeFilter.value === 'all') {
    return transactionsStore.transactions
  }

  return transactionsStore.transactions.filter(
    (transaction) => transaction.type === activeFilter.value,
  )
})

onMounted(async () => {
  await Promise.all([
    accountsStore.loadAccounts(),
    transactionsStore.loadTransactions(),
  ])

  setDefaultAccounts()
})

onUnmounted(() => {
  document.body.classList.remove('sheet-open')
})

watch(isSheetOpen, (isOpen) => {
  document.body.classList.toggle('sheet-open', isOpen)
})

watch(
  () => form.type,
  (type) => {
    formError.value = ''

    if (type === 'expense') {
      form.category = 'Продукты'
    }

    if (type === 'income') {
      form.category = 'Зарплата'
    }

    setDefaultAccounts()
  },
)

function setDefaultAccounts() {
  const firstAccount = accountsStore.activeAccounts[0]
  const secondAccount = accountsStore.activeAccounts[1]

  if (firstAccount && !form.accountId) {
    form.accountId = firstAccount.id
  }

  if (firstAccount && !form.fromAccountId) {
    form.fromAccountId = firstAccount.id
  }

  if (secondAccount && !form.toAccountId) {
    form.toAccountId = secondAccount.id
  }

  if (!secondAccount && firstAccount) {
    form.toAccountId = firstAccount.id
  }
}

function openSheet(type = 'expense') {
  editingTransactionId.value = null

  form.type = type
  form.amount = ''
  form.accountId = ''
  form.fromAccountId = ''
  form.toAccountId = ''
  form.date = new Date().toISOString().slice(0, 10)
  form.note = ''

  if (type === 'expense') {
    form.category = 'Продукты'
  }

  if (type === 'income') {
    form.category = 'Зарплата'
  }

  setDefaultAccounts()

  formError.value = ''
  isSheetOpen.value = true
}

function closeSheet() {
  isSheetOpen.value = false
  editingTransactionId.value = null
  formError.value = ''
}

function selectOperationType(type) {
  form.type = type
  formError.value = ''

  if (type === 'expense') {
    form.category = 'Продукты'
  }

  if (type === 'income') {
    form.category = 'Зарплата'
  }

  setDefaultAccounts()
}

function resetForm() {
  form.amount = ''
  form.note = ''
  form.date = new Date().toISOString().slice(0, 10)

  if (form.type === 'expense') {
    form.category = 'Продукты'
  }

  if (form.type === 'income') {
    form.category = 'Зарплата'
  }
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
  const date = new Date(`${value}T12:00:00`)

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
  }).format(date)
}

function getAccountName(id) {
  return (
    accountsStore.activeAccounts.find(
      (account) => account.id === Number(id),
    )?.name ?? 'Неизвестный счет'
  )
}

function getTransactionIcon(type) {
  if (type === 'income') {
    return '↓'
  }

  if (type === 'expense') {
    return '↑'
  }

  return '⇄'
}

function getTransactionTitle(transaction) {
  if (transaction.type === 'transfer') {
    return `${getAccountName(transaction.fromAccountId)} → ${getAccountName(
      transaction.toAccountId,
    )}`
  }

  return transaction.category
}

function getTransactionSubtitle(transaction) {
  const details = []

  if (transaction.type !== 'transfer') {
    details.push(getAccountName(transaction.accountId))
  }

  details.push(formatDate(transaction.date))

  if (transaction.note) {
    details.push(transaction.note)
  }

  return details.join(' · ')
}

function getTransactionAmount(transaction) {
  if (transaction.type === 'income') {
    return `+${formatMoney(transaction.amount)}`
  }

  if (transaction.type === 'expense') {
    return `−${formatMoney(transaction.amount)}`
  }

  return formatMoney(transaction.amount)
}

function openEditSheet(transaction) {
  if (
    transactionsStore.isProtectedTransaction(
      transaction,
    )
  ) {
    return
  }

  editingTransactionId.value = transaction.id

  form.type = transaction.type
  form.amount = String(transaction.amount)
  form.date = transaction.date
  form.note = transaction.note || ''
  form.category =
    transaction.category || 'Другое'

  form.accountId =
    transaction.accountId ?? ''

  form.fromAccountId =
    transaction.fromAccountId ?? ''

  form.toAccountId =
    transaction.toAccountId ?? ''

  setDefaultAccounts()

  formError.value = ''
  isSheetOpen.value = true
}

async function handleSubmit() {
  formError.value = ''

  const normalizedAmount = String(form.amount).replace(',', '.')
  const amount = Number(normalizedAmount)

  if (!Number.isFinite(amount) || amount <= 0) {
    formError.value = 'Введите сумму больше нуля.'
    return
  }

  if (
    (form.type === 'income' || form.type === 'expense') &&
    !form.accountId
  ) {
    formError.value = 'Выберите счет.'
    return
  }

  if (form.type === 'transfer') {
    if (!form.fromAccountId || !form.toAccountId) {
      formError.value = 'Выберите оба счета.'
      return
    }

    if (Number(form.fromAccountId) === Number(form.toAccountId)) {
      formError.value =
        'Выберите разные счета для перевода.'
      return
    }
  }

  isSaving.value = true

  try {
    const payload = {
        type: form.type,
        amount,
        date: form.date,
        category: form.category,
        note: form.note,
        accountId: form.accountId,
        fromAccountId: form.fromAccountId,
        toAccountId: form.toAccountId,
        }

        if (isEditing.value) {
        await transactionsStore.updateTransaction(
            editingTransactionId.value,
            payload,
        )
        } else {
        await transactionsStore.addTransaction(
            payload,
        )
    }

    resetForm()
    closeSheet()
  } catch (error) {
    formError.value =
      error instanceof Error
        ? error.message
        : 'Не удалось сохранить операцию.'
  } finally {
    isSaving.value = false
  }
}

async function handleDeleteTransaction() {
  if (!isEditing.value) {
    return
  }

  const shouldDelete = window.confirm(
    'Удалить операцию? Балансы счетов будут пересчитаны.',
  )

  if (!shouldDelete) {
    return
  }

  isSaving.value = true
  formError.value = ''

  try {
    await transactionsStore.deleteTransaction(
      editingTransactionId.value,
    )

    closeSheet()
  } catch (deleteError) {
    formError.value =
      deleteError instanceof Error
        ? deleteError.message
        : 'Не удалось удалить операцию.'
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <section class="screen transactions-screen">
    <header class="topbar topbar--with-action">
      <div>
        <span class="topbar-label">История движения денег</span>
        <h1 class="screen-title">Операции</h1>
      </div>

      <button
        class="primary-button transaction-add-button"
        type="button"
        :disabled="!accountsStore.activeAccounts.length"
        @click="openSheet('expense')"
      >
        + Операция
      </button>
    </header>

    <section class="transaction-summary">
      <article class="transaction-summary-card transaction-summary-card--income">
        <span>Доходы</span>
        <strong>
          {{ formatMoney(transactionsStore.monthlyIncome) }}
        </strong>
      </article>

      <article class="transaction-summary-card transaction-summary-card--expense">
        <span>Расходы</span>
        <strong>
          {{ formatMoney(transactionsStore.monthlyExpense) }}
        </strong>
      </article>

      <article class="transaction-summary-card transaction-summary-card--result">
        <span>Результат</span>
        <strong>
          {{ formatMoney(transactionsStore.monthlyResult) }}
        </strong>
      </article>
    </section>

    <div
      v-if="!accountsStore.activeAccounts.length"
      class="empty-card"
    >
      <div class="empty-card__icon">💳</div>
      <strong>Сначала добавьте счет</strong>
      <p>
        Операции привязываются к карте, наличным, вкладу или другому счету.
      </p>

      <RouterLink to="/accounts" class="primary-button">
        Перейти к счетам
      </RouterLink>
    </div>

    <template v-else>
      <nav class="filter-scroll" aria-label="Фильтр операций">
        <button
          v-for="filter in filters"
          :key="filter.value"
          class="filter-chip"
          :class="{
            'filter-chip--active': activeFilter === filter.value,
          }"
          type="button"
          @click="activeFilter = filter.value"
        >
          {{ filter.label }}
        </button>
      </nav>

      <p v-if="transactionsStore.error" class="error-message">
        {{ transactionsStore.error }}
      </p>

      <div
        v-if="transactionsStore.isLoading"
        class="surface-card"
      >
        Загружаем операции…
      </div>

      <div
        v-else-if="filteredTransactions.length"
        class="transaction-list"
      >
        <article
          v-for="transaction in filteredTransactions"
          :key="transaction.id"
          class="transaction-row"
        >
          <div
            class="transaction-icon"
            :class="`transaction-icon--${transaction.type}`"
          >
            {{ getTransactionIcon(transaction.type) }}
          </div>

          <div class="transaction-copy">
            <strong>
              {{ getTransactionTitle(transaction) }}
            </strong>

            <span>
              {{ getTransactionSubtitle(transaction) }}
            </span>

            <button
                v-if="
                    !transactionsStore.isProtectedTransaction(
                    transaction,
                    )
                "
                class="transaction-edit-link"
                type="button"
                @click="openEditSheet(transaction)"
                >
                Изменить
            </button>

            <span
                v-else
                class="transaction-auto-label"
            >
                Автоматическое распределение
            </span>
          </div>

          <strong
            class="transaction-amount"
            :class="`transaction-amount--${transaction.type}`"
          >
            {{ getTransactionAmount(transaction) }}
          </strong>
        </article>
      </div>

      <div v-else class="empty-card">
        <div class="empty-card__icon">↕️</div>
        <strong>Операций пока нет</strong>
        <p>
          Добавьте первый доход, расход или перевод между счетами.
        </p>

        <button
          class="primary-button"
          type="button"
          @click="openSheet('expense')"
        >
          Добавить операцию
        </button>
      </div>
    </template>

    <Teleport to="body">
      <Transition name="sheet">
        <div
          v-if="isSheetOpen"
          class="sheet-overlay"
          @click.self="closeSheet"
        >
          <section
            class="bottom-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="operation-sheet-title"
          >
            <div class="sheet-handle"></div>

            <header class="bottom-sheet__header">
              <div>
                <span class="topbar-label">Новая запись</span>

                <h2 id="operation-sheet-title">
                    {{
                        isEditing
                        ? 'Изменить операцию'
                        : 'Добавить операцию'
                    }}
                </h2>
              </div>

              <button
                class="sheet-close-button"
                type="button"
                aria-label="Закрыть"
                @click="closeSheet"
              >
                ×
              </button>
            </header>

            <form
              class="operation-form"
              @submit.prevent="handleSubmit"
            >
              <div class="operation-type-switch">
                <button
                  v-for="operationType in operationTypes"
                  :key="operationType.value"
                  class="operation-type-button"
                  :class="{
                    'operation-type-button--active':
                      form.type === operationType.value,
                  }"
                  type="button"
                  @click="selectOperationType(operationType.value)"
                >
                  {{ operationType.label }}
                </button>
              </div>

              <label class="amount-field">
                <span>Сумма</span>

                <div class="amount-field__control">
                  <input
                    v-model="form.amount"
                    type="text"
                    inputmode="decimal"
                    placeholder="0"
                    autocomplete="off"
                  />

                  <span>₽</span>
                </div>
              </label>

              <div class="operation-fields">
                <label
                  v-if="
                    form.type === 'income' ||
                    form.type === 'expense'
                  "
                  class="field"
                >
                  <span class="field-label">Счет</span>

                  <select
                    v-model.number="form.accountId"
                    class="text-input"
                  >
                    <option
                      v-for="account in accountsStore.activeAccounts"
                      :key="account.id"
                      :value="account.id"
                    >
                      {{ account.name }} —
                      {{ formatMoney(account.balance) }}
                    </option>
                  </select>
                </label>

                <template v-if="form.type === 'transfer'">
                  <label class="field">
                    <span class="field-label">Откуда</span>

                    <select
                      v-model.number="form.fromAccountId"
                      class="text-input"
                    >
                      <option
                        v-for="account in accountsStore.activeAccounts"
                        :key="account.id"
                        :value="account.id"
                      >
                        {{ account.name }} —
                        {{ formatMoney(account.balance) }}
                      </option>
                    </select>
                  </label>

                  <label class="field">
                    <span class="field-label">Куда</span>

                    <select
                      v-model.number="form.toAccountId"
                      class="text-input"
                    >
                      <option
                        v-for="account in accountsStore.activeAccounts"
                        :key="account.id"
                        :value="account.id"
                      >
                        {{ account.name }}
                      </option>
                    </select>
                  </label>
                </template>

                <label
                  v-if="form.type !== 'transfer'"
                  class="field"
                >
                  <span class="field-label">Категория</span>

                  <select
                    v-model="form.category"
                    class="text-input"
                  >
                    <option
                      v-for="category in categories[form.type]"
                      :key="category"
                      :value="category"
                    >
                      {{ category }}
                    </option>
                  </select>
                </label>

                <label class="field">
                  <span class="field-label">Дата</span>

                  <input
                    v-model="form.date"
                    class="text-input"
                    type="date"
                  />
                </label>

                <label class="field">
                  <span class="field-label">
                    Комментарий
                    <span class="field-optional">необязательно</span>
                  </span>

                  <input
                    v-model="form.note"
                    class="text-input"
                    type="text"
                    maxlength="100"
                    placeholder="Например, супермаркет"
                    autocomplete="off"
                  />
                </label>
              </div>

              <p v-if="formError" class="error-message">
                {{ formError }}
              </p>

              <div class="operation-form-actions">
                <button
                    class="primary-button operation-submit-button"
                    type="submit"
                    :disabled="isSaving"
                >
                    {{
                    isSaving
                        ? 'Сохраняем…'
                        : isEditing
                        ? 'Сохранить изменения'
                        : 'Сохранить операцию'
                    }}
                </button>

                <button
                    v-if="isEditing"
                    class="danger-outline-button"
                    type="button"
                    :disabled="isSaving"
                    @click="handleDeleteTransaction"
                >
                    Удалить операцию
                </button>
              </div>
            </form>
          </section>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>