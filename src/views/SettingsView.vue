<script setup>
import {
  computed,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue'
import { RouterLink } from 'vue-router'
import { useAccountsStore } from '@/stores/accounts'
import { useAllocationStore } from '@/stores/allocation'

const accountsStore = useAccountsStore()
const allocationStore = useAllocationStore()

const formError = ref('')
const successMessage = ref('')

const form = reactive({
  sourceAccountId: '',
  minimumBalance: '0',
  categories: [],
  rules: [],
})

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

const totalLifeBudget = computed(() =>
  form.categories.reduce(
    (total, category) =>
      total + parseNumber(category.amount),
    0,
  ),
)

const minimumBalance = computed(() =>
  parseNumber(form.minimumBalance),
)

const totalToKeep = computed(
  () => totalLifeBudget.value + minimumBalance.value,
)

const totalPercentage = computed(() =>
  form.rules.reduce(
    (total, rule) =>
      total + parseNumber(rule.percentage),
    0,
  ),
)

const percentageIsValid = computed(
  () => Math.abs(totalPercentage.value - 100) < 0.001,
)

onMounted(async () => {
  await Promise.all([
    accountsStore.loadAccounts(),
    allocationStore.loadSettings(),
  ])

  hydrateForm()
})

watch(
  () => form.sourceAccountId,
  () => {
    syncRules()
    successMessage.value = ''
  },
)

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function parseNumber(value) {
  const normalized = String(value ?? '')
    .replace(/\s/g, '')
    .replace(',', '.')

  const result = Number(normalized)

  return Number.isFinite(result) ? result : 0
}

function hydrateForm() {
  const saved = allocationStore.settings

  form.sourceAccountId =
    saved.sourceAccountId ?? ''

  form.minimumBalance =
    String(saved.minimumBalance ?? 0)

  form.categories = saved.categories.map((category) => ({
    id: category.id,
    name: category.name,
    amount: String(category.amount),
  }))

  form.rules = saved.rules.map((rule) => ({
    targetAccountId: Number(rule.targetAccountId),
    percentage: String(rule.percentage),
  }))

  if (
    !form.sourceAccountId &&
    accountsStore.activeAccounts.length
  ) {
    const preferredSource =
      accountsStore.activeAccounts.find(
        (account) => account.type === 'card',
      ) ?? accountsStore.activeAccounts[0]

    form.sourceAccountId = preferredSource.id
  }

  syncRules()
}

function syncRules() {
  const sourceId = Number(form.sourceAccountId)

  const existingRules = new Map(
    form.rules.map((rule) => [
      Number(rule.targetAccountId),
      rule,
    ]),
  )

  form.rules = accountsStore.activeAccounts
    .filter((account) => account.id !== sourceId)
    .map((account) => {
      const existingRule = existingRules.get(account.id)

      return {
        targetAccountId: account.id,
        percentage:
          existingRule?.percentage ?? '0',
      }
    })
}

function getAccount(accountId) {
  return accountsStore.activeAccounts.find(
    (account) => account.id === Number(accountId),
  )
}

function getAccountType(type) {
  return (
    accountTypes[type] ?? {
      label: 'Другой счет',
      icon: '💰',
    }
  )
}

function formatMoney(value) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function addCategory() {
  form.categories.push({
    id: createId(),
    name: '',
    amount: '',
  })

  successMessage.value = ''
}

function removeCategory(categoryId) {
  form.categories = form.categories.filter(
    (category) => category.id !== categoryId,
  )

  successMessage.value = ''
}

async function handleSave() {
  formError.value = ''
  successMessage.value = ''

  const sourceAccountId = Number(form.sourceAccountId)

  if (!sourceAccountId) {
    formError.value =
      'Выберите счет, на который поступает доход.'
    return
  }

  if (minimumBalance.value < 0) {
    formError.value =
      'Неснижаемый остаток не может быть отрицательным.'
    return
  }

  if (!form.categories.length) {
    formError.value =
      'Добавьте хотя бы одну категорию бюджета.'
    return
  }

  for (const category of form.categories) {
    if (!category.name.trim()) {
      formError.value =
        'У каждой категории должно быть название.'
      return
    }

    if (parseNumber(category.amount) < 0) {
      formError.value =
        'Сумма категории не может быть отрицательной.'
      return
    }
  }

  const activeRules = form.rules
    .map((rule) => ({
      targetAccountId: Number(rule.targetAccountId),
      percentage: parseNumber(rule.percentage),
    }))
    .filter((rule) => rule.percentage > 0)

  if (!activeRules.length) {
    formError.value =
      'Укажите хотя бы одно направление распределения.'
    return
  }

  if (!percentageIsValid.value) {
    formError.value =
      'Сумма процентов распределения должна быть равна 100%.'
    return
  }

  try {
    await allocationStore.saveSettings({
      id: 'main',
      sourceAccountId,
      minimumBalance: minimumBalance.value,

      categories: form.categories.map((category) => ({
        id: category.id,
        name: category.name.trim(),
        amount: parseNumber(category.amount),
      })),

      rules: activeRules,
    })

    successMessage.value = 'Настройки сохранены.'
  } catch {
    formError.value =
      'Не удалось сохранить настройки.'
  }
}
</script>

<template>
  <section class="screen settings-screen">
    <header class="topbar">
      <div>
        <span class="topbar-label">
          Планирование денег
        </span>

        <h1 class="screen-title">Настройки</h1>
      </div>
    </header>

    <div
      v-if="accountsStore.isLoading || allocationStore.isLoading"
      class="surface-card"
    >
      Загружаем настройки…
    </div>

    <div
      v-else-if="!accountsStore.activeAccounts.length"
      class="empty-card"
    >
      <div class="empty-card__icon">💳</div>

      <strong>Сначала добавьте счета</strong>

      <p>
        Для распределения нужен счет поступления и хотя бы
        один счет для накоплений.
      </p>

      <RouterLink to="/accounts" class="primary-button">
        Перейти к счетам
      </RouterLink>
    </div>

    <form
      v-else
      class="settings-form"
      @submit.prevent="handleSave"
    >
      <section class="settings-card">
        <div class="settings-card__heading">
          <div class="settings-card__icon settings-card__icon--blue">
            💳
          </div>

          <div>
            <h2>Счет поступления</h2>
            <p>
              Счет, на который обычно приходит зарплата.
            </p>
          </div>
        </div>

        <label class="field">
          <span class="field-label">Основной счет</span>

          <select
            v-model.number="form.sourceAccountId"
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
      </section>

      <section class="settings-card">
        <div class="settings-card__heading">
          <div class="settings-card__icon settings-card__icon--green">
            🛒
          </div>

          <div>
            <h2>Бюджет на две недели</h2>
            <p>
              Эти категории используются только для расчета
              суммы, которую нужно оставить.
            </p>
          </div>
        </div>

        <div class="budget-categories">
          <div
            v-for="category in form.categories"
            :key="category.id"
            class="budget-category-row"
          >
            <input
              v-model="category.name"
              class="budget-category-name"
              type="text"
              maxlength="40"
              placeholder="Название категории"
              autocomplete="off"
            />

            <div class="money-input">
              <input
                v-model="category.amount"
                type="text"
                inputmode="decimal"
                placeholder="0"
                autocomplete="off"
              />

              <span>₽</span>
            </div>

            <button
              class="category-remove-button"
              type="button"
              aria-label="Удалить категорию"
              @click="removeCategory(category.id)"
            >
              ×
            </button>
          </div>
        </div>

        <button
          class="add-row-button"
          type="button"
          @click="addCategory"
        >
          + Добавить категорию
        </button>

        <div class="settings-total">
          <span>Всего на две недели</span>

          <strong>
            {{ formatMoney(totalLifeBudget) }}
          </strong>
        </div>
      </section>

      <section class="settings-card">
        <div class="settings-card__heading">
          <div class="settings-card__icon settings-card__icon--yellow">
            🛟
          </div>

          <div>
            <h2>Неснижаемый остаток</h2>
            <p>
              Дополнительный запас, который всегда остается
              на основном счете.
            </p>
          </div>
        </div>

        <label class="field">
          <span class="field-label">
            Резерв на основном счете
          </span>

          <div class="large-money-input">
            <input
              v-model="form.minimumBalance"
              type="text"
              inputmode="decimal"
              placeholder="0"
              autocomplete="off"
            />

            <span>₽</span>
          </div>
        </label>

        <div class="keep-summary">
          <span>Всего нужно оставить</span>

          <strong>
            {{ formatMoney(totalToKeep) }}
          </strong>

          <small>
            Бюджет на жизнь + неснижаемый остаток
          </small>
        </div>
      </section>

      <section class="settings-card">
        <div class="settings-card__heading">
          <div class="settings-card__icon settings-card__icon--violet">
            %
          </div>

          <div>
            <h2>Распределение накоплений</h2>
            <p>
              Укажите, какая доля свободных денег должна
              поступать на каждый счет.
            </p>
          </div>
        </div>

        <div
          v-if="form.rules.length"
          class="allocation-rules"
        >
          <div
            v-for="rule in form.rules"
            :key="rule.targetAccountId"
            class="allocation-rule"
          >
            <template v-if="getAccount(rule.targetAccountId)">
              <div class="allocation-rule__account">
                <div
                  class="account-avatar"
                  :class="`account-avatar--${getAccount(rule.targetAccountId).type}`"
                >
                  {{
                    getAccountType(
                      getAccount(rule.targetAccountId).type,
                    ).icon
                  }}
                </div>

                <div class="allocation-rule__copy">
                  <strong>
                    {{
                      getAccount(rule.targetAccountId).name
                    }}
                  </strong>

                  <span>
                    {{
                      getAccountType(
                        getAccount(rule.targetAccountId).type,
                      ).label
                    }}
                  </span>
                </div>
              </div>

              <div class="percentage-input">
                <input
                  v-model="rule.percentage"
                  type="text"
                  inputmode="decimal"
                  placeholder="0"
                  autocomplete="off"
                />

                <span>%</span>
              </div>
            </template>
          </div>
        </div>

        <div v-else class="settings-inline-warning">
          Добавьте хотя бы еще один счет для распределения.
        </div>

        <div
          class="percentage-summary"
          :class="{
            'percentage-summary--valid':
              percentageIsValid,
            'percentage-summary--invalid':
              !percentageIsValid,
          }"
        >
          <span>Всего распределено</span>

          <strong>{{ totalPercentage }}%</strong>
        </div>
      </section>

      <p
        v-if="formError || allocationStore.error"
        class="error-message settings-message"
      >
        {{ formError || allocationStore.error }}
      </p>

      <p
        v-if="successMessage"
        class="success-message settings-message"
      >
        {{ successMessage }}
      </p>

      <button
        class="primary-button settings-save-button"
        type="submit"
        :disabled="
          allocationStore.isSaving ||
          !form.rules.length
        "
      >
        {{
          allocationStore.isSaving
            ? 'Сохраняем…'
            : 'Сохранить настройки'
        }}
      </button>
    </form>
  </section>
</template>